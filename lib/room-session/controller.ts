/**
 * THE ROOM SESSION CONTROLLER — the one owner of a tab's LiveKit connection.
 *
 * Every dependency is injected (the Room, the token, the heartbeat, the clock,
 * the one-Room registry), so `node --test` drives it with a fake Room and a
 * fake clock and proves the rules that used to live implicitly in effects:
 *
 *   · UNMOUNT NEVER DISCONNECTS. There is no unmount here at all. The shell
 *     mounts one controller and the room view only calls `enter`.
 *   · `enter(sameId)` IS A NO-OP — Strict Mode, Back/Forward, a remount.
 *   · `enter(otherId)` ASKS FIRST (`conflict`); confirming disconnects and
 *     unregisters the first room BEFORE the second one connects.
 *   · DUPLICATE_IDENTITY IS TERMINAL. No reconnect is ever scheduled.
 *   · A TOKEN REFRESH NEVER RECONNECTS a healthy room. A LiveKit connection
 *     keeps itself authorised once it is up; a fresh token is only used to
 *     recover a connection that has FAILED. (The `connectToken` rule that
 *     `use-house-connection.ts` carried, kept.)
 *   · HEARTBEAT every 15 s for as long as the room is held — minimised
 *     included, every role included.
 *   · The anon → identified upgrade is BREAK-THEN-MAKE with the new token
 *     fetched first, so the registry never holds two Rooms.
 *   · The mic intent is consumed ONCE. Reconnects, remounts and re-entries
 *     never carry it.
 *
 * No React and no livekit-client import.
 */
import {
  IDLE_SESSION,
  isHolding,
  isTerminal,
  sessionReducer,
  type DisconnectKind,
  type SessionAction,
  type SessionRole,
  type SessionState,
  type SessionTarget,
} from "./reducer.ts";

export const HEARTBEAT_MS = 15_000;

export interface SessionToken {
  url: string;
  token: string;
  expiresAt?: string | null;
  captionUrl?: string | null;
}

export interface SessionRoomSignals {
  reconnecting(): void;
  reconnected(): void;
  disconnected(kind: DisconnectKind): void;
}

/** The slice of a LiveKit Room the controller drives. `handle` is the Room itself. */
export interface SessionRoom<R> {
  readonly handle: R;
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  /** Wire the lifecycle signals. Returns the unsubscribe. */
  listen(signals: SessionRoomSignals): () => void;
}

export interface SessionClock {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface RoomSessionDeps<R> {
  /** May be async: the real one loads livekit-client on first use. */
  createRoom(target: SessionTarget, options: { preferredMic?: string }): SessionRoom<R> | Promise<SessionRoom<R>>;
  fetchToken(target: SessionTarget): Promise<SessionToken>;
  sendHeartbeat(streamId: string, sessionId: string | null): Promise<{ sessionId: string }>;
  /** Tab close / leave: tell the service now rather than waiting for heartbeats to lapse. */
  sendLeaveBeacon(streamId: string, sessionId: string | null): void;
  clock: SessionClock;
  /** The one-Room registry (features/streams/lib/live-room.ts). Throws on a second Room. */
  register(streamId: string, handle: R): void;
  unregister(streamId: string, handle: R): void;
  /**
   * After a connect settles — the host publishes here. `resumed` is true for
   * every connect that is not the reader's own fresh open (reload, retry,
   * upgrade), and the host's mic must then stay OFF.
   */
  afterConnect?(room: SessionRoom<R>, target: SessionTarget, context: { resumed: boolean }): Promise<void>;
}

export interface EnterOptions {
  /** A token already in hand (the host's go-live ingest), so nothing is fetched. */
  token?: SessionToken;
  /** The reader's own fresh open — the only connect that may publish an open mic. */
  fresh?: boolean;
  /** The microphone the host chose in Backstage. Kept for this room's reconnects. */
  preferredMic?: string;
}

export class RoomSessionController<R> {
  private readonly deps: RoomSessionDeps<R>;
  private state: SessionState = IDLE_SESSION;
  private readonly listeners = new Set<() => void>();
  private current: SessionRoom<R> | null = null;
  private unlisten: (() => void) | null = null;
  /** Bumped by every connect and every teardown; a stale async step compares and stops. */
  private generation = 0;
  private heartbeat: unknown = null;
  private sessionId: string | null = null;
  private latestToken: SessionToken | null = null;
  private pendingOptions: EnterOptions | undefined;
  private micIntent = false;
  private preferredMic: string | undefined;

  constructor(deps: RoomSessionDeps<R>) {
    this.deps = deps;
  }

  /* ---- store surface ------------------------------------------------- */

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The live Room, or null. The registry says the same thing; this is for the owner. */
  get room(): R | null {
    return this.current?.handle ?? null;
  }

  private dispatch(action: SessionAction) {
    const next = sessionReducer(this.state, action);
    if (next === this.state) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  /* ---- entering -------------------------------------------------------- */

  enter(streamId: string, role: SessionRole, options?: EnterOptions): Promise<void> {
    const { target, connection } = this.state;
    if (target && target.streamId === streamId) {
      // The same room: a remount, Back/Forward, Strict Mode. Never a second
      // connection — and never out of a terminal state either, which only the
      // reader's explicit dismissal clears.
      if (connection !== "idle") return Promise.resolve();
    }
    if (target && isHolding(connection)) {
      this.pendingOptions = options;
      this.dispatch({ type: "conflict", pending: { streamId, role } });
      return Promise.resolve();
    }
    this.teardown();
    this.preferredMic = options?.preferredMic;
    return this.connect({ streamId, role }, { token: options?.token, resumed: !options?.fresh });
  }

  /** "Leave A and join B?" — yes. A is disconnected and unregistered before B connects. */
  async confirmConflict(): Promise<void> {
    const pending = this.state.pending;
    if (!pending) return;
    const options = this.pendingOptions;
    this.pendingOptions = undefined;
    const disconnected = this.teardown();
    this.dispatch({ type: "reset" });
    await disconnected;
    this.preferredMic = options?.preferredMic;
    await this.connect(pending, { token: options?.token, resumed: !options?.fresh });
  }

  dismissConflict() {
    this.pendingOptions = undefined;
    this.dispatch({ type: "conflict-dismissed" });
  }

  /* ---- leaving --------------------------------------------------------- */

  /** A listener's Leave, the mini-player's hang-up. */
  leave(): Promise<void> {
    return this.stop();
  }

  /** The host's Close. The API call that closes the room is the caller's. */
  end(): Promise<void> {
    return this.stop();
  }

  logout(): Promise<void> {
    return this.stop();
  }

  /** Clear a finished session (ended / duplicate / failed) off the screen. */
  dismiss() {
    if (this.state.connection === "idle") return;
    this.teardown();
    this.dispatch({ type: "reset" });
  }

  /** Tab close. Synchronous by necessity — `pagehide` does not wait. */
  pageHide() {
    const target = this.state.target;
    if (!target || !isHolding(this.state.connection)) return;
    this.deps.sendLeaveBeacon(target.streamId, this.sessionId);
    this.teardown();
  }

  private async stop(): Promise<void> {
    const target = this.state.target;
    if (!target) return;
    if (isHolding(this.state.connection)) {
      this.deps.sendLeaveBeacon(target.streamId, this.sessionId);
    }
    // Idle at once, so nothing reads a session that is on its way out; the
    // disconnect is still awaited for the callers that navigate after it.
    const disconnected = this.teardown();
    this.dispatch({ type: "reset" });
    await disconnected;
  }

  /* ---- signals from the room ------------------------------------------ */

  onDisconnected(kind: DisconnectKind) {
    if (!this.current) return;
    switch (kind) {
      case "duplicate-identity":
        this.teardown();
        this.dispatch({ type: "duplicate" });
        return;
      case "room-deleted":
        this.teardown();
        this.dispatch({ type: "ended", reason: "room-ended" });
        return;
      case "participant-removed":
        this.teardown();
        this.dispatch({ type: "ended", reason: "removed" });
        return;
      default:
        this.teardown();
        this.dispatch({ type: "failed", error: null });
    }
  }

  /** The stream poll says the room is over — the same end as ROOM_DELETED, from the other source. */
  onRoomEnded() {
    if (!this.state.target || isTerminal(this.state.connection)) return;
    this.teardown();
    this.dispatch({ type: "ended", reason: "room-ended" });
  }

  /**
   * A refreshed token arrived.
   *
   * While the room is held and healthy it is only remembered — reconnecting a
   * live call because a string changed was an audible drop every few minutes.
   * A FAILED room takes it, because that is the Retry path.
   */
  onTokenRefreshed(token: SessionToken) {
    this.latestToken = token;
    const { target, connection } = this.state;
    if (target && connection === "failed") {
      void this.connect(target, { token, resumed: true });
    }
  }

  /** The reader's Retry on a failed room: a fresh token, a new Room. */
  retry(): Promise<void> {
    const { target, connection } = this.state;
    if (!target || connection !== "failed") return Promise.resolve();
    return this.connect(target, { resumed: true });
  }

  /**
   * Come back on a NEW connection with a fresh token, from any held state.
   *
   * The remedy for a speaker whose grant never landed on this connection (the
   * stage's "rejoin"): the token re-minted for an approved speaker carries
   * the publish right. Break-then-make, like every other replacement.
   */
  async reconnect(): Promise<void> {
    const target = this.state.target;
    if (!target || !isHolding(this.state.connection)) return;
    const disconnected = this.teardown();
    await disconnected;
    await this.connect(target, { resumed: true });
  }

  /**
   * Anonymous listener → signed in. Break-then-make:
   *   1. fetch the identified token while still listening,
   *   2. disconnect and unregister the anon Room,
   *   3. connect under the account,
   *   4. start a new heartbeat session.
   */
  async upgradeToIdentified(): Promise<void> {
    const target = this.state.target;
    if (!target || target.role !== "anon" || !isHolding(this.state.connection)) return;
    const next: SessionTarget = { streamId: target.streamId, role: "listener" };
    this.dispatch({ type: "switching", on: true });
    let token: SessionToken;
    try {
      token = await this.deps.fetchToken(next);
    } catch {
      // Still listening anonymously — nothing was broken.
      this.dispatch({ type: "switching", on: false });
      return;
    }
    await this.teardown();
    await this.connect(next, { token, resumed: true });
    this.dispatch({ type: "switching", on: false });
  }

  /* ---- the mic intent ------------------------------------------------- */

  /** Set only by the reader's own action in this session. */
  requestMic() {
    this.micIntent = true;
  }

  /** True exactly once per request. */
  consumeMicIntent(): boolean {
    const intent = this.micIntent;
    this.micIntent = false;
    return intent;
  }

  /* ---- internals ------------------------------------------------------- */

  private async connect(target: SessionTarget, options: { token?: SessionToken; resumed: boolean }) {
    const generation = ++this.generation;
    this.dispatch({ type: "connect", target });

    let token = options.token;
    if (!token) {
      try {
        token = await this.deps.fetchToken(target);
      } catch (error) {
        if (generation !== this.generation) return;
        this.dispatch({ type: "failed", error: messageOf(error) });
        return;
      }
    }
    if (generation !== this.generation) return;
    this.latestToken = token;

    let room: SessionRoom<R>;
    try {
      room = await this.deps.createRoom(target, { preferredMic: this.preferredMic });
    } catch (error) {
      if (generation !== this.generation) return;
      this.dispatch({ type: "failed", error: messageOf(error) });
      return;
    }
    if (generation !== this.generation) return;
    try {
      this.deps.register(target.streamId, room.handle);
    } catch {
      // Another Room for this stream is open in this tab. Opening a second
      // one is the eviction loop the registry exists to prevent.
      this.dispatch({ type: "duplicate" });
      return;
    }
    this.current = room;
    this.unlisten = room.listen({
      reconnecting: () => {
        if (generation === this.generation) this.dispatch({ type: "reconnecting" });
      },
      reconnected: () => {
        if (generation === this.generation) this.dispatch({ type: "reconnected" });
      },
      disconnected: (kind) => {
        if (generation === this.generation) this.onDisconnected(kind);
      },
    });

    try {
      await room.connect(token.url, token.token);
    } catch (error) {
      if (generation !== this.generation) return;
      this.teardown();
      this.dispatch({ type: "failed", error: messageOf(error) });
      return;
    }
    if (generation !== this.generation) return;
    this.dispatch({ type: "connected" });
    this.startHeartbeat(target.streamId, generation);
    if (this.deps.afterConnect) {
      try {
        await this.deps.afterConnect(room, target, { resumed: options.resumed });
      } catch {
        // A publish that fails is the publisher's own state to report; the
        // connection itself is up and stays up.
      }
    }
  }

  private startHeartbeat(streamId: string, generation: number) {
    this.stopHeartbeat();
    this.sessionId = null;
    const beat = () => {
      if (generation !== this.generation) return;
      void this.deps.sendHeartbeat(streamId, this.sessionId).then(
        (result) => {
          if (generation === this.generation) this.sessionId = result.sessionId;
        },
        () => {
          // A missed heartbeat is not worth surfacing; the next one retries.
        }
      );
    };
    this.heartbeat = this.deps.clock.setInterval(beat, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeat !== null) this.deps.clock.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  /**
   * Drop the Room: stop the heartbeat, unregister, disconnect ONCE. Synchronous
   * so a terminal signal cannot race a reconnect; the disconnect's promise is
   * returned for the callers that must wait on it.
   */
  private teardown(): Promise<void> {
    this.generation += 1;
    this.stopHeartbeat();
    this.micIntent = false;
    const room = this.current;
    const target = this.state.target;
    this.current = null;
    this.unlisten?.();
    this.unlisten = null;
    if (!room) return Promise.resolve();
    if (target) this.deps.unregister(target.streamId, room.handle);
    return room.disconnect().catch(() => undefined);
  }

  /** The token most recently seen — for the provider's refresh schedule. */
  get token(): SessionToken | null {
    return this.latestToken;
  }
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
