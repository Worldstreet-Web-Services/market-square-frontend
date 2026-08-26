"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconChevronRight, IconEye, IconVolume } from "@/components/ui/icons";
import type { Stream } from "@/features/streams/lib/types";

/**
 * Explore's card grid.
 *
 * Widths come from the design (170.1px card, 165.5px thumbnail, 11.03px
 * radius, 12.87px column gap, 21px row gap) but are expressed as a responsive
 * grid rather than a fixed 719px row of four: the mock is a desktop frame, and
 * a phone cannot carry four 170px cards. Columns step 2 → 3 → 4 so a card
 * never falls below the width its avatar and meta row need.
 */
const CARD_RADIUS = "11.0332px";

function CountPill({ stream }: { stream: Stream }) {
  // Live viewers ONLY. `peakViewers` is a historical high-water mark; printing
  // it here would present an old number as a current audience.
  const live = stream.status === "live" ? stream.viewerCount : null;
  if (live === null || live <= 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1 rounded-[5000px] bg-white/[0.09] px-2 py-1">
      {/*
        The design draws this glyph in #979797 on most cards and #E84A4A on
        some. UNVERIFIED — the Figma node could not be fetched (persistent 429),
        so rather than invent a rule this follows the only distinction the data
        actually supports: a live stream's count is a live audience, so it is
        red; anything else is grey. See the report — this needs confirming.
      */}
      <IconEye className={cn("h-4 w-4", stream.status === "live" ? "text-[#E84A4A]" : "text-[#979797]")} />
      <span className="tnum text-[12px] leading-4 text-white">{formatCount(live)}</span>
    </span>
  );
}

function ExploreCard({ stream }: { stream: Stream }) {
  const owner = stream.owner;

  return (
    <Link href={`/live/${stream.id}`} className="group flex flex-col gap-[7.36px]">
      <div
        className="relative aspect-[170/165] w-full overflow-hidden"
        style={{ borderRadius: CARD_RADIUS }}
      >
        {/* A missing thumbnail gets the seeded gradient, never a blank tile. */}
        <GradientThumb seed={stream.id} className="absolute inset-0 h-full w-full">
          {stream.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
            <img
              src={stream.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </GradientThumb>

        {/* Creator avatar, inset from the top-left as the design places it. */}
        {owner && (
          <span className="absolute left-[11px] top-[11px]">
            <Avatar
              name={owner.displayName}
              seed={owner.id}
              src={owner.avatarUrl}
              size={36}
            />
          </span>
        )}

        {/* Audio indicator. The design's own glyph could not be fetched, so
            this is the house speaker icon at the spec's size and position. */}
        {stream.status === "live" && (
          <span className="absolute bottom-[11px] right-[11px] flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-sm">
            <IconVolume className="h-3 w-3 text-white" />
          </span>
        )}
      </div>

      <div className="flex h-6 items-center justify-between gap-2">
        {/* Never a fabricated name: with no hydrated owner the slot stays empty
            rather than printing an id or a placeholder. */}
        <span className="min-w-0 truncate text-[11.0332px] font-bold leading-[15px] text-white">
          {owner?.displayName ?? ""}
        </span>
        <CountPill stream={stream} />
      </div>
    </Link>
  );
}

export function ExploreGrid({
  streams,
  onMore,
}: {
  streams: Stream[];
  /** Renders the More pill when there is another page to ask for. */
  onMore?: () => void;
}) {
  if (streams.length === 0) return null;

  return (
    <div className="flex flex-col gap-[21px]">
      <div className="grid grid-cols-2 gap-x-[12.87px] gap-y-[21px] sm:grid-cols-3 lg:grid-cols-4">
        {streams.map((stream) => (
          <ExploreCard key={stream.id} stream={stream} />
        ))}
      </div>

      {onMore && (
        <button
          onClick={onMore}
          className="flex h-6 w-[70px] items-center justify-center gap-1 self-center rounded-[20000px] bg-[rgba(121,114,114,0.13)] text-[10px] font-medium text-[#5A5A5A] transition-colors hover:bg-white/10"
        >
          More
          <IconChevronRight className="h-4 w-4 rotate-90" />
        </button>
      )}
    </div>
  );
}
