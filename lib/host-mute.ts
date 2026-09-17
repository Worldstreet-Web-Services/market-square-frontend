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
 *    really is muted — the attribute outlives the speaker's own unmute, and a
 *    badge saying the host silenced somebody who is talking is a lie.
 *
 * Pure, so `lib/host-mute.test.ts` pins it.
 */

/** The participant attribute the service sets. */
export const HOST_MUTED_ATTRIBUTE = "hostMuted";

export const HOST_MUTE_TOAST = "The host muted your mic. You can unmute when it's your turn.";

export type HostMuteAttribute = "none" | "soft";

/** Read the attribute. Anything but `soft` is no host mute. */
export function hostMuteOf(attributes: Readonly<Record<string, string>> | null | undefined): HostMuteAttribute {
  return attributes?.[HOST_MUTED_ATTRIBUTE] === "soft" ? "soft" : "none";
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
  /** A mute was seen and has not been told yet. */
  armed: boolean;
  lastToastAt: number | null;
}

export const INITIAL_HOST_MUTE_TOAST: HostMuteToastState = { previous: null, armed: false, lastToastAt: null };

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
 *    mic really is off. It is also the only way a SECOND mute is noticed: the
 *    attribute stays `soft` after the speaker unmutes themselves.
 *
 * Armed waits for the mic to go off, so an attribute that lands before the
 * track mute still toasts. One mute, one toast: a second arming inside the
 * dedupe window is the same mute seen twice.
 */
export function stepHostMuteToast(
  state: HostMuteToastState,
  input: { current: HostMuteAttribute; micOn: boolean; signalled: boolean; now: number }
): { state: HostMuteToastState; toast: boolean } {
  if (state.previous === null && !input.signalled) {
    return { state: { ...state, previous: input.current, armed: false }, toast: false };
  }
  let armed = state.armed || input.signalled || (state.previous === "none" && input.current === "soft");
  // The mute was lifted before we could say anything: nothing to say.
  if (state.previous === "soft" && input.current === "none") armed = false;
  const recent = state.lastToastAt !== null && input.now - state.lastToastAt < MUTE_TOAST_DEDUPE_MS;
  if (armed && recent && input.current === "soft") {
    return { state: { ...state, previous: input.current, armed: false }, toast: false };
  }
  const toast = armed && input.current === "soft" && !input.micOn;
  return {
    state: {
      previous: input.current,
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
