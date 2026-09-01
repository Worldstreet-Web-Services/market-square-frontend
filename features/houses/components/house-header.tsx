"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LiveBadge } from "@/components/ui/badge";
import { IconArrowLeft, IconDots } from "@/components/ui/icons";
import { canGoBack } from "@/lib/nav-history";

/**
 * The room's header. The topic is the room, so the topic is the header.
 *
 * It MEASURES itself and republishes `--ws-house-head-h`, exactly as
 * ColumnHeader does with `--ws-colhead-h` and for the same reason: the talking
 * line sticks directly underneath it, and this row is taller with a two-line
 * topic than with a one-line one. A magic number here is a talking line that
 * overlaps the topic on some phones and floats below it on others.
 *
 * `top-[var(--ws-topbar-h)]` rather than `top-0`: the shell's mobile top strip
 * is FIXED, so a sticky header parked at zero slides under the wordmark the
 * moment the page scrolls. The variable is 48px on a phone and 0 from md up,
 * where that strip does not exist, so one offset is correct at both ends.
 */
export function HouseHeader({
  topic,
  meta,
  live,
  onOverflow,
}: {
  topic: string;
  meta: React.ReactNode;
  live: boolean;
  onOverflow: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const publish = () =>
      document.documentElement.style.setProperty("--ws-house-head-h", `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      // Reset, so the next surface's sticky offsets do not inherit this one's
      // measurement after the room unmounts.
      document.documentElement.style.removeProperty("--ws-house-head-h");
    };
  }, []);

  return (
    <header ref={ref} className="ws-head sticky top-[var(--ws-topbar-h)] z-30 px-4 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => (canGoBack() ? router.back() : router.push("/gist-rooms"))}
          aria-label="Back"
          className="ws-press -ml-2 flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <IconArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        {/* The app's live identity: a black pill with a pulsing SILVER dot.
            --color-live is broadcast red and appears nowhere in a house. */}
        {live && <LiveBadge />}
        <button
          onClick={onOverflow}
          aria-label="Gist room options"
          className="ws-press -mr-2 flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <IconDots className="h-5 w-5" />
        </button>
      </div>
      <h1 className="ws-display mt-2 line-clamp-2 text-[19px] leading-6">{topic}</h1>
      <p className="ws-meta mt-1.5">{meta}</p>
    </header>
  );
}
