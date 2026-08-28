"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatCount } from "@/lib/format";
import { fetchTrendingDiscussions } from "@/features/discovery/lib/discussions";

/**
 * The discussions worth joining right now.
 *
 * A hashtag is only a discussion if you can find one you did not already know
 * about. Tags were tappable inside a post, which means the only way into a
 * conversation was to already be reading somebody talking in it — this is the
 * door for everyone else.
 *
 * Ordered by the service, which ranks on posts in a recent window. "Trending"
 * counted over all history is a list of what was once popular.
 */
export function TrendingDiscussions({ limit = 6 }: { limit?: number }) {
  const trending = useQuery({
    queryKey: ["ms", "trending-discussions", limit],
    queryFn: () => fetchTrendingDiscussions(limit),
    // Short: a list that is an hour stale is not trending.
    staleTime: 2 * 60_000,
    retry: 1,
  });

  // Nothing to show is not an error worth a slot. On a quiet deployment an
  // empty "Trending discussions" heading is worse than no heading.
  const items = trending.data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="ws-card p-4" aria-label="Trending discussions">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="ws-display text-sm text-heading">Trending discussions</h2>
        <span className="text-[11px] text-meta">Last 7 days</span>
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.tag}>
            <Link
              href={`/t/${item.tag}`}
              className="ws-press flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.06]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-spotlight-chip-ink">
                  #{item.tag}
                </span>
                {/* Only what the payload actually carries. A tally that is
                    absent renders nothing rather than a fabricated zero. */}
                <span className="mt-0.5 block truncate text-[11px] text-meta">
                  {[
                    item.participantCount !== undefined &&
                      `${formatCount(item.participantCount)} discussing`,
                    item.postCount !== undefined && `${formatCount(item.postCount)} posts`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-spotlight-chip-ink">
                Join →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
