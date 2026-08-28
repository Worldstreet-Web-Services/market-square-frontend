"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { OrgBadgeChip, VerifiedBadge } from "@/components/ui/badge";
import { formatCount } from "@/lib/format";
import {
  IconBroadcastFilled,
  IconChevronUpThick,
  IconSpeaker,
} from "@/features/streams/components/live-icons";
import type { Stream } from "@/features/streams/lib/types";

const HERO_LIMIT = 7;

/**
 * The hero: featured rooms, one at a time, on a 707x296 card at radius 12.
 *
 * Measured placements — host row inset 18/7 (39px avatar, 14.83/700 name,
 * 12.12/400 handle at white-50, white Follow pill at the right), LIVE pill at
 * 26/112, headline 24.55/700 at 26/139, the green #169632 join pill at 18/204,
 * the stacked 40px chevron buttons 17 from the right, the speaker glyph 22/15
 * from the bottom-right corner, and the dot strip 21px below the card with a
 * 22x7 active dot in #5a5a5a against 7x7 in #3c3c3c.
 *
 * The design's chevrons point up and down, so the carousel advances
 * vertically. It is scroll-driven rather than on a timer: an auto-advancing
 * hero moves the pick out from under someone on a page whose whole job is
 * picking a room to enter.
 */
export function LiveHero({ streams }: { streams: Stream[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = streams.slice(0, HERO_LIMIT);

  if (slides.length === 0) return null;

  // Clamped at render rather than corrected in an effect: if the list shrinks
  // (a stream ends) the stored index can point past the end, and an effect
  // would leave a frame with no dot lit at all.
  const active = Math.min(index, slides.length - 1);

  const goTo = (position: number) => {
    const node = track.current;
    if (!node) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, position));
    node.scrollTo({ top: clamped * node.clientHeight, behavior: "smooth" });
  };

  return (
    <section className="px-4 pb-4 lg:px-6">
      <div
        ref={track}
        onScroll={() => {
          const node = track.current;
          if (node) setIndex(Math.round(node.scrollTop / Math.max(1, node.clientHeight)));
        }}
        aria-label="Featured live streams"
        className="aspect-[707/296] snap-y snap-mandatory overflow-y-auto overflow-x-hidden rounded-[12px] bg-[linear-gradient(180deg,#1c1c1c_0%,#3c3c3c_100%)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((stream, position) => {
          const owner = stream.owner;
          return (
            <div key={stream.id} className="relative h-full w-full shrink-0 snap-start">
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

              {/* The design's overlay is a single gradient from opaque black
                  to a light grey; rendered as a scrim it has to stay darkest
                  where the headline and host row sit. */}
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.25)_38%,rgba(0,0,0,0.80)_100%)]" />

              {/* Host row. Not a Link: it sits inside the card whose primary
                  action is joining, and nesting anchors is invalid markup —
                  the handle is the profile route instead. */}
              <div className="absolute inset-x-[18px] top-[7px] flex items-start gap-[10px]">
                {owner && (
                  <Avatar
                    name={owner.displayName}
                    seed={owner.id}
                    src={owner.avatarUrl}
                    size={39}
                    ring
                  />
                )}
                <div className="min-w-0 flex-1 pt-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[14.83px] font-bold leading-[15px] text-white">
                      {owner?.displayName ?? "Live now"}
                    </span>
                    {owner && (
                      <>
                        <VerifiedBadge verification={owner.verification} className="h-3 w-3" />
                        <OrgBadgeChip orgBadge={owner.orgBadge} />
                      </>
                    )}
                  </span>
                  <span className="mt-[3px] block truncate text-[12.12px] font-normal leading-[16.15px] text-white/50">
                    {owner ? `@${owner.username}` : ""}
                    {stream.viewerCount != null &&
                      `${owner ? "  . " : ""}${formatCount(stream.viewerCount)} watching`}
                  </span>
                </div>

                {owner && (
                  <Link
                    href={`/u/${owner.username}`}
                    className="ws-press mt-[5px] flex h-6 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-bold leading-none text-black transition-opacity hover:opacity-90"
                  >
                    Follow
                  </Link>
                )}
              </div>

              <span className="absolute left-[26px] top-[38%] flex h-[19px] items-center rounded-full bg-[#ff0b0b] px-[10px] text-[9.47px] font-bold leading-none text-white/80">
                Live
              </span>

              <p className="absolute inset-x-[26px] top-[47%] line-clamp-2 text-[18px] font-bold leading-[1.1] text-white sm:text-[22px] lg:text-[24.55px]">
                {stream.title}
              </p>

              <Link
                href={`/live/${stream.id}`}
                className="ws-press absolute bottom-[19%] left-[18px] flex h-[35px] items-center gap-[5px] rounded-full bg-[#169632] pl-[15px] pr-[15px] text-[10px] font-bold leading-none text-white/[0.78] transition-opacity hover:opacity-90 sm:pr-[59px]"
              >
                <IconBroadcastFilled className="h-[14px] w-[19px] text-[#0c5d06]" />
                Click to join Live
              </Link>

              {/* Decorative in the design — it marks that the preview is
                  muted. Not a control here, because there is no preview audio
                  to unmute until the room is entered. */}
              <IconSpeaker
                className="absolute bottom-[15px] right-[22px] h-6 w-6 text-white"
                key={`speaker-${position}`}
              />
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          {/* Stacked prev/next, positioned against the card. Hidden on touch,
              where the card already swipes and the buttons would be chrome
              over the artwork they scroll. */}
          <div className="pointer-events-none relative">
            <div className="pointer-events-auto absolute bottom-[calc(100%+8px)] right-[17px] hidden flex-col gap-[14px] md:flex">
              {([-1, 1] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  onClick={() => goTo(active + direction)}
                  disabled={direction === -1 ? active === 0 : active === slides.length - 1}
                  aria-label={direction === -1 ? "Previous featured stream" : "Next featured stream"}
                  className="ws-press flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-white backdrop-blur-sm transition-opacity disabled:opacity-30"
                >
                  <IconChevronUpThick
                    className={cn("h-5 w-5", direction === 1 && "rotate-180")}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-[21px] flex items-center justify-center gap-[7px]">
            {slides.map((stream, position) => (
              <button
                key={stream.id}
                type="button"
                aria-label={`Show featured stream ${position + 1}`}
                aria-current={position === active}
                onClick={() => goTo(position)}
                className={cn(
                  "h-[7px] rounded-full transition-all duration-200",
                  position === active ? "w-[22px] bg-[#5a5a5a]" : "w-[7px] bg-[#3c3c3c]"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
