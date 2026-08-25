"use client";

import { useDeferredValue, useState } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, Pill, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconSearch } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useQueryParam } from "@/hooks/use-query-param";
import { useDiscovery } from "@/features/discovery/hooks/use-discovery";
import { SEARCH_FILTERS, type DiscoveryResult } from "@/features/discovery/lib/types";

const FILTER_LABEL: Record<string, string> = {
  all: "Everything",
  people: "People",
  posts: "Posts",
  streams: "Streams",
  products: "Products",
};

// Surfaces that browse without needing search. Offered when search is absent.
const BROWSE = [
  { href: "/", label: "Home feed" },
  { href: "/live", label: "Live" },
  { href: "/store", label: "ARK Store" },
  { href: "/spotlight", label: "Citizen Spotlight" },
];

const ROW = "ws-row flex items-start gap-3 px-4 py-3";

/**
 * One search result, rendered from its own payload.
 *
 * Results are mixed, so each kind gets the shape that suits it rather than a
 * flattened title/subtitle row: a person reads as an identity line with their
 * badges, a post as its text, a stream and a product as their artwork.
 */
function ResultRow({ result }: { result: DiscoveryResult }) {
  if (result.kind === "profile") {
    const profile = result.profile;
    return (
      // Profile results link by USERNAME — the route is /u/[username], and
      // linking by id lands on a "not found".
      <Link href={`/u/${profile.username}`} className={ROW}>
        <Avatar name={profile.displayName} seed={profile.id} src={profile.avatarUrl} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="truncate text-[15px] font-bold text-heading">
              {profile.displayName}
            </span>
            <VerifiedBadge verification={profile.verification} className="h-3.5 w-3.5" />
            <OrgBadgeChip orgBadge={profile.orgBadge} />
            <RoleChip role={profile.role} />
          </span>
          <span className="block truncate text-[13px] text-meta">@{profile.username}</span>
          {profile.bio && (
            <span className="mt-0.5 line-clamp-2 block text-[14px] text-body">{profile.bio}</span>
          )}
        </span>
      </Link>
    );
  }

  if (result.kind === "post") {
    const post = result.post;
    const author = post.author;
    return (
      // A post result opens the POST, never its author — and never falls back
      // to the home timeline when the payload carries no author.
      <Link href={`/p/${post.id}`} className={ROW}>
        <Avatar name={author?.displayName ?? "?"} seed={author?.id} src={author?.avatarUrl} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="truncate text-[15px] font-bold text-heading">
              {author?.displayName ?? "Market update"}
            </span>
            {author && (
              <VerifiedBadge verification={author.verification} className="h-3.5 w-3.5" />
            )}
            {post.createdAt && (
              <span className="text-[13px] text-meta">· {relativeTime(post.createdAt)}</span>
            )}
          </span>
          <span className="mt-0.5 line-clamp-3 block text-[14px] leading-normal text-body">
            {post.text}
          </span>
        </span>
      </Link>
    );
  }

  if (result.kind === "stream") {
    const stream = result.stream;
    return (
      <Link href={`/live/${stream.id}`} className={ROW}>
        <GradientThumb seed={stream.id} className="h-11 w-16 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-heading">{stream.title}</span>
            {stream.status && <Pill>{stream.status}</Pill>}
          </span>
          <span className="block truncate text-[13px] text-meta">
            {[stream.owner?.displayName, stream.category].filter(Boolean).join(" · ") ||
              "Live stream"}
          </span>
        </span>
      </Link>
    );
  }

  const product = result.product;
  return (
    <Link href={`/store/${product.slug}`} className={ROW}>
      <GradientThumb seed={product.id} className="h-11 w-11 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold text-heading">{product.name}</span>
          {product.pricing && <Pill>{product.pricing === "free" ? "Free" : "KASH"}</Pill>}
        </span>
        {product.tagline && (
          <span className="block truncate text-[13px] text-meta">{product.tagline}</span>
        )}
      </span>
    </Link>
  );
}

// Kinds are interleaved, so a key must carry the kind as well as the id.
const resultKey = (result: DiscoveryResult) => `${result.kind}-${result.id}`;

// Explore: the search field IS the header, pinned, exactly as on X — the
// filter chips ride underneath it and scroll sideways on narrow columns.
export function DiscoveryPage() {
  // The ?q= seed holds until the first keystroke, which hands the field over
  // to local state — no effect syncing two sources of truth.
  const seed = useQueryParam("q");
  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? seed ?? "";
  const setQuery = setTyped;
  const [type, setType] = useState<string>("all");
  const deferredQuery = useDeferredValue(query);
  const search = useDiscovery(deferredQuery, type);
  const sentinel = useInfiniteScroll(
    () => search.fetchNextPage(),
    Boolean(search.hasNextPage && !search.isFetchingNextPage)
  );

  // 404 means the route is not deployed, not that the query failed.
  const unavailable = errorCode(search.error) === "NOT_FOUND";
  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  const hasQuery = deferredQuery.trim().length > 0;

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
              placeholder="Search people, posts, streams, products…"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none"
            />
          </label>
        </div>
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Discovery filters"
        >
          {SEARCH_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setType(filter)}
              aria-current={type === filter ? "true" : undefined}
              className={cn(
                "ws-press shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors",
                type === filter
                  ? "bg-accent text-ink"
                  : "border border-white/15 text-meta hover:bg-white/8 hover:text-body"
              )}
            >
              {FILTER_LABEL[filter]}
            </button>
          ))}
        </div>
      </header>

      {/* Search has no endpoint on the service yet: every query 404s. That is
          a deployment gap, not a fault, so the page says so and hands the
          reader the surfaces that DO browse rather than a blank result list. */}
      {unavailable && (
        <div className="p-4">
          <EmptyState
            glyph="⌕"
            title="Search isn't available yet"
            body="You can still browse the square — these all work today."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {BROWSE.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="ws-press rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
                  >
                    {entry.label}
                  </Link>
                ))}
              </div>
            }
          />
        </div>
      )}

      {/* Resting state: the service returns nothing for a blank query, so the
          page invites one instead of showing an empty result list. */}
      {!hasQuery && !unavailable && (
        <div className="p-4">
          <EmptyState
            glyph="⌕"
            title="Search the square"
            body="Find people, posts, live streams and ARK Store products."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {BROWSE.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    className="ws-press rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
                  >
                    {entry.label}
                  </Link>
                ))}
              </div>
            }
          />
        </div>
      )}

      {hasQuery && search.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}

      {search.isError && !unavailable && (
        <div className="p-4">
          <ErrorState
            error={search.error}
            fallback="Couldn't search the square."
            onRetry={() => search.refetch()}
          />
        </div>
      )}

      {hasQuery && search.isSuccess && items.length === 0 && (
        <div className="p-4">
          <EmptyState
            glyph="⌕"
            title={`No matches for “${deferredQuery.trim()}”`}
            body={
              type === "all"
                ? "Try a different name or word."
                : `Nothing in ${FILTER_LABEL[type]}. Try Everything instead.`
            }
            action={
              type !== "all" ? (
                <button
                  onClick={() => setType("all")}
                  className="ws-press rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
                >
                  Search everything
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {items.map((result) => (
        <ResultRow key={resultKey(result)} result={result} />
      ))}

      {/* Results page with the service's cursor — they used to stop dead at
          the first response's 30 matches. */}
      <div ref={sentinel} />
      {search.isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6 text-meta" />
        </div>
      )}
    </>
  );
}
