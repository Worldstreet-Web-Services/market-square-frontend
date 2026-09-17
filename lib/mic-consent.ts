/**
 * WHEN MAY THE APP OPEN SOMEBODY'S MICROPHONE? Almost never.
 *
 * `useStage` used to turn the mic on whenever the speaker-request row said
 * `approved` and the connection had the grant, gated by a ref that only lived
 * as long as the component. Any remount of the owner — a route change, a
 * reconnect, a reload — re-ran that and opened the mic again, on a person who
 * had muted themselves and walked off to read their messages. That is the
 * privacy hazard this module closes.
 *
 * The product rule (2026-09-17): every speaker joins the stage with the mic
 * OFF and taps to talk. The only auto-enable left is the reader's OWN request
 * being approved while they wait, and only when the surface has recorded that
 * intent in this session. A gist room records none, so it never auto-enables.
 *
 * Pure, so `lib/mic-consent.test.ts` pins every case.
 */

/** What caused this decision to be asked. */
export type MicConsentReason =
  /** The reader asked to speak, waited, and the host said yes — while this surface was mounted. */
  | "ownRequestApproved"
  /** The surface mounted with the approval already in place. */
  | "remount"
  /** The connection came back. */
  | "reconnect"
  /** The tab reloaded. */
  | "reload"
  /** The reader accepted a host's invitation (backend-dependent, not wired). */
  | "inviteAccept"
  /** The host lifted a hard mute (backend-dependent, not wired). */
  | "unlock";

export function shouldAutoEnableMic(input: {
  approved: boolean;
  canPublish: boolean;
  /** Recorded by the reader's own action in this session, and consumed once. */
  intent: boolean;
  reason: MicConsentReason;
}): boolean {
  return input.reason === "ownRequestApproved" && input.intent && input.approved && input.canPublish;
}

/**
 * Is the mic on? Read off the PUBLICATION, never a local flag.
 *
 * A local `micOn` drifts the moment anything else touches the track: a
 * server-side mute flips the publication and leaves the flag saying "on",
 * which draws a live mic on somebody nobody can hear.
 */
export function deriveMicOn(publication: { isMuted: boolean } | null | undefined): boolean {
  return publication ? !publication.isMuted : false;
}

/** A host's mute on a speaker. `hard` locks the mic (backend-dependent, not wired yet). */
export type HostMute = "none" | "soft" | "hard";

export type MicIcon = "mic" | "mic-off" | "lock";

export interface MicControl {
  disabled: boolean;
  icon: MicIcon;
  label: string;
}

export function micControl({
  hostMuted,
  permissions,
  micOn,
}: {
  hostMuted: HostMute;
  /** `microphone` false when the grant does not include the mic source. */
  permissions: { canPublish: boolean; microphone: boolean };
  micOn: boolean;
}): MicControl {
  if (hostMuted === "hard") {
    return { disabled: true, icon: "lock", label: "The host turned off your mic" };
  }
  if (!permissions.canPublish || !permissions.microphone) {
    return { disabled: true, icon: "mic-off", label: "You can't speak in this room yet" };
  }
  return micOn
    ? { disabled: false, icon: "mic", label: "Mute your mic" }
    : { disabled: false, icon: "mic-off", label: "Unmute your mic" };
}
