"use client";

import Link from "next/link";
import { IconChevronRight } from "@/components/ui/icons";
import { LiveTile } from "@/features/streams/components/live-tile";
import type { Stream } from "@/features/streams/lib/types";

/** The design shows two rows of three before the section defers to "View all". */
const PREVIEW_LIMIT = 6;

/**
 * One category of live rooms: a hairline rule, a header, then a 3-up grid.
 *
 * The rule spans the full column (the design bleeds it past the content
 * gutters), the header carries the title at 16px/600 with "View all" at
 * 12px/700 white-40 and a 21px circular chevron, and the grid is 3 columns
 * with a 14px gutter and a 31px row gap — all measured values.
 *
 * A grid rather than a carousel: the design commits to showing six rooms at
 * once and handing overflow to "View all", which is the honest shape when
 * every tile is a decision. Below `sm` it drops to two columns, then one.
 */
export function LiveSection({
  title,
  streams,
  viewAllHref,
}: {
  title: string;
  streams: Stream[];
  viewAllHref?: string;
}) {
  // A heading over nothing reads as a failed load rather than a quiet
  // category, so an empty section renders nothing at all.
  if (streams.length === 0) return null;

  const shown = streams.slice(0, PREVIEW_LIMIT);
  // "View all" appears only when it would actually reveal something. A link
  // that re-shows the same six rooms is a dead control.
  const hasMore = streams.length > shown.length;

  return (
    <section className="border-t border-white/10 pt-4">
      <div className="flex h-[38px] items-center justify-between gap-4 px-4 lg:px-6">
        <h2 className="truncate text-[16px] font-semibold leading-none text-white">{title}</h2>

        {hasMore && viewAllHref && (
          <Link
            href={viewAllHref}
            className="ws-press flex shrink-0 items-center gap-2 text-[12px] font-bold text-white/40 transition-colors hover:text-white"
          >
            View all
            <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white/[0.04]">
              <IconChevronRight className="h-[11px] w-[11px]" />
            </span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-[14px] gap-y-[31px] px-4 pb-6 pt-2 sm:grid-cols-3 lg:px-6">
        {shown.map((stream) => (
          <LiveTile key={stream.id} stream={stream} />
        ))}
      </div>
    </section>
  );
}
