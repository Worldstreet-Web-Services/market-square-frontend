/**
 * WHO IS ON THE STAGE — and what an approved speaker who is not is offered.
 *
 * Presence used to be `approved && stage.state === "live"`. A speaker whose
 * tap to talk failed (a dismissed permission prompt, a mic held by another
 * app) left `live` for `denied` or `device-busy`, and with it the stage: the
 * room view took the mic away, offered "Ask to speak" to somebody already
 * approved, and the zone-exit guard stopped treating them as a speaker —
 * with nothing on screen to try again. A capture failure is not the host
 * taking the seat back. Seated means the approval AND this connection's grant
 * to publish the mic, whatever the last tap did.
 *
 * Pure, pinned in lib/room-session.test.ts.
 */
import { guestStagePanel, type StagePanel, type StageState } from "../stage-recovery.ts";
import type { SessionRole, SessionStatus } from "./reducer.ts";

/** The states in which a granted speaker is on the stage, the mic on, off, or refused. */
const SEATED: ReadonlySet<StageState> = new Set<StageState>([
  "live",
  "starting",
  "denied",
  "device-busy",
  "device-missing",
  "failed",
]);

export function stagePresence({
  role,
  approved,
  stageState,
  canPublishMic,
}: {
  /** The session's role, or null with no session. */
  role: SessionRole | null;
  /** The reader's speaker request is approved. */
  approved: boolean;
  stageState: StageState;
  /** This connection's grant includes the microphone. */
  canPublishMic: boolean;
}): "host" | "speaker" | "listener" | null {
  if (role === null) return null;
  if (role === "host") return "host";
  return approved && canPublishMic && SEATED.has(stageState) ? "speaker" : "listener";
}

/**
 * THE STAGE PANEL IN THE ROOM VIEW, for an approved speaker who is not simply
 * seated: the grant on its way (a line), the grant never landing (Rejoin —
 * a fresh token on a fresh connection), or the mic refusing to open (Try
 * again). The session wired these remedies and nothing ever drew them.
 *
 * Only in the room the session is IN, only while it is connected, never for
 * the host (whose own publish failure has its own banner).
 */
export function roomStagePanel({
  here,
  isHost,
  status,
  connection,
  stageState,
  error,
}: {
  here: boolean;
  isHost: boolean;
  /** The reader's own request status — any string the service sends; only `approved` draws. */
  status: string | null;
  connection: SessionStatus;
  stageState: StageState;
  error: string | null;
}): StagePanel | null {
  if (!here || isHost || status !== "approved" || connection !== "live") return null;
  const panel = guestStagePanel({ status: "approved", state: stageState, error });
  return panel.kind === "recover" || panel.kind === "connecting" ? panel : null;
}
