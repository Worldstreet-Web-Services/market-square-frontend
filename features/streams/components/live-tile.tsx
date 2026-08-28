"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import type { Stream } from "@/features/streams/lib/types";

/**
 * One live stream, as the design draws it.
 *
 * A 12px-radius thumbnail carrying two things and nothing else: the host's
 * avatar top-left and a LIVE pill top-right. Identity and status are what a
 * browsing eye actually sorts on, and everything else — title, host, viewers —
 * sits BELOW the image where it can be read at reading size rather than
 * fighting the artwork for contrast.
 *
 * The measured tile is 230x112, a 2.05:1 crop. That ratio is kept and the
 * width is not: a fixed 230px tile leaves a ragged column on every screen that
 * is not 1920 wide. The rail sizes the tile; this keeps its shape.
 */
export function LiveTile({ stream, className }: { stream: Stream; className?: string }) {
  const owner = stream.owner;
  // peakViewers is a historical high-water mark, NOT who is here now. Showing
  // it as "watching" would overstate every quiet room on the page.
  const watching = stream.viewerCount;

  return (
    <Link
      href={`/live/${stream.id}`}
      className={cn("ws-press group block", className)}
      style={{ viewTransitionName: `stream-${stream.id}` }}
    >
      <div className="relative aspect-[230/112] w-full overflow-hidden rounded-xl">
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

        {/* Sits ON the artwork, so it carries its own scrim rather than
            trusting whatever frame the stream happens to be showing. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/55 to-transparent" />

        {owner && (
          <span className="absolute left-2 top-2">
            <Avatar name={owner.displayName} seed={owner.id} src={owner.avatarUrl} size={24} />
          </span>
        )}

        {/* The design's #ff0b0b, fully rounded, 9.5px bold. Red because it is
            the one status on the page that expires while you look at it. */}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[#ff0b0b] px-2 py-[3px] text-[9.5px] font-bold uppercase leading-none tracking-[0.02em] text-white">
          <span className="h-1 w-1 rounded-full bg-white" aria-hidden />
          Live
        </span>
      </div>

      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold leading-4 text-white">
            {stream.title}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-normal leading-[15px] text-white/60">
            {owner ? `@${owner.username}` : "Live now"}
            {/* Rendered only when the payload carries it: "0 watching" on a
                room that simply does not report a count is a lie. */}
            {watching != null && ` · ${formatCount(watching)} watching`}
          </p>
        </div>
      </div>
    </Link>
  );
}
