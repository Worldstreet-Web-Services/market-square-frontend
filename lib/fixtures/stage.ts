import type { StageParticipant, StagePublication, StageRoom } from "@/features/streams/lib/stage";
// Relative + .ts: this is a RUNTIME import and the tests run on `node --test`,
// which resolves neither the `@/` alias nor extensionless specifiers. The type
// import above keeps the alias — it is erased.
import { SOURCE_CAMERA, SOURCE_SCREEN } from "../../features/streams/lib/stage.ts";

/**
 * A demo stage, so screen-share layout is visible without an SFU.
 *
 * The scenario is the reported bug: a chess broadcaster sharing the BOARD
 * while their camera is still running, an opponent on camera only, and a
 * spectator with a mic and no camera. Rendered correctly that is a board on
 * the main stage and three faces in the strip — the sharer included.
 *
 * `track` is a stub with attach/detach so the renderer's own code path runs;
 * it mints a plain element that simply paints, since there is no media.
 */
function stubTrack(label: string, hue: number) {
  const elements = new Set<HTMLElement>();
  return {
    attach(): HTMLElement {
      const element = document.createElement("div");
      element.textContent = label;
      element.style.cssText = `display:flex;align-items:center;justify-content:center;height:100%;width:100%;background:hsl(${hue} 40% 18%);color:#E8EAED;font:600 12px system-ui;`;
      elements.add(element);
      return element;
    },
    detach(element: HTMLElement) {
      elements.delete(element);
      return element;
    },
  };
}

function publication(
  trackSid: string,
  source: string,
  label: string,
  hue: number
): StagePublication {
  return { trackSid, isMuted: false, isSubscribed: true, source, track: stubTrack(label, hue) };
}

function participant(
  identity: string,
  name: string,
  video: StagePublication[],
  audio: StagePublication[]
): StageParticipant {
  return {
    identity,
    name,
    permissions: { canPublish: true },
    isSpeaking: false,
    connectionQuality: "excellent",
    videoTrackPublications: new Map(video.map((p) => [p.trackSid, p])),
    audioTrackPublications: new Map(audio.map((p) => [p.trackSid, p])),
  };
}

export const DEMO_HOST_IDENTITY = "u_kenji";

/** Host shares screen AND camera; opponent camera-only; spectator audio-only. */
export function demoStageRoom(): StageRoom {
  const host = participant(
    DEMO_HOST_IDENTITY,
    "Kenji Sato",
    [
      publication("d-scr", SOURCE_SCREEN, "Shared board", 268),
      publication("d-cam", SOURCE_CAMERA, "Kenji", 210),
    ],
    [publication("d-mic", "microphone", "", 0)]
  );
  const opponent = participant(
    "u_zara",
    "Zara Ali",
    [publication("o-cam", SOURCE_CAMERA, "Zara", 190)],
    [publication("o-mic", "microphone", "", 0)]
  );
  const spectator = participant("u_leo", "Leo Bright", [], [
    publication("s-mic", "microphone", "", 0),
  ]);

  return {
    localParticipant: host,
    remoteParticipants: new Map([
      [opponent.identity, opponent],
      [spectator.identity, spectator],
    ]),
  };
}
