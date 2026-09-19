"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IconDownload, IconX } from "@/components/ui/icons";
import { mediaToSilence } from "@/lib/story-playback";

/**
 * A picture or a clip, full screen — and, where the file can be saved, a way
 * to save it.
 *
 * One viewer for both, because a chat thread is a river of both and opening a
 * photo and opening a clip should feel like the same gesture. The media is
 * CONTAINED, never cropped, on a 90% black ground. A tap on the ground, the
 * close disc or Escape shuts it; a tap on a playing video does not, because on
 * a clip that tap belongs to its own controls. Portalled to the body so no
 * transformed or clipped ancestor can trap it.
 *
 * DOWNLOAD IS A REAL DOWNLOAD OR IT IS ABSENT. `downloadUrl` comes from
 * `lib/media-download.ts`, which asks the file host to send the file as an
 * attachment; a plain link to the picture would just open it again. When there
 * is no such URL the control is not drawn at all, rather than drawing a button
 * that opens the file in place and calls that a download.
 *
 * The clip plays WITH sound: opening it was the tap that asked to watch. So
 * everything else that is PLAYING on the page — a voice note, another clip — is
 * paused while it is open and restarted on close, using the story viewer's own
 * rule (`mediaToSilence`): only what was actually playing, so closing never
 * starts something the reader had left alone.
 */
export function MediaViewer({
  kind,
  src,
  alt = "",
  downloadUrl,
  onClose,
}: {
  kind: "image" | "video";
  src: string;
  alt?: string;
  /** A link that saves the file, or null/undefined when there is none. */
  downloadUrl?: string | null;
  onClose: () => void;
}) {
  const ownVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (kind !== "video") return;
    const stopped = mediaToSilence<HTMLMediaElement>(
      document.querySelectorAll<HTMLMediaElement>("video, audio"),
      (media) => media === ownVideo.current
    );
    stopped.forEach((media) => media.pause());
    return () => stopped.forEach((media) => void media.play().catch(() => {}));
  }, [kind]);

  const noun = kind === "video" ? "video" : "picture";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || (kind === "video" ? "Video" : "Picture")}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      {kind === "video" ? (
        <video
          ref={ownVideo}
          src={src}
          controls
          autoPlay
          playsInline
          /*
            THE BROWSER'S OWN MENU MUST NOT OFFER WHAT WE WITHHOLD.

            Chrome's video control menu carries Download and Picture in
            Picture. On a SNAP that is the feature undoing itself: we draw no
            Save deliberately, and the browser was quietly offering one three
            pixels away (ogazboiz found it, 2026-09-19).

            Keyed on `downloadUrl` rather than on a snap flag, because the rule
            is the general one: wherever THIS app has decided there is no
            download to give, the player does not get to disagree. Where a
            download IS offered the menu keeps it, and the two agree.

            It is not a lock. A screen recording still works, and nothing in a
            browser can stop that — the point is not to leave a one-tap Save on
            a picture that is about to be destroyed.
          */
          {...(downloadUrl
            ? {}
            : {
                controlsList: "nodownload noplaybackrate",
                disablePictureInPicture: true,
                onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
              })}
          onClick={(event) => event.stopPropagation()}
          className="max-h-[90dvh] max-w-full rounded-[20px] bg-black"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- service-issued media URL */
        <img
          src={src}
          alt={alt}
          onContextMenu={downloadUrl ? undefined : (event) => event.preventDefault()}
          className="max-h-[90dvh] max-w-full rounded-[20px] object-contain"
        />
      )}

      <div className="absolute right-4 top-4 flex items-center gap-2">
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            onClick={(event) => event.stopPropagation()}
            aria-label={`Download ${noun}`}
            title={`Download ${noun}`}
            className="ws-glass-clear ws-press flex h-10 w-10 items-center justify-center rounded-full text-white"
          >
            <IconDownload className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${noun}`}
          className="ws-glass-clear ws-press flex h-10 w-10 items-center justify-center rounded-full text-white"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
