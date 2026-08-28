"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import type { Stream } from "@/features/streams/lib/types";

const HERO_LIMIT = 5;

/**
 * The hero: the rooms worth interrupting somebody for, as a swipeable carousel.
 *
 * Scroll-driven rather than timer-driven. An auto-advancing hero moves the
 * thing somebody is reading out from under them, and on a page whose whole
 * purpose is "pick a room to enter" that is a way to lose the pick. The dots
 * follow the scroll position and can also drive it.
 */
export function LiveHero({ streams }: { streams: Stream[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = streams.slice(0, HERO_LIMIT);

  if (slides.length === 0) return null;

  // Clamped at render rather than corrected in an effect: if the list shrinks
  // (a stream ends) the stored index can point past the end, and an effect
  // would leave one frame with no dot lit at all.
  const active = Math.min(index, slides.length - 1);

  const sync = () => {
    const node = track.current;
    if (!node) return;
    setIndex(Math.round(node.scrollLeft / Math.max(1, node.clientWidth)));
  };

  return (
    <section className="px-4 lg:px-6">
      <div
        ref={track}
        onScroll={sync}
        aria-label="Featured live streams"
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((stream) => (
          <Link
            key={stream.id}
            href={`/live/${stream.id}`}
            className="ws-press group relative aspect-[707/324] w-full shrink-0 snap-start overflow-hidden"
          >
            {stream.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- author-supplied host
              <img
                src={stream.thumbnailUrl}
                alt=""
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <GradientThumb seed={stream.id} className="absolute inset-0 h-full w-full" />
            )}

            {/* Two stops, weighted to the bottom, so the headline holds its
                contrast over a bright frame without dimming the whole image. */}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

            <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-[#ff0b0b] px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              Live
            </span>

            <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
              {/* Clamped, not truncated: the design's headline wraps to two
                  lines, and a title cut at one line loses the hook. */}
              <p className="line-clamp-2 text-[17px] font-bold leading-snug text-white sm:text-[22px] lg:text-[24.5px]">
                {stream.title}
              </p>
              {stream.owner && (
                <span className="mt-2 flex items-center gap-2">
                  <Avatar
                    name={stream.owner.displayName}
                    seed={stream.owner.id}
                    src={stream.owner.avatarUrl}
                    size={24}
                  />
                  <span className="truncate text-[12px] font-medium text-white/80">
                    @{stream.owner.username}
                  </span>
                  <span className="hidden rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-black sm:inline">
                    Click to join Live
                  </span>
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Rendered only when there is more than one slide — a single dot is
          decoration that implies content which is not there. */}
      {slides.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((stream, position) => (
            <button
              key={stream.id}
              type="button"
              aria-label={`Show featured stream ${position + 1}`}
              aria-current={position === active}
              onClick={() => {
                const node = track.current;
                node?.scrollTo({ left: position * node.clientWidth, behavior: "smooth" });
              }}
              className={cn(
                "h-[7px] rounded-full transition-all duration-200",
                position === active ? "w-6 bg-white" : "w-[7px] bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
