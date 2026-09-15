"use client";

import { MediaViewer } from "@/components/ui/media-viewer";

/**
 * A picture, full screen — a gallery photo, a profile picture, a cover.
 *
 * One viewer so every picture on a profile opens the same way ("when we click
 * on profile picture it doesn't expand, even the background picture"). The
 * picture is CONTAINED, never cropped, on a 90% black ground; a tap anywhere,
 * the close disc or Escape shuts it. Portalled to the body so no transformed
 * or clipped ancestor can trap it.
 *
 * It is now `MediaViewer` with a picture in it — the chat thread needed the same
 * viewer for clips and with a download, and two full-screen viewers is how two
 * slightly different ways of closing one ship. This keeps its signature, so no
 * profile caller changed.
 */
export function ImageViewer({
  src,
  alt = "",
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  return <MediaViewer kind="image" src={src} alt={alt} onClose={onClose} />;
}
