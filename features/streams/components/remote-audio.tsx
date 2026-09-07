"use client";

import { useEffect, useRef } from "react";
import type { StageSlot } from "@/features/streams/lib/stage";

/**
 * One hidden <audio> per remote audio track.
 *
 * Its own component, mounted from its own map, so that audio can never again
 * become conditional on a video element existing. It lived inside
 * `live-stage.tsx` — the file that is video all the way down — which is exactly
 * the coupling this shape exists to prevent; a house has no stage, no tiles and
 * no video path, and it still needs every one of these.
 *
 * `mutedForMe` is the only addition. It is a CLIENT-LOCAL silence: nothing is
 * sent, nobody is told, and the speaker keeps their seat and their ring. In a
 * room of twelve people blocking is a public act with a social cost, so people
 * do not do it and eat the harassment instead; "mute for me" is the control
 * that actually gets used, and it is one line of DOM here.
 */
export function RemoteAudio({
  slot,
  mutedForMe = false,
}: {
  slot: StageSlot;
  /** Silence this person for this viewer only. Volume, not unsubscribe. */
  mutedForMe?: boolean;
}) {
  const track = slot.audioTrack?.track as
    | { attach: () => HTMLMediaElement; detach: (el: HTMLMediaElement) => unknown }
    | undefined;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    if (!track) return;
    const mount = mountRef.current;
    if (!mount) return;
    const element = track.attach();
    element.autoplay = true;
    element.muted = false;
    element.style.display = "none";
    elementRef.current = element;
    mount.replaceChildren(element);
    return () => {
      elementRef.current = null;
      track.detach(element);
      element.remove();
    };
  }, [track]);

  // Volume in its OWN effect, so muting somebody does not tear the element down
  // and rebuild it — which would drop the audio for everyone else on the way
  // through, and restart this person's stream on unmute.
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    element.volume = mutedForMe ? 0 : 1;
  }, [mutedForMe, track]);

  return <div ref={mountRef} className="hidden" aria-hidden />;
}
