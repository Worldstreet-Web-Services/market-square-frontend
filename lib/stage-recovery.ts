/**
 * What a guest who has been APPROVED but is not visibly on stage should be
 * offered.
 *
 * The bug this exists for, in the reporter's words: "when guest join and
 * something happen they cant see there self in the live stream and they want
 * to send request it — i have to leave stage when i was in stage already so
 * even though i was not on stage so i must have leave stage and send request
 * again."
 *
 * The cause was a category error. "On stage" was read off the speaker-request
 * ROW — a record of the host tapping Accept — and the row is not evidence that
 * this browser ever acquired a camera, ever got a publish grant, or is
 * currently sending anything. So the panel confidently offered "Leave stage"
 * to someone who was never on one, and the only route back to "Request to
 * join" was to leave a stage they were not on. The state was a dead end with a
 * misleading exit.
 *
 * Two facts, kept apart here on purpose:
 *
 *   status  — what the HOST decided (the row).
 *   state   — what this CONNECTION is actually doing (LiveKit).
 *
 * On stage means BOTH: approved and publishing. Everything else is named and
 * given a way out.
 */

/** The speaker-request lifecycle, exactly as the backend spells it. */
export type SpeakerRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "withdrawn"
  | "removed";

/** Where this browser's attempt to publish has got to. See hooks/use-stage.ts. */
export type StageState =
  | "idle"
  /** Approved, but the viewer connection is not up yet — nothing to upgrade. */
  | "waiting-for-room"
  /** Approved, connected, but LiveKit has not said we may publish yet. */
  | "awaiting-grant"
  | "starting"
  | "live"
  /** NotAllowedError / SecurityError — permission actually refused. */
  | "denied"
  /** NotReadableError / TrackStartError — device held by another app or tab. */
  | "device-busy"
  /** NotFoundError / OverconstrainedError — nothing matches the constraints. */
  | "device-missing"
  /** The server has not granted publish permission (yet). */
  | "not-permitted"
  /**
   * We waited out {@link STAGE_STALL_MS} for a grant or a room that never
   * arrived. NOT a device problem: the connection this guest holds is not the
   * one that was granted, so no amount of retrying `getUserMedia` will help.
   * The remedy is a fresh token on a fresh connection.
   */
  | "grant-stalled"
  | "failed";

/**
 * States that are over: nothing further will happen on its own, so the panel
 * must show a remedy rather than a spinner. Without this the guest watched an
 * animated dot forever, which is the exact experience being reported.
 */
export const STAGE_FAILURES: readonly StageState[] = [
  "denied",
  "device-busy",
  "device-missing",
  "not-permitted",
  "grant-stalled",
  "failed",
];

/**
 * How long "connecting" is allowed to look like connecting.
 *
 * Long enough to cover an honest slow path — the host's approve call, LiveKit
 * reissuing our token, `ParticipantPermissionsChanged` arriving — and short
 * enough that nobody sits in front of an audience wondering. Twelve seconds is
 * roughly three times the worst grant round-trip we see and well inside the
 * span where a person is still willing to wait rather than reload the page.
 */
export const STAGE_STALL_MS = 12_000;

/** Something the panel can offer to do. */
export type StageAction =
  /** POST a new speaker request. */
  | "request"
  /** Re-run the local device acquisition. Fixes a camera that was busy. */
  | "retry"
  /**
   * Get a fresh playback token and reconnect. Fixes a MISSING GRANT — the case
   * where the row says approved and the media plane disagrees.
   */
  | "rejoin"
  /**
   * The escape hatch the reporter had to perform by hand: withdraw the stale
   * approval AND ask again, in one tap. Present wherever the guest might
   * reasonably prefer to start over rather than debug.
   */
  | "request-again"
  /** Step down. Only offered when stepping down is actually what they want. */
  | "leave";

export interface StagePanel {
  /**
   * `live` is the ONLY value that means on stage, and it is reachable only
   * from a real publishing state.
   */
  kind: "request" | "waiting" | "connecting" | "live" | "recover";
  /** What to tell the guest. Never "something went wrong". */
  message: string;
  /** Ordered, most useful first. The first entry is the panel's primary. */
  actions: readonly StageAction[];
}

/**
 * The one honest sentence for a stage state.
 *
 * `error` is the underlying browser/LiveKit message where we have one; it is
 * appended rather than replacing our own text, because a raw DOMException is
 * not an instruction and our text is.
 */
export function stageMessage(state: StageState, error: string | null): string {
  switch (state) {
    case "live":
      return "You're on stage.";
    case "waiting-for-room":
      return "Connecting to the stream…";
    case "awaiting-grant":
      return "The host approved you — waiting for the stage to open your mic…";
    case "starting":
      return "Putting you on stage…";
    case "grant-stalled":
      // Says what is true and what to press. The old copy for this case was
      // the awaiting-grant spinner, forever.
      return "The host approved you, but this connection never got the mic. Rejoin the stage to pick the approval up.";
    case "not-permitted":
      return error ?? "The host hasn't finished bringing you on stage yet.";
    case "denied":
      return "Camera and microphone access is blocked. Allow it in your browser settings, then try again.";
    case "device-busy":
      return "Your camera or microphone is in use by another app or browser tab. Close it and try again.";
    case "device-missing":
      return "No camera or microphone found. Connect one, or check another app is not holding it, then try again.";
    case "failed":
      return error ?? "Couldn't put you on stage.";
    case "idle":
    default:
      return "";
  }
}

/**
 * The whole panel decision, from the two facts that matter.
 *
 * Pure and exported so the rule is testable — the regression this fixes is a
 * rule about which button appears, and a rule you cannot assert is a rule that
 * comes back.
 */
export function guestStagePanel({
  status,
  state,
  error = null,
}: {
  /** The caller's own speaker request, or null when they have never asked. */
  status: SpeakerRequestStatus | null;
  /** What this browser is actually doing. */
  state: StageState;
  error?: string | null;
}): StagePanel {
  // Terminal request states are as good as no request: the guest may ask
  // again. (These names are the backend's — "declined"/"left" were invented
  // once and locked people out.)
  if (status === null || status === "denied" || status === "withdrawn" || status === "removed") {
    return {
      kind: "request",
      message: "The host can bring you on stage. Your camera and microphone only start after approval.",
      actions: ["request"],
    };
  }

  if (status === "pending") {
    return {
      kind: "waiting",
      message: "You can keep watching. This panel updates automatically.",
      actions: [],
    };
  }

  // Approved. Now — and only now — does what the connection is doing decide.
  if (state === "live") {
    return { kind: "live", message: stageMessage(state, error), actions: ["leave"] };
  }

  const message = stageMessage(state, error);

  // A local capture problem. Retrying the devices is the fix that matches the
  // cause, so it leads; but the guest is never trapped, so starting over and
  // stepping down are both still there.
  if (state === "denied" || state === "device-busy" || state === "device-missing" || state === "failed") {
    return { kind: "recover", message, actions: ["retry", "request-again", "leave"] };
  }

  // A GRANT problem: approved, but this connection cannot publish. Retrying
  // getUserMedia would succeed and still change nothing, so the primary is a
  // fresh token on a fresh connection.
  if (state === "not-permitted" || state === "grant-stalled") {
    return { kind: "recover", message, actions: ["rejoin", "request-again", "leave"] };
  }

  // Genuinely still in flight, and there is nothing useful to press yet: this
  // resolves on its own within STAGE_STALL_MS or becomes `grant-stalled`,
  // which has real remedies. Offering "Leave stage" as the ONLY button during
  // this window is the thing being fixed — it is not an action on a stage the
  // guest is on, it is the sole exit from a spinner, and it reads as the app
  // insisting they are somewhere they can plainly see they are not.
  return {
    kind: "connecting",
    // Never an empty paragraph: an unnamed state is how this looked to the
    // person reporting it.
    message: message || "Putting you on stage…",
    actions: [],
  };
}
