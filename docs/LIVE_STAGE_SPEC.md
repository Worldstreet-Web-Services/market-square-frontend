# Live Stage — multi-participant spec (host + guests)

Research-backed (TikTok Multi-guest, Instagram Live Rooms, Twitch Guest Star, X Spaces, LiveKit docs).
Fixes the production bug where an approved guest publishes into a void: the player renders ONE remote
video, so no other client ever sees or hears them.

## Root cause (confirmed)
1. The player resolves a single remote participant and attaches its video — a second publisher never gets a DOM node.
2. Audio is treated as a byproduct of video. LiveKit delivers mic as a SEPARATE publication; without an
   `<audio>` element per remote audio track, nobody hears the guest.
3. Stage state is computed at join / on `ParticipantConnected` only. A promoted guest is ALREADY in the room,
   so that event never fires again. The real signals are `ParticipantPermissionsChanged` + `TrackPublished/Subscribed`.

**No reconnect is ever needed.** With `autoSubscribe: true`, a server-side `updateParticipant` grant causes the
SFU to push the new track to every existing subscriber. If a client doesn't show the guest, it is a rendering bug.

## State model — the stage is a LIST, never "the remote participant"
```ts
type StageSlot = {
  identity: string; role: 'host' | 'guest';
  videoTrack?: TrackPublication; audioTrack?: TrackPublication;
  isSpeaking: boolean; isMuted: boolean; cameraOff: boolean;
  connectionQuality: ConnectionQuality;
  state: 'approved-pending' | 'live' | 'leaving';
};
function buildStage(room: Room): StageSlot[]   // host slot 0, guests by join order
```
Stage membership = participants whose `permissions.canPublish === true` (+ own metadata role for host).
NOT "participants with a video track" — that is what hides an approved-but-not-yet-publishing guest.

Recompute + rerender on: `ParticipantConnected/Disconnected`, `TrackPublished/Unpublished`,
`TrackSubscribed/Unsubscribed`, `TrackMuted/Unmuted`, `ParticipantPermissionsChanged`,
`ActiveSpeakersChanged`, `ConnectionQualityChanged`, `LocalTrackPublished`, `AudioPlaybackStatusChanged`.

## Two non-negotiables
- **On mount, iterate `room.remoteParticipants` and attach every already-published track.** Events alone miss
  everything that existed before subscribing — the classic "works only for whoever joined last".
- **Call `room.startAudio()` from a user gesture.** Browser autoplay policy silently kills remote audio and
  produces exactly the "host can't hear the guest" symptom with no error.

## Promotion sequence (server-authoritative)
1. Guest requests → backend records → host notified.
2. Host approves → backend `updateParticipant(canPublish: true, sources [CAMERA, MICROPHONE])`.
3. Guest client waits for `ParticipantPermissionsChanged`, re-reads `permissions` fresh (never cached), THEN
   `setCameraEnabled(true)` / `setMicrophoneEnabled(true)`. Publishing before the grant is rejected.
4. Everyone else: permissions event (pending tile) → `TrackPublished` → `TrackSubscribed` (attach).
5. Remove from stage = `canPublish: false` → LiveKit auto-unpublishes their tracks.
LiveKit Cloud reissues the token on `updateParticipant`, so make the guest publish idempotent + retry once.

## Layout
Mobile (9:16, primary): host only = full bleed · host+1 = **vertical 50/50** (never PiP — PiP reads as
"screenshare thumbnail", not conversation) · host+2 = host top 50%, two tiles below · 3–5 = 2-col grid under a
full-width host row · cap at 6, never let a tile go under ~104px tall.
Desktop: host+1 = horizontal 50/50 · host+2 = host ~62% left, filmstrip right · 6+ = equal grid, host slot 0.
Host tile NEVER moves. Slots are reserved on exit so tiles don't reflow mid-animation.
Audio-only guests get a **speaker rail** (44px avatar circles under the host), never a black video tile.

## Tokens
stage `#0A0A0B` · tile `#141416` · border `1px #2A2A2E` · speaking ring `2px #C7CBD1` + `0 0 0 4px rgba(199,203,209,.14)`
· text `#E8EAED` / meta `#8B8F96` · danger `#E5484D` · radius 16 desktop / 14 mobile. No colour accents except danger.

## Tile states
Speaking: ring in 120ms, out 400ms (hangover) — drive from `IsSpeakingChanged`, not raw audioLevel; suppressed when muted.
Muted: mic-slash pill bottom-left. Camera off: avatar/initials tile — **never a black rectangle**.
Quality: hidden when excellent, bars when degraded, "Reconnecting…" over a frozen last frame at 40% saturation.

## Host controls (tile long-press/hover + a Guests sheet with the request queue)
Mute (guest CAN unmute themselves — muting is moderation, unmuting is consent, per X Spaces) ·
Disable camera · Remove from stage (`canPublish:false`, 60s cooldown before re-request) · Remove from room.

## Transitions
Join 600ms: host tile springs to 50% while the guest slot expands → shimmer skeleton "@name is joining…" →
video cross-fades in (200ms, scale .96→1) → toast "@name joined the stage".
Leave 450ms: tile fades **in place** (slot reserved), THEN remaining slots reflow. Reflow-then-fade reads as a glitch.
Honour `prefers-reduced-motion`: keep cross-fade, drop spring/scale.

## Failure states
Approved but silent >5s → "Waiting for @name's camera…", host gets a Remove affordance at 15s ·
Camera denied → offer "Join with audio only" → speaker rail · Both denied → auto-demote at 20s ·
Guest disconnect → frozen frame 10s then leave transition, restore slot if they return ·
Autoplay blocked → persistent "Tap to turn on sound" → `room.startAudio()` · Host leaves → end for everyone.

## Build order
**P0 (makes 1-host-1-guest work at all):** N-slot stage · enumerate existing participants on mount ·
attach remote AUDIO separately + startAudio() · handle permissions/publish events · guest publishes only after
the grant · 50/50 layouts · avatar tile for camera-off · host remove-from-stage.
**P1:** speaking rings · join/leave animation + toasts · host mute/disable-camera + Guests sheet ·
adaptiveStream + dynacast + simulcast · quality pips · pending-guest skeleton.
**P2:** 2/3+ layouts + Spotlight↔Grid toggle · audio-only rail · green room A/V check · per-guest volume.

## Anti-patterns
`remoteParticipants[0]` as the only video source · audio as a byproduct of video · waiting for
`ParticipantConnected` to add a guest (they were already there) · publishing optimistically before the grant ·
reconnecting the room to pick up a publisher · black boxes · layout thrash · PiP for one guest ·
trusting cached role state · host-only hard mute · reordering the host tile.
