"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconBroadcast } from "@/features/streams/components/live-icons";
import type { Stream } from "@/features/streams/lib/types";
import { sq } from "@/lib/square-path";

/**
 * One live room in the grid, drawn to the design's measurements.
 *
 * Thumbnail 230x112 at radius 12, avatar inset 8/8, LIVE pill inset 6/5. The
 * meta row sits 11px below the image: name on the left, viewer count in a
 * white/9 pill on the right. Widths flex because the grid owns the column —
 * a hard 230px matches the design at exactly one viewport — but every inset,
 * radius, size and weight below is the measured value.
 */
export function LiveTile({ stream, className }: { stream: Stream; className?: string }) {
  const owner = stream.owner;
  // peakViewers is a historical high-water mark, NOT who is here now, so the
  // pill renders only when the payload carries a live count. "0 watching" on a
  // room that simply does not report one would be a lie.
  const watching = stream.viewerCount;

  return (
    <Link
      href={sq(`/live/${stream.id}`)}
      className={cn("ws-press group block min-w-0", className)}
      style={{ viewTransitionName: `stream-${stream.id}` }}
    >
      <div className="relative aspect-[230/112] w-full overflow-hidden rounded-[12px]">
        {stream.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- author-supplied host
          <img
            src={stream.thumbnailUrl}
            alt=""
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <GradientThumb seed={stream.id} className="h-full w-full" />
        )}

        {/* The avatar and pill sit on artwork the design cannot predict, so
            they carry their own scrim rather than trusting the frame behind. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/45 to-transparent" />

        {owner && (
          <span className="absolute left-2 top-2">
            <Avatar name={owner.displayName} seed={owner.id} src={owner.avatarUrl} size={24} />
          </span>
        )}

        <span className="absolute right-[6px] top-[5px] flex h-[19px] items-center justify-center rounded-full bg-[#ff0b0b] px-[10px] text-[9.47px] font-bold leading-none text-white/80">
          Live
        </span>
      </div>

      <div className="mt-[11px] flex h-6 items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[11.03px] font-bold leading-none text-white">
          {owner?.displayName ?? stream.title}
        </p>

        {watching != null && (
          <span className="flex h-6 shrink-0 items-center gap-[6px] rounded-full bg-white/[0.09] px-2">
            <IconBroadcast className="h-[14px] w-[19px] text-white" />
            <span className="text-[12px] font-normal leading-none text-white">
              {formatCount(watching)}
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
