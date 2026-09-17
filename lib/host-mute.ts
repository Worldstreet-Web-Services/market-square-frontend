/**
 * THE HOST'S MUTE — soft, and only soft.
 *
 * `POST /streams/:id/speakers/:userId/mute` mutes the speaker's MICROPHONE
 * track on the server and sets the participant attribute `hostMuted='soft'`.
 * The speaker may unmute themselves the moment they have something to say.
 * The product owner's rules (2026-09-17), all held here:
 *
 *  · there is no lock and no host unmute — the escalation is "Move down to
 *    audience", which already exists;
 *  · nobody can mute the host;
 *  · the listener's own tool is "Mute for me only", a different act entirely
 *    (lib/muted-for-me, client-local, nobody told);
 *  · "Muted by host" is drawn only while the attribute is set AND the mic
 *    has stayed muted since the host's mute — the attribute outlives the
 *    speaker's own unmute, so a badge read off the attribute alone was drawn
 *    again the next time they muted THEMSELVES (`stepHostMuteBadges`).
 *
 * BACKEND DEPENDENCY: the service should clear `hostMuted` when the speaker
 * unmutes (track_unmuted) and on demotion, and write a new value per mute
 * (`soft:<ts>`), so a second mute is news without the push. The client reads
 * both shapes today.
 *
 * WHAT IS NOT SUPPORTED UNTIL THEN: with the attribute a constant `soft`, a
 * SECOND mute (the speaker unmuted themselves, the host muted them again) is
 * only announced through the `speakerMuted` push on `user:<did>`. That push
 * needs the ws-gateway configured (`NEXT_PUBLIC_MS_WS_GATEWAY_URL`) and the
 * shared socket authenticated with the reader's token
 * (lib/ws-gateway-shared.ts). Without the gateway, or while the socket is
 * down, the second mute still mutes and the badge still shows, but the
 * speaker gets no toast until the service writes `soft:<ts>`.
 *
 * Pure, so `lib/host-mute.test.ts` pins it.
 */

/** The participant attribute the service sets. */
export const HOST_MUTED_ATTRIBUTE = "hostMuted";

export const HOST_MUTE_TOAST = "The host muted your mic. You can unmute when it's your turn.";

export type HostMuteAttribute = "none" | "soft";

/** The attribute's raw value, "" when unset: a change in it is a new mute. */
export function hostMuteToken(attributes: Readonly<Record<string, string>> | null | undefined): string {
  return attributes?.[HOST_MUTED_ATTRIBUTE] ?? "";
}

/** Read the attribute. `soft`, or `soft:<anything>` (one value per mute), is a host mute. */
export function hostMuteOf(attributes: Readonly<Record<string, string>> | null | undefined): HostMuteAttribute {
  const value = hostMuteToken(attributes);
  return value === "soft" || value.startsWith("soft:") ? "soft" : "none";
}

export interface HostMuteBadgeSeat {
  identity: string;
  /** `hostMuteToken` of the seat's attributes. */
  token: string;
  /** A microphone publication exists. */
  published: boolean;
  micMuted: boolean;
}

export interface HostMuteBadgeState {
  token: string;
  /** The mic has been seen muted under this mute. */
  sawMuted: boolean;
  /** …and then seen on: the speaker unmuted themselves, so this mute is spent. */
  lifted: boolean;
}

/**
 * The "Muted by host" badge on every seat, one reading at a time.
 *
 * Per identity, remember whether the speaker has unmuted since the host's
 * mute (the attribute's current value). A new value is a new mute and starts
 * over. No microphone publication is never a badge: a speaker moved down and
 * seated again has not published yet, and the host muted nothing of theirs.
 * A seat no longer present is forgotten. What cannot be told apart — somebody
 * who unmuted before this viewer arrived and has since muted themselves — is
 * the backend's to fix by clearing the attribute on unmute.
 */
export function stepHostMuteBadges(
  memory: ReadonlyMap<string, HostMuteBadgeState>,
  seats: readonly HostMuteBadgeSeat[]
): { memory: Map<string, HostMuteBadgeState>; badges: Map<string, boolean> } {
  const next = new Map<string, HostMuteBadgeState>();
  const badges = new Map<string, boolean>();
  for (const seat of seats) {
    if (hostMuteOf({ [HOST_MUTED_ATTRIBUTE]: seat.token }) !== "soft") {
      badges.set(seat.identity, false);
      continue;
    }
    const mutedNow = seat.published && seat.micMuted;
    const previous = memory.get(seat.identity);
    let state: HostMuteBadgeState =
      previous && previous.token === seat.token ? { ...previous } : { token: seat.token, sawMuted: false, lifted: false };
    if (mutedNow) state = { ...state, sawMuted: true };
    else if (seat.published && state.sawMuted) state = { ...state, lifted: true };
    next.set(seat.identity, state);
    badges.set(seat.identity, mutedNow && !state.lifted);
  }
  return { memory: next, badges };
}

/** The seat's "Muted by host" badge. */
export function mutedByHost(
  attributes: Readonly<Record<string, string>> | null | undefined,
  micMuted: boolean
): boolean {
  return micMuted && hostMuteOf(attributes) === "soft";
}

export type HostMuteControl =
  | { kind: "hidden" }
  | { kind: "mute"; disabled: false; label: string }
  | { kind: "mute"; disabled: true; label: string; reason: string };

export const HOST_MUTE_LABEL = "Mute for everyone";

export function hostMuteControl(input: {
  viewerIsHost: boolean;
  /** The target is on a seat. */
  seated: boolean;
  /** The target is the room's host. */
  targetIsHost: boolean;
  /** The target is the viewer. */
  isSelf: boolean;
  /** The target's microphone publication is muted, or absent. */
  micMuted: boolean;
  /** The mute route answered "not deployed" this page load. */
  unavailable: boolean;
}): HostMuteControl {
  if (!input.viewerIsHost || !input.seated || input.targetIsHost || input.isSelf || input.unavailable) {
    return { kind: "hidden" };
  }
  if (input.micMuted) {
    return { kind: "mute", disabled: true, label: HOST_MUTE_LABEL, reason: "Their mic is already off." };
  }
  return { kind: "mute", disabled: false, label: HOST_MUTE_LABEL };
}

/** How close a push signal and an attribute change must be to count as one mute. */
export const MUTE_TOAST_DEDUPE_MS = 5_000;

export interface HostMuteToastState {
  /** The attribute at the last reading; null before the first one on this connection. */
  previous: HostMuteAttribute | null;
  /** Its raw value at the last reading: a new value is a new mute. */
  previousToken?: string | null;
  /** A mute was seen and has not been told yet. */
  armed: boolean;
  lastToastAt: number | null;
}

export const INITIAL_HOST_MUTE_TOAST: HostMuteToastState = { previous: null, previousToken: null, armed: false, lastToastAt: null };

/**
 * Should the speaker be told the host muted them? One step per reading.
 *
 * Two ways a mute reaches this tab, in either order, and the track's own mute
 * may land a beat after both:
 *
 *  · the attribute turning to `soft` on our own participant (LiveKit, and so
 *    authoritative) — but the FIRST reading on a connection is the room as we
 *    found it, not something that just happened, so it seeds silently. A
 *    reconnect starts again from `INITIAL_HOST_MUTE_TOAST`, so its replay of
 *    `soft` is not news either;
 *  · the `speakerMuted` push, which is a signal to LOOK, never a fact. It arms
 *    the toast, which fires only once the attribute really is `soft` and the
 *    mic really is off. With a constant `soft` it is also the only way a
 *    SECOND mute is noticed (the attribute stays `soft` after the speaker
 *    unmutes themselves); a service that writes a new value per mute
 *    (`soft:<ts>`) makes the attribute change itself the news.
 *
 * Armed waits for the mic to go off, so an attribute that lands before the
 * track mute still toasts. One mute, one toast: a second arming inside the
 * dedupe window is the same mute seen twice.
 */
export function stepHostMuteToast(
  state: HostMuteToastState,
  input: { current: HostMuteAttribute; token?: string; micOn: boolean; signalled: boolean; now: number }
): { state: HostMuteToastState; toast: boolean } {
  const token = input.token ?? (input.current === "soft" ? "soft" : "");
  if (state.previous === null && !input.signalled) {
    return { state: { ...state, previous: input.current, previousToken: token, armed: false }, toast: false };
  }
  const newValue =
    input.current === "soft" && state.previous !== null && (state.previous === "none" || (state.previousToken ?? "soft") !== token);
  let armed = state.armed || input.signalled || newValue;
  // The mute was lifted before we could say anything: nothing to say.
  if (state.previous === "soft" && input.current === "none") armed = false;
  const recent = state.lastToastAt !== null && input.now - state.lastToastAt < MUTE_TOAST_DEDUPE_MS;
  if (armed && recent && input.current === "soft") {
    return { state: { ...state, previous: input.current, previousToken: token, armed: false }, toast: false };
  }
  const toast = armed && input.current === "soft" && !input.micOn;
  return {
    state: {
      previous: input.current,
      previousToken: token,
      armed: toast ? false : armed,
      lastToastAt: toast ? input.now : state.lastToastAt,
    },
    toast,
  };
}

/** What the host is told when a mute did not go through (an undeployed route is `routeMissing`, and says nothing). */
export function muteErrorMessage(error: { code?: string | null } | null | undefined, name?: string | null): string {
  const who = name?.trim() || "them";
  switch (error?.code) {
    case "STREAM_NOT_LIVE":
      return "The gist room isn't live.";
    case "FORBIDDEN":
      return "Only the host can mute a speaker.";
    case "NOT_FOUND":
    case "NOT_A_SPEAKER":
      return `${who === "them" ? "They're" : `${who} is`} not on the stage any more.`;
    case "TOO_MANY_REQUESTS":
    case "RATE_LIMITED":
      return "Too many mutes at once. Try again in a moment.";
    default:
      return `Couldn't mute ${who}.`;
  }
}
