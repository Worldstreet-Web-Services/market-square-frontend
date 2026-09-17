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
 *   · A HOST NEVER LEAVES THEIR OWN ROOM LIVE BEHIND THEM. Switching away
 *     (`confirmConflict`) or making way for another room (`vacate`) CLOSES the
 *     host's room first, through the injected `closeRoom`; if that fails, the
 *     host stays where they are.
 *   · DUPLICATE_IDENTITY IS TERMINAL. No reconnect is ever scheduled.
 *   · A TOKEN IS FOR JOINING, NOT FOR STAYING. A LiveKit connection keeps
 *     itself authorised once it is up, so nothing here refreshes a token on
 *     a schedule: one is fetched only to connect — an entry, a Retry, a
 *     recovery from FAILED, the stage's rejoin. (The `connectToken` rule that
 *     `use-house-connection.ts` carried, kept.)
 *   · HEARTBEAT the moment the room connects, then every 15 s for as long as
 *     it is held — minimised included, every role included.
 *   · Nobody's mic is opened by the controller. The host's publish runs in
 *     `afterConnect`, told whether the connect was the reader's own fresh open.
 *   · A FAILED ROOM RECOVERS BY ITSELF: a retry is scheduled on a capped
 *     backoff, and the network coming back (or the tab coming back into view)
 *     retries at once. Terminal states never schedule one.
 *   · Every step that resumes after an `await` checks the generation, so a
 *     Leave, a logout or the room ending while a reconnect is in flight is
 *     never undone by it.
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

/**
 * The automatic retries of a FAILED room, in order. Capped: a room that has
 * not come back after these waits for the reader's Retry, the network coming
 * back or the tab returning to view — a request that fails for a reason no
 * retry can fix must not run every 30 s for as long as the tab is open.
 */
export const RETRY_DELAYS_MS: readonly number[] = [2_000, 4_000, 8_000, 16_000, 30_000, 30_000];

export interface SessionToken {
  url: string;
  token: string;
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
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface RoomSessionDeps<R> {
  /** May be async: the real one loads livekit-client on first use. */
  createRoom(target: SessionTarget, options: { preferredMic?: string }): SessionRoom<R> | Promise<SessionRoom<R>>;
  fetchToken(target: SessionTarget): Promise<SessionToken>;
  sendHeartbeat(streamId: string, sessionId: string | null): Promise<{ sessionId: string }>;
  /**
   * Close a room for everyone (the end-stream call). Only a host's room is
   * ever closed here — on a switch away from it. A rejection refuses the
   * switch: the host stays connected to a room that is still open.
   */
  closeRoom(streamId: string): Promise<void>;
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
  private preferredMic: string | undefined;
  private retryTimer: unknown = null;
  private retryAttempt = 0;
  /** The host's room being closed for a switch: its own ending is expected, not news. */
  private closingForSwitch: string | null = null;

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
    if (target && target.streamId === streamId && connection !== "idle") {
      // The same room: a remount, Back/Forward, Strict Mode. Never a second
      // connection — and never out of a terminal state either, which only the
      // reader's explicit dismissal clears.
      if (target.role === role || isTerminal(connection)) return Promise.resolve();
      // The same room as SOMEBODY ELSE: an account that resolved as a listener
      // for a beat and turned out to be the host. Frozen, they would sit in
      // their own room with no publish grant until they left and came back.
      return this.replace({ streamId, role }, options);
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

  /**
   * "Leave A and join B?" — yes. A is disconnected and unregistered before B
   * connects. When the reader is A's HOST, A is closed for everyone first:
   * a host who walks out of a live room leaves a room with nobody running it.
   * A close that fails throws, and nothing moves — the question stays open.
   */
  async confirmConflict(): Promise<void> {
    const pending = this.state.pending;
    if (!pending || this.closingForSwitch !== null) return;
    const from = this.state.target;
    if (from?.role === "host") {
      const closed = await this.closeHostRoom(from.streamId);
      if (!closed) return;
      // Answered or overtaken while the room was closing (Stay there, a
      // Leave, a logout): nothing more to switch to, and the room A view is
      // told it is over — its own ending was ignored while it closed.
      const still = this.state.pending;
      if (!still || still.streamId !== pending.streamId || still.role !== pending.role) {
        if (this.state.target?.streamId === from.streamId) this.onRoomEnded();
        return;
      }
    }
    const options = this.pendingOptions;
    this.pendingOptions = undefined;
    const disconnected = this.teardown();
    const tornDown = this.generation;
    this.dispatch({ type: "reset" });
    await disconnected;
    // A logout, a Leave or another switch while the old room was disconnecting
    // wins: joining now would put a signed-out browser in the new room.
    if (tornDown !== this.generation) return;
    this.preferredMic = options?.preferredMic;
    await this.connect(pending, { token: options?.token, resumed: !options?.fresh });
  }

  /**
   * "Stay there", or the asking view going away. Given a room id, only a
   * question about THAT room is cleared — a view unmounting must not dismiss
   * a question another view has since asked.
   */
  dismissConflict(streamId?: string) {
    const pending = this.state.pending;
    if (!pending) return;
    if (streamId !== undefined && pending.streamId !== streamId) return;
    this.pendingOptions = undefined;
    this.dispatch({ type: "conflict-dismissed" });
  }

  /**
   * Make way for a room that is not entered through `enter` — the host's own
   * Backstage, which must not go live on B while the tab still holds A.
   * A HOST's held room is closed for everyone first (a rejection throws, and
   * the host stays in it); anybody else simply leaves.
   */
  async vacate(): Promise<void> {
    const target = this.state.target;
    if (!target) return;
    if (target.role === "host" && isHolding(this.state.connection)) {
      if (this.closingForSwitch !== null) return;
      const closed = await this.closeHostRoom(target.streamId);
      if (!closed) return;
    }
    await this.stop();
  }

  /**
   * The end-stream call for a switch. True when the room is closed and the
   * session still stands where it did; false when a Leave, a logout or
   * another switch overtook it (nothing more to do). Throws when the close
   * itself failed.
   */
  private async closeHostRoom(streamId: string): Promise<boolean> {
    this.closingForSwitch = streamId;
    try {
      await this.deps.closeRoom(streamId);
    } finally {
      this.closingForSwitch = null;
    }
    return this.state.target?.streamId === streamId && isHolding(this.state.connection);
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

  /**
   * Tab close. Synchronous by necessity — `pagehide` does not wait.
   *
   * The state goes to idle with the Room: a page restored from the back/forward
   * cache would otherwise come back reading "live" over no connection, and
   * `enter(sameId)` is a no-op out of a held state, so nothing could rejoin.
   * The rejoin record is the provider's and survives, so the restored page
   * offers "Tap to rejoin" instead.
   */
  pageHide() {
    const target = this.state.target;
    if (!target || !isHolding(this.state.connection)) return;
    this.deps.sendLeaveBeacon(target.streamId, this.sessionId);
    this.teardown();
    this.dispatch({ type: "reset" });
  }

  private async stop(): Promise<void> {
    const target = this.state.target;
    if (target && isHolding(this.state.connection)) {
      this.deps.sendLeaveBeacon(target.streamId, this.sessionId);
    }
    // Even with nothing held: a connect waiting on an await (a "Leave and
    // join" mid-disconnect) compares the generation, and this bump is what
    // tells it the reader has since left or signed out.
    // Idle at once, so nothing reads a session that is on its way out; the
    // disconnect is still awaited for the callers that navigate after it.
    const disconnected = this.teardown();
    this.dispatch({ type: "reset" });
    await disconnected;
  }

  /* ---- signals from the room ------------------------------------------ */

  onDisconnected(kind: DisconnectKind) {
    if (!this.current) return;
    // The host's own room closing under a switch: the switch tears it down.
    if (kind === "room-deleted" && this.closingForSwitch === this.state.target?.streamId) return;
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
        this.fail(null);
    }
  }

  /** The stream poll says the room is over — the same end as ROOM_DELETED, from the other source. */
  onRoomEnded() {
    if (!this.state.target || isTerminal(this.state.connection)) return;
    if (this.closingForSwitch === this.state.target.streamId) return;
    this.teardown();
    this.dispatch({ type: "ended", reason: "room-ended" });
  }

  /**
   * The reader's Retry on a failed room: a fresh token, a new Room. An open
   * "join another room?" question stays open — the Retry is about the room
   * the reader is in, not an answer to the question about the other one.
   */
  retry(): Promise<void> {
    const { target, connection } = this.state;
    if (!target || connection !== "failed") return Promise.resolve();
    this.retryAttempt = 0;
    return this.connect(target, { resumed: true, keepPending: true });
  }

  /**
   * The network is back (`online`), or the tab is in view again. A failed room
   * retries NOW, with the backoff started over — this is the moment a retry is
   * most likely to work.
   */
  onNetworkBack(): Promise<void> {
    if (this.state.connection !== "failed" || this.state.pending) return Promise.resolve();
    this.cancelRetry();
    return this.retry();
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
    await this.replace(target, undefined);
  }

  /* ---- internals ------------------------------------------------------- */

  /**
   * Break-then-make onto `target`: the held Room is dropped and its disconnect
   * awaited, then the new one connects — unless anything else happened to the
   * session in between (a Leave, a logout, the room ending), which wins.
   */
  private async replace(target: SessionTarget, options: EnterOptions | undefined) {
    const disconnected = this.teardown();
    const tornDown = this.generation;
    await disconnected;
    if (tornDown !== this.generation) return;
    if (options?.preferredMic !== undefined) this.preferredMic = options.preferredMic;
    await this.connect(target, { token: options?.token, resumed: !options?.fresh });
  }

  private async connect(
    target: SessionTarget,
    options: { token?: SessionToken; resumed: boolean; keepPending?: boolean }
  ) {
    // One Room at a time, even against a connect still in flight: its Room is
    // dropped here rather than left connected and audible behind this one.
    if (this.current) void this.teardown();
    this.cancelRetry();
    const generation = ++this.generation;
    this.dispatch({ type: "connect", target, keepPending: options.keepPending });

    let token = options.token;
    if (!token) {
      try {
        token = await this.deps.fetchToken(target);
      } catch (error) {
        if (generation !== this.generation) return;
        this.fail(messageOf(error));
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
      this.fail(messageOf(error));
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
      this.fail(messageOf(error));
      return;
    }
    if (generation !== this.generation) return;
    this.retryAttempt = 0;
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

  /** Into `failed`, with the next automatic retry scheduled. */
  private fail(error: string | null) {
    this.dispatch({ type: "failed", error });
    if (this.state.connection === "failed") this.scheduleRetry();
  }

  private scheduleRetry() {
    this.cancelRetry();
    const delay = RETRY_DELAYS_MS[this.retryAttempt];
    if (delay === undefined) {
      this.dispatch({ type: "retries-exhausted" });
      return;
    }
    this.retryTimer = this.deps.clock.setTimeout(() => {
      this.retryTimer = null;
      if (this.state.connection !== "failed") return;
      // A "join another room?" question is open: connecting now would answer
      // it for the reader. Ask again after the same wait.
      if (this.state.pending) {
        this.scheduleRetry();
        return;
      }
      this.retryAttempt += 1;
      const target = this.state.target;
      if (target) void this.connect(target, { resumed: true });
    }, delay);
  }

  private cancelRetry() {
    if (this.retryTimer !== null) this.deps.clock.clearTimeout(this.retryTimer);
    this.retryTimer = null;
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
    // At once, as the stream player's heartbeat does: the room counts the
    // reader from the moment they are in it, not 15 s later.
    beat();
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
    this.cancelRetry();
    const room = this.current;
    const target = this.state.target;
    this.current = null;
    // The token belonged to the Room being dropped. Kept, its caption URL was
    // handed to the next room's page while that one connected or failed.
    this.latestToken = null;
    this.unlisten?.();
    this.unlisten = null;
    if (!room) return Promise.resolve();
    if (target) this.deps.unregister(target.streamId, room.handle);
    return room.disconnect().catch(() => undefined);
  }

  /** The token the held room is connecting or connected with, or null. */
  get token(): SessionToken | null {
    return this.latestToken;
  }

  /** The held room's caption stream — only while that room is actually live. */
  get captionUrl(): string | null {
    if (this.state.connection !== "live") return null;
    return this.latestToken?.captionUrl ?? null;
  }
}

function messageOf(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}
