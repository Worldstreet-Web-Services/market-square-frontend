"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Pill } from "@/components/ui/badge";
import { IconSearch } from "@/components/ui/icons";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useQueryParam } from "@/hooks/use-query-param";
import { useDiscovery } from "@/features/discovery/hooks/use-discovery";

const FILTERS = ["all", "profile", "stream", "activity", "product", "content"] as const;

const GLYPH: Record<string, string> = {
  profile: "◎",
  stream: "◉",
  product: "◈",
  activity: "◇",
};

// Explore: the search field IS the header, pinned, exactly as on X — the
// filter chips ride underneath it and scroll sideways on narrow columns.
export function DiscoveryPage() {
  // The ?q= seed holds until the first keystroke, which hands the field over
  // to local state — no effect syncing two sources of truth.
  const seed = useQueryParam("q");
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? seed ?? "";
  const setQuery = setTyped;
  const [type, setType] = useState<(typeof FILTERS)[number]>("all");
  const deferredQuery = useDeferredValue(query);
  const search = useDiscovery(deferredQuery, type);

  return (
    <>
      <header className="ws-head sticky top-0 z-30">
        <div className="px-4 py-2.5">
          <label className="ws-field flex h-11 items-center gap-3 px-4">
            <IconSearch className="h-5 w-5 shrink-0 text-meta" />
            <span className="sr-only">Search Market Square</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people, streams, products…"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none"
            />
          </label>
        </div>
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Discovery filters"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setType(filter)}
              className={cn(
                "ws-press shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold capitalize transition-colors",
                type === filter
                  ? "bg-accent text-ink"
                  : "border border-white/15 text-meta hover:bg-white/8 hover:text-body"
              )}
            >
              {filter === "all" ? "Everything" : filter}
            </button>
          ))}
        </div>
      </header>

      {search.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}
      {search.isError && (
        <div className="p-4">
          <ErrorState
            error={search.error}
            fallback="Couldn't search the square."
            onRetry={() => search.refetch()}
          />
        </div>
      )}
      {search.isSuccess && search.data.items.length === 0 && (
        <div className="p-4">
          <EmptyState glyph="⌕" title="No matches" body="Try another name, category or activity." />
        </div>
      )}

      {search.data?.items.map((item) => (
        <Link
          key={`${item.type}-${item.id}`}
          href={item.href}
          className="ws-row flex items-start gap-3 px-4 py-3"
        >
          <span className="ws-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-body">
            {GLYPH[item.type] ?? "◇"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[15px] font-bold text-heading">{item.title}</span>
              {item.status && (
                <Pill tone={item.status === "live" ? "accent" : "neutral"} className="px-2 py-0 text-[10px]">
                  {item.status}
                </Pill>
              )}
            </span>
            {item.subtitle && (
              <span className="mt-0.5 line-clamp-2 block text-[15px] leading-normal text-meta">
                {item.subtitle}
              </span>
            )}
            <span className="mt-1 block text-[13px] font-semibold text-accent">
              {item.actionLabel} →
            </span>
          </span>
        </Link>
      ))}
    </>
  );
}
