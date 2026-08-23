"use client";

import Link from "next/link";
import { formatCount, formatDateTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { LiveBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconEye } from "@/components/ui/icons";
import { useFeed } from "@/features/feed/hooks/use-feed";

// The right rail: live streams and upcoming activities from the live lane.
export function HappeningNow() {
  const feed = useFeed("live");
  const items = feed.data?.pages[0]?.items ?? [];

  return (
    <div className="ws-card p-4">
      <h2 className="ws-display mb-3 text-sm">Happening now</h2>
      {feed.isPending && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
      {feed.isError && <p className="text-xs text-grey-500">Couldn&apos;t load live activity.</p>}
      {!feed.isPending && items.length === 0 && (
        <p className="text-xs text-grey-500">Nothing live right now — check back soon.</p>
      )}
      <ul className="space-y-1">
        {items.slice(0, 6).map((item) => {
          if (item.type === "stream" && item.stream) {
            const stream = item.stream;
            return (
              <li key={item.id}>
                <Link
                  href={`/live/${stream.id}`}
                  className="block rounded-2xl px-3 py-2 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <LiveBadge className="px-2 py-0 text-[9px]" />
                    <span className="flex items-center gap-1 text-[11px] text-grey-500">
                      <IconEye className="h-3 w-3" /> {formatCount(stream.peakViewers)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-semibold">{stream.title}</p>
                  <p className="truncate text-[11px] text-grey-500">{stream.owner?.displayName}</p>
                </Link>
              </li>
            );
          }
          if (item.type === "activity" && item.activity) {
            const activity = item.activity;
            const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
            const inner = (
              <>
                <p className="truncate text-xs font-semibold">{activity.title}</p>
                <p className="text-[11px] text-grey-500">{formatDateTime(activity.startsAt)}</p>
              </>
            );
            return (
              <li key={item.id}>
                {cta ? (
                  <Link href={cta.href} className="block rounded-2xl px-3 py-2 transition-colors hover:bg-white/5">
                    {inner}
                  </Link>
                ) : (
                  <div className="px-3 py-2">{inner}</div>
                )}
              </li>
            );
          }
          return null;
        })}
      </ul>
      <Link href="/live" className="mt-2 block px-3 text-xs font-semibold text-accent hover:underline">
        Go to Live →
      </Link>
    </div>
  );
}
