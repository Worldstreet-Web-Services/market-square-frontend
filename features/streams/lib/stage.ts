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

/**
 * LiveKit's `Track.Source` values, as strings.
 *
 * A participant can publish a camera AND a screen share at the same time —
 * they are two separate publications on one participant, told apart only by
 * this field. Reading "the first video publication" therefore picks one of
 * them arbitrarily, which is exactly how sharing a chess board made the
 * player's face disappear.
 */
export const SOURCE_CAMERA = "camera";
export const SOURCE_SCREEN = "screen_share";

/** The shape of a LiveKit `TrackPublication` this module actually reads. */
export interface StagePublication {
  trackSid: string;
  isMuted: boolean;
  isSubscribed?: boolean;
  /** `Track.Source` — "camera" | "screen_share" | … */
  source?: string;
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
  /** The face. Null for an audio-only or camera-off participant. */
  cameraTrack: StagePublication | null;
  /**
   * The shared screen, independent of the camera — a participant may publish
   * both, one, or neither.
   */
  screenTrack: StagePublication | null;
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

/**
 * Pick the publication for one video source.
 *
 * A publication with NO source is treated as a camera: older publishers and
 * some SDK paths leave it unset, and a face is the safer default — misreading
 * a camera as a screen share would promote it to the main stage and demote
 * everyone else.
 */
function videoBySource(
  publications: ReadonlyMap<string, StagePublication>,
  source: string
): StagePublication | null {
  for (const publication of publications.values()) {
    const actual = publication.source ?? SOURCE_CAMERA;
    if (actual === source) return publication;
  }
  return null;
}

function joinOrder(participant: StageParticipant): number {
  const joined = participant.joinedAt;
  if (joined == null) return Number.MAX_SAFE_INTEGER;
  return joined instanceof Date ? joined.getTime() : joined;
}

function toSlot(participant: StageParticipant, role: "host" | "guest"): StageSlot {
  const camera = videoBySource(participant.videoTrackPublications, SOURCE_CAMERA);
  const screen = videoBySource(participant.videoTrackPublications, SOURCE_SCREEN);
  const audio = first(participant.audioTrackPublications);
  return {
    identity: participant.identity,
    role,
    isLocal: participant.isLocal === true,
    name: participant.name || participant.identity,
    cameraTrack: camera,
    screenTrack: screen,
    audioTrack: audio,
    isSpeaking: participant.isSpeaking === true,
    isMuted: !audio || audio.isMuted,
    cameraOff: !camera || camera.isMuted,
    connectionQuality: participant.connectionQuality ?? "unknown",
    // Any publication means they are on air. Nothing published means the grant
    // landed but the device has not — a pending tile.
    state: camera || screen || audio ? "live" : "approved-pending",
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


/**
 * One rendered surface: a participant paired with ONE of their video sources.
 *
 * A participant publishing screen + camera yields two tiles — their screen on
 * the main stage, their face in the strip — so the model has to be per-source,
 * not per-participant.
 */
export interface StageTile {
  /** Stable across layout changes, so a tile is never remounted (no black flash). */
  key: string;
  slot: StageSlot;
  kind: "camera" | "screen";
  publication: StagePublication | null;
  /** What the tile is called. A screen names its owner so the pairing is obvious. */
  label: string;
}

/** A screen share only counts once it is actually carrying video. */
function hasLiveScreen(slot: StageSlot): boolean {
  return slot.screenTrack !== null && !slot.screenTrack.isMuted;
}

export interface StageLayout {
  /** The large surface: shared screens when any exist, otherwise the cameras. */
  primary: StageTile[];
  /** The small strip. Empty when there is no screen share. */
  secondary: StageTile[];
  /** True while anyone is sharing — callers letterbox the primary surface. */
  screenSharing: boolean;
}

/**
 * Decide what goes big and what goes small.
 *
 * With a screen share present the shared content IS the thing people came for
 * — a chess board, a slide — so it takes the stage and faces drop to a strip
 * beside it. That is the Twitch/Zoom convention and it is what the reporter
 * expected: they wanted the board AND the opponent's face, not one instead of
 * the other.
 */
export function buildStageLayout(slots: readonly StageSlot[]): StageLayout {
  const sharing = slots.filter(hasLiveScreen);

  const cameraTile = (slot: StageSlot): StageTile => ({
    key: `${slot.identity}:camera`,
    slot,
    kind: "camera",
    publication: slot.cameraTrack,
    label: slot.name,
  });

  if (sharing.length === 0) {
    return { primary: slots.map(cameraTile), secondary: [], screenSharing: false };
  }

  return {
    primary: sharing.map((slot) => ({
      key: `${slot.identity}:screen`,
      slot,
      kind: "screen",
      publication: slot.screenTrack,
      // Names the sharer, so a viewer can tell which face in the strip owns
      // the screen they are looking at.
      label: `${slot.name}'s screen`,
    })),
    // EVERY participant keeps a camera tile, including the sharer — that is
    // the whole point: the board and the face, at once.
    secondary: slots.map(cameraTile),
    screenSharing: true,
  };
}
