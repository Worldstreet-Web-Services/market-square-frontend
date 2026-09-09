"use client";

import { useEffect, useState } from "react";

/**
 * Live captions — the rail, shipped now, empty.
 *
 * WCAG 2.2 SC 1.2.9 asks for a live alternative to audio-only content. In a
 * product that is PERMANENTLY audio-only that is not an edge case; it is the
 * difference between usable and unusable for anybody who cannot hear the room.
 *
 * `captionUrl` is null in every environment today (the field exists on
 * PlaybackSchema; nothing populates it), so this renders nothing. The
 * component, its geometry and its POSITION in the layout ship anyway, because
 * the alternative is retrofitting captions later — and retrofitting is exactly
 * how X Spaces ended up overlaying them on the faces, which is the documented
 * failure this is placed to avoid.
 *
 * It has its own scroll region and sits UNDER the pinned row. It is never an
 * overlay on the ring or on anybody's name.
 */
export function CaptionRail({ captionUrl }: { captionUrl: string | null }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!captionUrl) return;
    let cancelled = false;
    const source = new EventSource(captionUrl);
    source.onmessage = (event) => {
      if (cancelled || typeof event.data !== "string") return;
      const text = event.data.trim();
      if (!text) return;
      // Bounded: a caption rail is a running transcript, and an unbounded one
      // is a memory leak that grows for as long as the house is open.
      setLines((current) => [...current, text].slice(-40));
    };
    // A caption stream that drops is not worth a message in the room; it comes
    // back on its own or it does not, and the audio is unaffected either way.
    source.onerror = () => source.close();
    return () => {
      cancelled = true;
      source.close();
    };
  }, [captionUrl]);

  if (!captionUrl || lines.length === 0) return null;

  return (
    <section
      aria-label="Live captions"
      className="ws-hair max-h-[96px] overflow-y-auto border-b px-4 py-2"
    >
      {lines.map((line, index) => (
        <p key={index} className="text-[13px] leading-5 text-body">
          {line}
        </p>
      ))}
    </section>
  );
}
