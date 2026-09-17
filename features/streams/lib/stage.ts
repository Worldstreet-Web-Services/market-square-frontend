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

import { hostMuteToken, mutedByHost } from "../../../lib/host-mute.ts";

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
  /**
   * The participant's own token metadata, verbatim.
   *
   * Opaque here on purpose: this module is about SEATING and must not learn a
   * payload shape. Houses parses it (features/houses/lib/participant-meta.ts)
   * to turn a seat into a link to somebody's profile, which is the whole
   * discovery loop in an audio room — a face at a table is the only thing
   * naming a person who has no chat message and no request row.
   */
  metadata?: string | null;
  /**
   * LiveKit participant attributes. Read for ONE key, the host's soft mute
   * (`hostMuted`), and only through lib/host-mute.ts.
   */
  attributes?: Readonly<Record<string, string>> | null;
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
  /** The token's metadata string, unparsed. See StageParticipant.metadata. */
  metadata: string | null;
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
  /**
   * The host muted them and the mic is muted — the "Muted by host" badge, as
   * this one reading can tell. `useStageSlots` narrows it with memory
   * (lib/host-mute.ts `stepHostMuteBadges`) to "and they have not unmuted since".
   */
  mutedByHost: boolean;
  /** The raw `hostMuted` attribute, "" when unset: a new value is a new mute. */
  hostMuteToken: string;
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
    name: participantLabel(participant.name, participant.identity),
    metadata: participant.metadata ?? null,
    cameraTrack: camera,
    screenTrack: screen,
    audioTrack: audio,
    isSpeaking: participant.isSpeaking === true,
    isMuted: !audio || audio.isMuted,
    mutedByHost: audio !== null && mutedByHost(participant.attributes, audio.isMuted),
    hostMuteToken: hostMuteToken(participant.attributes),
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
/**
 * What captions a tile.
 *
 * LiveKit carries an identity (our Privy DID, because permissions key off it)
 * and an optional name. When the name is missing the raw DID was rendered, so a
 * guest appeared as `did:privy:cmtad9ojl00m80dl2lkl4erib` — unreadable, and it
 * leaks an account id to everyone watching. A short, stable stand-in is better
 * on both counts: it tells two unnamed guests apart without publishing either
 * one's identifier.
 */
/**
 * The USER behind a LiveKit identity.
 *
 * An approved speaker rejoins the room as `<did>#speaker` — a distinct
 * identity, because LiveKit will not let one identity hold two connections
 * while the old one is still draining. Everything OUTSIDE the room, though,
 * knows them by the plain DID: the speaker-request row, the profile, the
 * ledger.
 *
 * Forgetting that broke removing a guest. The host's control passed the tile's
 * identity — the `#speaker` one — into a lookup keyed on the request's
 * `userId`, which is the bare DID, so it never matched and every attempt said
 * "couldn't find that guest's request" while the guest stayed on stage. One
 * function, used by both sides, so the two can no longer disagree.
 */
export function baseIdentity(identity: string): string {
  return identity.split("#")[0] ?? identity;
}

export function participantLabel(name: string | undefined, identity: string): string {
  const given = name?.trim();
  if (given) return given;
  // Approved speakers join as `<did>#speaker`, so drop the suffix first.
  const base = baseIdentity(identity);
  const tail = base.slice(-4).toUpperCase();
  return base.startsWith("did:") ? `Guest ${tail}` : base;
}

/**
 * Is this participant the stream's host?
 *
 * ONE comparison, on the base identity, because every identity in the room now
 * carries the owner: a viewer is `<did>`, an approved speaker `<did>#speaker`,
 * and the host publishes as `<did>#broadcaster` (or `<did>#rtmp` when they are
 * pushing RTMP). `baseIdentity` drops the suffix, so all four collapse to the
 * same person.
 *
 * ─── WHAT WAS HERE BEFORE ────────────────────────────────────────────────────
 * A second branch accepting the literal string `broadcaster`, because the
 * service signed the host's publisher token with exactly that — no user id
 * anywhere on the token. It was a workaround for a backend gap, and it was
 * both necessary and wrong: necessary, because without it the host was
 * classified as a GUEST in their own room (no Host chip, a remove control on
 * their own tile, their slot free to reflow, and their name rendered as the
 * word "broadcaster" while they also appeared under House Members); wrong,
 * because the literal identified no particular person, so ANY participant
 * calling themselves `broadcaster` matched the host of every stream.
 *
 * The token carries `<ownerId>#broadcaster` now, so the branch is deleted
 * rather than kept alongside the real check. Two layers doing one job is how
 * the workaround outlives the bug and nobody can tell which one is load
 * bearing.
 *
 * NOTE ON DEPLOY ORDER: the backend must ship first. A host who connected on
 * an older token is still in the room as `broadcaster` until they go live
 * again, and this no longer recognises them.
 */
export function isHostParticipant(identity: string, hostIdentity: string): boolean {
  if (!hostIdentity) return false;
  return baseIdentity(identity) === baseIdentity(hostIdentity);
}

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
    const isHost = isHostParticipant(participant.identity, hostIdentity);
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

/* ------------------------------------------------------------------ *
 * How a tile fits its box
 * ------------------------------------------------------------------ */

export type TileFit = "cover" | "contain";

/**
 * The crop budget: how far a source's aspect may differ from its tile before we
 * stop filling the box and letterbox instead.
 *
 * `cover` scales the source until the box is full, so the fraction of the frame
 * that survives along the overflowing axis is exactly `min(a, b) / max(a, b)`
 * of the two aspects. At a ratio of 1.2 that is ~17% of the frame lost, ~8% off
 * each edge — which is the region broadcast framing already treats as
 * disposable (the title-safe convention reserves the outer ~10%, action-safe
 * ~5%, precisely because nothing load-bearing is meant to live there).
 *
 * Above 1.2 the crop stops eating margin and starts eating subject:
 *   * 4:3 camera in a 16:9 tile  → 1.33 → 25% gone
 *   * 16:9 camera in a 9:16 tile → 3.16 → 68% gone — two thirds of the picture
 *   * 21:9 ultrawide in 16:9     → 1.31 → 24% gone
 * while the cases that genuinely look better filled stay under it:
 *   * 16:9 in 16:10 → 1.11 → 10%
 *   * 3:2 in 16:9   → 1.19 → 16%
 *
 * So 1.2 is the line between "trimming margin" and "discarding content".
 */
export const CROP_BUDGET = 1.2;

/**
 * Pure: given what is being published and the shape of the box, fill or letterbox.
 *
 * Deliberately takes numbers rather than a DOM node, because the decision is
 * the part worth pinning — the reported bug (a screen share sliced down to its
 * middle third) was a policy mistake, not a rendering one.
 */
export function chooseFit({
  isScreenShare,
  sourceAspect,
  tileAspect,
}: {
  isScreenShare: boolean;
  /** intrinsic videoWidth / videoHeight; null until metadata loads. */
  sourceAspect: number | null;
  /** The tile's own width / height; null before it has been measured. */
  tileAspect: number | null;
}): TileFit {
  // A screen share is never cropped. Slicing the edges off a shared screen
  // removes the toolbars, line numbers and margins where the answer usually is,
  // and the viewer has no way to know anything is missing.
  if (isScreenShare) return "contain";
  // Unknown geometry: fill. Bars that appear and then vanish once metadata
  // lands read as a glitch; a crop that resolves into a fit does not.
  if (!sourceAspect || !tileAspect || sourceAspect <= 0 || tileAspect <= 0) return "cover";
  const ratio = Math.max(sourceAspect, tileAspect) / Math.min(sourceAspect, tileAspect);
  return ratio > CROP_BUDGET ? "contain" : "cover";
}

/** How much of the source `cover` would discard, 0..1. For the host's hint. */
export function cropLoss(sourceAspect: number | null, tileAspect: number | null): number {
  if (!sourceAspect || !tileAspect || sourceAspect <= 0 || tileAspect <= 0) return 0;
  return 1 - Math.min(sourceAspect, tileAspect) / Math.max(sourceAspect, tileAspect);
}

/* ------------------------------------------------------------------ *
 * How the stage FRAME is shaped
 * ------------------------------------------------------------------ */

/** The room's default column: a portrait 9:16 stage, phone and desktop alike. */
export const STAGE_PORTRAIT_ASPECT = 9 / 16;
/** The widest the stage will ever get. Past 16:9 a frame stops being a stage. */
export const STAGE_LANDSCAPE_ASPECT = 16 / 9;

/**
 * The shape the watch page's stage should take for what is being published.
 *
 * The reported bug: on the host's studio a landscape camera filled its tile,
 * while on /live/:id the same camera was a small strip floating in a tall black
 * frame. Neither surface was wrong on its own — they simply disagreed. The
 * cockpit preview is a landscape panel (65% of a desktop grid), so a 16:9
 * camera matched it and `chooseFit` filled. The watch page hardcoded a 9:16
 * frame at every breakpoint, so the SAME camera came out at a ratio of 3.16 —
 * over the crop budget, correctly letterboxed by `chooseFit`, and left
 * occupying about a third of the frame's height with dead black above and
 * below.
 *
 * `chooseFit` was doing its job: at 9:16 the only alternative was throwing away
 * two thirds of the picture. The mistake was upstream of it — a stage whose
 * shape was fixed before anyone knew what shape the stream was.
 *
 * So the frame adopts the source instead, the way a landscape live stream
 * widens its player on TikTok's web view rather than being posted into a
 * portrait hole. Clamped at both ends because the stage still has to be a
 * stage: a portrait phone camera keeps the 9:16 column (it can be no
 * narrower), and an ultrawide desktop share stops at 16:9 rather than
 * flattening the room into a letterbox slot.
 *
 * Unknown geometry resolves to portrait: that is the column the page lays out
 * before the first frame arrives, and it is also the shape most Market Square
 * streams turn out to be, so the common case never visibly reshapes.
 *
 * Only a SOLO publisher's shape reaches this function (see `LiveStage`). A
 * multi-tile stage keeps the portrait column, which is what `lib/stage-layout`
 * assumes when it stacks two faces rather than slivering them side by side.
 */
export function stageFrameAspect(sourceAspect: number | null | undefined): number {
  if (!sourceAspect || !Number.isFinite(sourceAspect) || sourceAspect <= 0) {
    return STAGE_PORTRAIT_ASPECT;
  }
  return Math.min(Math.max(sourceAspect, STAGE_PORTRAIT_ASPECT), STAGE_LANDSCAPE_ASPECT);
}
