"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { LiveTile } from "@/features/streams/components/live-tile";
import type { Stream } from "@/features/streams/lib/types";

/**
 * A category of live rooms, as a horizontal rail.
 *
 * The design puts each category on one line with arrows rather than wrapping
 * it into a grid, and that is the right shape for this content: a category is
 * a browse, not an inventory. A grid asks you to read everything; a rail asks
 * you to glance and move on.
 *
 * The arrows are DESKTOP ONLY. On touch the rail is already swipeable, and a
 * pair of arrows there is chrome competing with the thing it scrolls.
 */
export function LiveRail({ title, streams }: { title: string; streams: Stream[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Empty categories are not rendered at all. A heading with nothing under it
  // reads as a failure to load rather than as a quiet category.
  if (streams.length === 0) return null;

  const sync = () => {
    const node = track.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= 2);
    // The one-pixel tolerance matters: fractional widths mean scrollLeft never
    // exactly equals the maximum, so a strict comparison leaves the arrow
    // enabled forever at the end of every rail.
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 2);
  };

  const nudge = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    // A viewport-proportional step, so the rail advances by what somebody can
    // see rather than by a fixed number of cards that means something
    // different on every screen.
    node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-4 px-4 lg:px-6">
        <h2 className="truncate text-[16px] font-semibold leading-tight text-white">{title}</h2>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {([-1, 1] as const).map((direction) => {
            const disabled = direction === -1 ? atStart : atEnd;
            const Icon = direction === -1 ? IconChevronLeft : IconChevronRight;
            return (
              <button
                key={direction}
                type="button"
                onClick={() => nudge(direction)}
                disabled={disabled}
                aria-label={direction === -1 ? `Scroll ${title} back` : `Scroll ${title} forward`}
                className={cn(
                  "ws-press flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-body transition-colors",
                  disabled ? "opacity-30" : "hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Snap so a swipe lands on a tile rather than between two. The padding
          is on the TRACK, not the section, so the first tile starts at the
          page gutter and the last can still scroll clear of the edge. */}
      <div
        ref={track}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] lg:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {streams.map((stream) => (
          <LiveTile
            key={stream.id}
            stream={stream}
            // Two-and-a-bit tiles on a phone, five on a wide screen: the
            // fraction is deliberate, because a tile cut by the edge is what
            // tells somebody the rail keeps going.
            className="w-[42vw] shrink-0 snap-start sm:w-[30vw] md:w-[24vw] lg:w-[230px]"
          />
        ))}
      </div>
    </section>
  );
}
