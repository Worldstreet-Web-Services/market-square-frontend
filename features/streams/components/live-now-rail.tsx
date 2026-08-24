"use client";

import Link from "next/link";
import { formatCount, formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconChevronRight, IconEye } from "@/components/ui/icons";
import { useStreamList } from "@/features/streams/hooks/use-streams";
import { streamPriceLabel } from "@/features/streams/components/stream-card";

// The rail's headline module — Market Square's answer to "Today's News".
// Live streams outrank everything else in the rail because they expire: this
// is the only thing on the page that is gone if you scroll past it.
export function LiveNowRail() {
  const live = useStreamList("live");
  const upcoming = useStreamList("scheduled");

  const liveItems = live.data?.items ?? [];
  const soonItems = upcoming.data?.items ?? [];
  const pending = live.isPending || upcoming.isPending;

  return (
    <section className="ws-rail overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="ws-display text-xl">Live now</h2>
        {liveItems.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
            <span className="ws-live-dot h-1.5 w-1.5 rounded-full bg-accent" />
            {liveItems.length}
          </span>
        )}
      </div>

      {pending && (
        <div className="space-y-3 px-4 pb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-11 w-16 rounded-lg" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-2.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!pending && liveItems.length === 0 && soonItems.length === 0 && (
        <p className="px-4 pb-4 text-sm text-meta">
          Nothing live right now. Streams appear here the second they start.
        </p>
      )}

      <ul>
        {liveItems.slice(0, 3).map((stream) => (
          <li key={stream.id}>
            <Link
              href={`/live/${stream.id}?source=rail:live`}
              className="ws-rail-row flex items-start gap-3 px-4 py-2.5"
            >
              <GradientThumb seed={stream.id} className="h-11 w-16 shrink-0 rounded-lg">
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-accent">
                  <span className="ws-live-dot h-1 w-1 rounded-full bg-accent" />
                  Live
                </span>
              </GradientThumb>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-heading">
                  {stream.title}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-meta">
                  {stream.owner && <span className="truncate">{stream.owner.displayName}</span>}
                  {(stream.viewerCount || stream.peakViewers) > 0 && (
                    <span className="tnum flex shrink-0 items-center gap-1">
                      <IconEye className="h-3 w-3" />
                      {formatCount(stream.viewerCount || stream.peakViewers)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-accent">
                  {streamPriceLabel(stream)}
                </span>
              </span>
            </Link>
          </li>
        ))}

        {/* Scheduled sessions fill the module out when the square is quiet. */}
        {liveItems.length < 3 &&
          soonItems.slice(0, 3 - liveItems.length).map((stream) => (
            <li key={stream.id}>
              <Link href={`/live/${stream.id}`} className="ws-rail-row block px-4 py-2.5">
                <span className="ws-meta block text-[10px]">Upcoming</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-heading">
                  {stream.title}
                </span>
                <span className="text-xs text-meta">
                  {stream.scheduledAt ? formatDateTime(stream.scheduledAt) : "Scheduled"}
                </span>
              </Link>
            </li>
          ))}
      </ul>

      <Link
        href="/live"
        className="ws-rail-row flex items-center gap-1 px-4 py-3 text-sm font-semibold text-accent"
      >
        Show more <IconChevronRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
