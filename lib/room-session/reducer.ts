/**
 * ONE ROOM PER TAB — the session's state, as a pure reducer.
 *
 * A gist room used to live and die with its route: `LiveHouse` opened the
 * LiveKit connection in an effect, so pressing Back, opening a DM or tapping a
 * profile unmounted the component and hung up the call. The session now
 * belongs to the SHELL (`components/layout/room-session.tsx`), and this file
 * is the part of it that can be reasoned about without a browser: which state
 * the tab is in, and which transitions are legal.
 *
 *   idle → connecting → live ⇄ reconnecting
 *                        ↘ ended | duplicate | failed
 *   (any active state) → conflict → (confirm) connecting | (dismiss) back
 *
 * No React, no livekit-client. `lib/room-session.test.ts` drives it.
 */

/** Who this tab is in the room. Anonymous listening is backend-dependent and not in this build. */
export type SessionRole = "host" | "speaker" | "listener";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  /** The room is over for us: the host closed it, or we were removed. Shown, then dismissed. */
  | "ended"
  /**
   * Another connection joined with our identity and the server evicted us.
   * TERMINAL: reconnecting would evict that one back, and retrying IS the
   * eviction loop. The mini-player says "Playing in another tab".
   */
  | "duplicate"
  | "failed"
  /** Live in one room and asked to enter another — waiting for the reader to choose. */
  | "conflict";

/** Why a session ended without the reader asking, or how they asked. */
export type EndReason = "left" | "closed" | "room-ended" | "removed" | "logout";

/**
 * A LiveKit disconnect, normalised. The SDK's `DisconnectReason` is a numeric
 * protobuf enum; the provider hands its NAME to `classifyDisconnect` so this
 * module never imports the SDK.
 */
export type DisconnectKind =
  | "duplicate-identity"
  | "room-deleted"
  | "participant-removed"
  | "client-initiated"
  | "other";

export interface SessionTarget {
  streamId: string;
  role: SessionRole;
}

/** What a connection is doing, independent of any pending "join another room?" question. */
type ConnectionStatus = Exclude<SessionStatus, "conflict">;

export interface SessionState {
  /** `conflict` while a question is open, otherwise the connection's own status. */
  status: SessionStatus;
  connection: ConnectionStatus;
  /** The room this tab is in (or was in, for ended/duplicate/failed). */
  target: SessionTarget | null;
  /** The room the reader asked to enter while already in `target`. */
  pending: SessionTarget | null;
  endReason: EndReason | null;
  error: string | null;
}

export const IDLE_SESSION: SessionState = {
  status: "idle",
  connection: "idle",
  target: null,
  pending: null,
  endReason: null,
  error: null,
};

export type SessionAction =
  | { type: "connect"; target: SessionTarget }
  | { type: "conflict"; pending: SessionTarget }
  | { type: "conflict-dismissed" }
  | { type: "connected" }
  | { type: "reconnecting" }
  | { type: "reconnected" }
  | { type: "failed"; error: string | null }
  | { type: "duplicate" }
  | { type: "ended"; reason: EndReason }
  | { type: "reset" };

function settle(state: Omit<SessionState, "status">): SessionState {
  return { ...state, status: state.pending ? "conflict" : state.connection };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "connect":
      return settle({
        connection: "connecting",
        target: action.target,
        pending: null,
        endReason: null,
        error: null,
      });
    case "conflict":
      // Only meaningful while a room is actually held.
      if (!state.target || !isHolding(state.connection)) return state;
      return settle({ ...state, pending: action.pending });
    case "conflict-dismissed":
      return settle({ ...state, pending: null });
    case "connected":
    case "reconnected":
      if (!state.target || isTerminal(state.connection)) return state;
      return settle({ ...state, connection: "live", error: null });
    case "reconnecting":
      if (state.connection !== "live") return state;
      return settle({ ...state, connection: "reconnecting" });
    case "failed":
      if (!state.target || isTerminal(state.connection)) return state;
      return settle({ ...state, connection: "failed", error: action.error });
    case "duplicate":
      if (!state.target) return state;
      return settle({ ...state, connection: "duplicate", pending: null });
    case "ended":
      if (!state.target) return state;
      return settle({
        ...state,
        connection: "ended",
        endReason: action.reason,
        pending: null,
      });
    case "reset":
      return IDLE_SESSION;
  }
}

/** A state nothing but the reader can move on from. No reconnect is ever scheduled out of these. */
export function isTerminal(status: SessionStatus): boolean {
  return status === "ended" || status === "duplicate";
}

/** A room is held: the tab is in it, or trying to be. */
export function isHolding(status: SessionStatus): boolean {
  return status === "connecting" || status === "live" || status === "reconnecting" || status === "failed";
}

/**
 * The SDK's reason NAME → what it means for the session.
 *
 * `DisconnectReason[reason]` gives `"DUPLICATE_IDENTITY"` and so on. Anything
 * unrecognised is `other`, which is a failure the reader can retry — never a
 * terminal state, because a terminal state guessed wrong strands them.
 */
export function classifyDisconnect(name: string | null | undefined): DisconnectKind {
  switch (name) {
    case "DUPLICATE_IDENTITY":
      return "duplicate-identity";
    case "ROOM_DELETED":
    case "ROOM_CLOSED":
      return "room-deleted";
    case "PARTICIPANT_REMOVED":
      return "participant-removed";
    case "CLIENT_INITIATED":
      return "client-initiated";
    default:
      return "other";
  }
}
