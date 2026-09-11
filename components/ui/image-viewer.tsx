"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@/components/ui/icons";

/**
 * A picture, full screen — a gallery photo, a profile picture, a cover.
 *
 * One viewer so every picture on a profile opens the same way ("when we click
 * on profile picture it doesn't expand, even the background picture"). The
 * picture is CONTAINED, never cropped, on a 90% black ground; a tap anywhere,
 * the close disc or Escape shuts it. Portalled to the body so no transformed
 * or clipped ancestor can trap it.
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
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Picture"}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- service-issued media URL */}
      <img src={src} alt={alt} className="max-h-[90dvh] max-w-full rounded-[20px] object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close picture"
        className="ws-glass-clear ws-press absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>,
    document.body
  );
}
