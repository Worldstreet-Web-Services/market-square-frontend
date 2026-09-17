/**
 * MAY BACKSTAGE GO LIVE NOW, OR MUST IT ASK FIRST?
 *
 * Opening a room from Backstage calls go-live on it BEFORE the session ever
 * hears of it — so the session's own "join another room?" question came too
 * late: a host still holding room A who opened room B had already made B live,
 * and "Stay there" left B live with nobody in it. The question is asked here,
 * before go-live, whenever the tab holds a DIFFERENT room (in any held state,
 * failed included: a failed room is still the reader's).
 *
 * Pure, pinned in lib/room-session.test.ts.
 */
import { isHolding, type SessionState } from "./reducer.ts";

export type BackstageOpenStep = "go-live" | "ask";

export function backstageOpenStep(state: SessionState, streamId: string): BackstageOpenStep {
  const held = state.target;
  if (held && held.streamId !== streamId && isHolding(state.connection)) return "ask";
  return "go-live";
}
