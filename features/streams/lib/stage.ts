/**
 * The stage is a LIST of publishers, never "the remote participant".
 *
 * The production bug this replaces: every renderer resolved ONE video source
 * and attached it. A second publisher — an approved guest — therefore never got
 * a DOM node on any other client, and the host cockpit had no remote path at
 * all (see use-publisher.ts: it wired LocalTrackPublished and nothing else).
 * The guest published into a void and saw only their own local preview.
 *
 * Two rules make this correct, and both are the opposite of what the code did:
 *
 *   1. **Membership is the publish GRANT, not the presence of a track.**
 *      A guest is on stage the moment `permissions.canPublish` is true. Keying
 *      off "has a video track" hides an approved guest during the seconds
 *      between the grant and the first frame, and hides an audio-only guest
 *      forever. The host is always a member regardless of grant state, so a
 *      host whose permissions have not been read yet still holds slot 0.
 *
 *   2. **Audio is a first-class publication, not a byproduct of video.**
 *      LiveKit delivers the mic as its own publication. A slot therefore
 *      carries `audioTrack` independently of `videoTrack`, and a slot with
 *      neither is still a slot.
 *
 * This module is pure and structurally typed so it can be pinned by
 * lib/stage.test.ts without a browser, a Room, or the SDK.
 */

/** The shape of a LiveKit `TrackPublication` this module actually reads. */
export interface StagePublication {
  trackSid: string;
  isMuted: boolean;
  isSubscribed?: boolean;
  /** Present once the media is available locally. */
  track?: unknown;
}

/** The shape of a LiveKit `Participant` this module actually reads. */
export interface StageParticipant {
  identity: string;
  isLocal?: boolean;
  /** Fresh permissions off the participant — never a cached role. */
  permissions?: { canPublish?: boolean } | null;
  /** LiveKit sets this on join; used only to order guests behind the host. */
  joinedAt?: Date | number | null;
  name?: string;
  isSpeaking?: boolean;
  connectionQuality?: string;
  videoTrackPublications: ReadonlyMap<string, StagePublication>;
  audioTrackPublications: ReadonlyMap<string, StagePublication>;
}

/** The shape of a LiveKit `Room` this module actually reads. */
export interface StageRoom {
  localParticipant: StageParticipant;
  remoteParticipants: ReadonlyMap<string, StageParticipant>;
}

export type StageSlotState =
  /** Granted publish, nothing published yet — render a skeleton, not nothing. */
  | "approved-pending"
  | "live";

export interface StageSlot {
  identity: string;
  role: "host" | "guest";
  isLocal: boolean;
  name: string;
  /** Undefined for an audio-only or camera-off participant. */
  videoTrack: StagePublication | null;
  /** Independent of `videoTrack`. A slot may carry audio and no video. */
  audioTrack: StagePublication | null;
  isSpeaking: boolean;
  /** No audio publication at all, or one that is muted. */
  isMuted: boolean;
  /** No video publication, or one that is muted — render an avatar, never black. */
  cameraOff: boolean;
  connectionQuality: string;
  state: StageSlotState;
}

function first(publications: ReadonlyMap<string, StagePublication>): StagePublication | null {
  for (const publication of publications.values()) return publication;
  return null;
}

function joinOrder(participant: StageParticipant): number {
  const joined = participant.joinedAt;
  if (joined == null) return Number.MAX_SAFE_INTEGER;
  return joined instanceof Date ? joined.getTime() : joined;
}

function toSlot(participant: StageParticipant, role: "host" | "guest"): StageSlot {
  const video = first(participant.videoTrackPublications);
  const audio = first(participant.audioTrackPublications);
  return {
    identity: participant.identity,
    role,
    isLocal: participant.isLocal === true,
    name: participant.name || participant.identity,
    videoTrack: video,
    audioTrack: audio,
    isSpeaking: participant.isSpeaking === true,
    isMuted: !audio || audio.isMuted,
    cameraOff: !video || video.isMuted,
    connectionQuality: participant.connectionQuality ?? "unknown",
    // A publication of either kind means they are on air. Nothing published
    // means the grant landed but the device has not — a pending tile.
    state: video || audio ? "live" : "approved-pending",
  };
}

/**
 * Every participant with a publish grant, host first, then guests by join order.
 *
 * `hostIdentity` is the stream's `ownerId` — LiveKit identities are user ids
 * here. The host tile is slot 0 and never moves, so a guest joining or leaving
 * can never reflow the host out from under the viewer.
 */
export function buildStage(room: StageRoom, hostIdentity: string): StageSlot[] {
  const everyone: StageParticipant[] = [
    room.localParticipant,
    ...room.remoteParticipants.values(),
  ];

  const seen = new Set<string>();
  const host: StageSlot[] = [];
  const guests: { slot: StageSlot; order: number }[] = [];

  for (const participant of everyone) {
    if (!participant || seen.has(participant.identity)) continue;
    const isHost = Boolean(hostIdentity) && participant.identity === hostIdentity;
    // Read permissions fresh off the participant every time. LiveKit mutates
    // this object in place on ParticipantPermissionsChanged, and the documented
    // race is exactly a client trusting a role it cached at join.
    const canPublish = participant.permissions?.canPublish === true;
    if (!isHost && !canPublish) continue;
    seen.add(participant.identity);
    if (isHost) host.push(toSlot(participant, "host"));
    else guests.push({ slot: toSlot(participant, "guest"), order: joinOrder(participant) });
  }

  guests.sort((a, b) =>
    a.order === b.order ? a.slot.identity.localeCompare(b.slot.identity) : a.order - b.order
  );

  return [...host, ...guests.map((entry) => entry.slot)];
}

/** Slots whose audio must be attached — everyone but ourselves. */
export function remoteAudioSlots(slots: readonly StageSlot[]): StageSlot[] {
  return slots.filter((slot) => !slot.isLocal && slot.audioTrack !== null);
}
