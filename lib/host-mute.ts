/**
 * THE HOST'S MUTE — soft, and only soft.
 *
 * `POST /streams/:id/speakers/:userId/mute` mutes the speaker's MICROPHONE
 * track on the server and sets the participant attribute `hostMuted`. The
 * agreed contract said `'soft'`; the service writes `'true'` and clears the
 * attribute (an empty value) when the speaker is seated again, removed or
 * leaves. So ANY value set, other than an explicit false, is a host mute
 * (`hostMuteOf`) — reading only `soft` meant no seat ever showed "Muted by
 * host" and the speaker was never told.
 * The speaker may unmute themselves the moment they have something to say.
 * The product owner's rules (2026-09-17), all held here:
 *
 *  · there is no lock and no host unmute — the escalation is "Move down to
 *    audience", which already exists;
 *  · nobody can mute the host;
 *  · the listener's own tool is "Mute for me only", a different act entirely
 *    (lib/muted-for-me, client-local, nobody told);
 *  · "Muted by host" is drawn while the attribute is set AND the mic is muted
 *    (`stepHostMuteBadges`).
 *
 * WHAT A CONSTANT VALUE CANNOT TELL. The attribute outlives the speaker's own
 * unmute. With one value for every mute (`'true'`, `'soft'`), a speaker who
 * unmuted and later muted THEMSELVES looks exactly like one the host muted a
 * second time. The badge follows the product rule and shows for both: hiding
 * a real second mute from the room is the worse lie. Only a value that
 * changes per mute (`soft:<ts>`) lets the badge remember that this mute was
 * already spent. BACKEND DEPENDENCY: clear `hostMuted` on track_unmuted, or
 * write a new value per mute, and the self-mute is no longer badged.
 *
 * The speaker's toast: a first mute is told off the attribute changing; a
 * SECOND mute under a constant value only through the `speakerMuted` push on
 * `user:<did>`, which needs the ws-gateway configured
 * (`NEXT_PUBLIC_MS_WS_GATEWAY_URL`) and the shared socket authenticated with
 * the reader's token (lib/ws-gateway-shared.ts). Without the gateway, or while
 * the socket is down, the second mute still mutes and still badges, but the
 * speaker gets no toast.
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

/** Values that say "not muted by the host", should the service ever write one rather than clearing. */
const NOT_HOST_MUTED = new Set(["", "false", "none", "0"]);

/**
 * Read the attribute. Any value set — the service's `true`, the contract's
 * `soft`, a per-mute `soft:<ts>` — is a host mute; unset or an explicit false
 * is not.
 */
export function hostMuteOf(attributes: Readonly<Record<string, string>> | null | undefined): HostMuteAttribute {
  return NOT_HOST_MUTED.has(hostMuteToken(attributes).trim().toLowerCase()) ? "none" : "soft";
}

/**
 * A value written once per mute (`soft:<ts>`): a change in it is a new mute,
 * and while it stays the same the mute is the same one. `true` and `soft` are
 * the same value for every mute.
 */
export function perMuteToken(token: string): boolean {
  return /^[^:]+:.+$/.test(token);
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
  /**
   * This viewer saw the value change to this token. False when the state was
   * made on first sight of the seat (a viewer who just arrived, a seat that
   * came back), where the mute may be long spent.
   */
  witnessed: boolean;
  /** The mic has been seen muted under this mute. */
  sawMuted: boolean;
  /** …and then seen on: the speaker unmuted themselves, so this mute is spent. */
  lifted: boolean;
}

/**
 * The "Muted by host" badge on every seat, one reading at a time.
 *
 * Every seat is remembered, the unset value included, so a change to a host
 * mute is something this viewer WITNESSED. Per identity:
 *
 *  · a witnessed change: the attribute may land a beat before the track mute,
 *    so a mic still on only lifts the mute once it has been seen off under it;
 *  · first sight of a seat already carrying a mute (a late arrival, or a seat
 *    that went and came back): nothing says the mute is fresh, so a mic seen
 *    on lifts it at once — a speaker who had already unmuted is not badged
 *    for muting themselves later;
 *  · a constant value (`true`, `soft`, see `perMuteToken`): the mic going off
 *    again cannot be told from the host's second mute, so it badges again —
 *    the product rule, attribute set AND mic muted (see the module note);
 *  · no microphone publication is never a badge: a speaker seated again has
 *    not published, and the host muted nothing of theirs.
 *
 * A seat no longer present is forgotten.
 */
export function stepHostMuteBadges(
  memory: ReadonlyMap<string, HostMuteBadgeState>,
  seats: readonly HostMuteBadgeSeat[]
): { memory: Map<string, HostMuteBadgeState>; badges: Map<string, boolean> } {
  const next = new Map<string, HostMuteBadgeState>();
  const badges = new Map<string, boolean>();
  for (const seat of seats) {
    const previous = memory.get(seat.identity);
    let state: HostMuteBadgeState =
      previous && previous.token === seat.token
        ? { ...previous }
        : { token: seat.token, witnessed: previous !== undefined, sawMuted: false, lifted: false };
    if (hostMuteOf({ [HOST_MUTED_ATTRIBUTE]: seat.token }) !== "soft") {
      next.set(seat.identity, state);
      badges.set(seat.identity, false);
      continue;
    }
    const mutedNow = seat.published && seat.micMuted;
    if (mutedNow) {
      state = { ...state, sawMuted: true, lifted: state.lifted && perMuteToken(seat.token) };
    } else if (seat.published && (state.sawMuted || !state.witnessed)) {
      state = { ...state, lifted: true };
    }
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
  /** When it was armed: an arming that the mic never followed within the window is spent. */
  armedAt?: number | null;
  lastToastAt: number | null;
}

export const INITIAL_HOST_MUTE_TOAST: HostMuteToastState = {
  previous: null,
  previousToken: null,
  armed: false,
  armedAt: null,
  lastToastAt: null,
};

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
 * track mute still toasts — but only for `MUTE_TOAST_DEDUPE_MS`. A push that
 * arrives after the speaker already unmuted finds the mic on; left armed with
 * no expiry, the speaker's OWN mute minutes later was told as the host's. One
 * mute, one toast: a second arming inside the dedupe window is the same mute
 * seen twice.
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
  const heldArming = state.armed && (state.armedAt == null || input.now - state.armedAt <= MUTE_TOAST_DEDUPE_MS);
  const freshArming = input.signalled || newValue;
  let armed = heldArming || freshArming;
  let armedAt = freshArming ? input.now : heldArming ? (state.armedAt ?? input.now) : null;
  // The mute was lifted before we could say anything: nothing to say.
  if (state.previous === "soft" && input.current === "none") {
    armed = false;
    armedAt = null;
  }
  const recent = state.lastToastAt !== null && input.now - state.lastToastAt < MUTE_TOAST_DEDUPE_MS;
  if (armed && recent && input.current === "soft") {
    return { state: { ...state, previous: input.current, previousToken: token, armed: false, armedAt: null }, toast: false };
  }
  const toast = armed && input.current === "soft" && !input.micOn;
  return {
    state: {
      previous: input.current,
      previousToken: token,
      armed: toast ? false : armed,
      armedAt: toast || !armed ? null : armedAt,
      lastToastAt: toast ? input.now : state.lastToastAt,
    },
    toast,
  };
}

/** What the host is told when the mute route is not deployed yet. */
export const MUTE_UNAVAILABLE = "Mute for everyone isn't available yet.";

/**
 * A mute that did not go through, in full: whether the control goes (the
 * route is not deployed — lib/speaker-invite.ts `routeMissing`, passed in as
 * `missing`) and, EITHER WAY, what the host is told. A moderation action never
 * ends with the control vanishing and nothing said.
 */
export function muteFailure(input: {
  missing: boolean;
  error: { code?: string | null } | null | undefined;
  name?: string | null;
}): { unavailable: boolean; message: string } {
  if (input.missing) return { unavailable: true, message: MUTE_UNAVAILABLE };
  return { unavailable: false, message: muteErrorMessage(input.error, input.name) };
}

/** What the host is told when a mute was refused (see `muteFailure` for an undeployed route). */
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
