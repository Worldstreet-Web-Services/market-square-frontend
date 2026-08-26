"use client";

import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";

/**
 * A paged list that is POPULATED ON ARRIVAL.
 *
 * Extracted at the fourth call site, not the second: Explore's People, Posts,
 * Products and Streams tabs were each about to repeat the same six states —
 * loading skeletons, error with retry, "not deployed" 404, designed empty,
 * infinite-scroll sentinel, next-page spinner. Six states duplicated four
 * times is where a genuine shape has emerged; two would have been a guess.
 *
 * What it deliberately does NOT abstract is the QUERY. Each tab has its own
 * endpoint, key, parameters and schema, and a `useBrowseQuery` factory would
 * hide exactly the part worth reading at each call site while saving four
 * lines. The shell is the duplication; the query is not.
 *
 * The 404 branch is the house rule: a missing route means "not deployed yet",
 * not "broken", so the surface says so quietly instead of showing an error or
 * fabricating a list.
 */
export function BrowseList<T>({
  query,
  items,
  renderItem,
  emptyTitle,
  emptyBody,
  errorFallback,
  unavailableTitle,
  unavailableBody = "This turns on by itself once the service ships it.",
  skeletonCount = 4,
}: {
  query: Pick<
    UseInfiniteQueryResult,
    | "isPending"
    | "isError"
    | "isSuccess"
    | "error"
    | "refetch"
    | "hasNextPage"
    | "isFetchingNextPage"
    | "fetchNextPage"
  >;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyTitle: string;
  emptyBody: string;
  errorFallback: string;
  /** Set when this route may not be deployed yet; a 404 then renders quietly. */
  unavailableTitle?: string;
  unavailableBody?: string;
  skeletonCount?: number;
}) {
  const sentinel = useInfiniteScroll(
    () => query.fetchNextPage(),
    Boolean(query.hasNextPage && !query.isFetchingNextPage)
  );

  // "Not deployed" is not a failure — and only routes that opt in get this
  // reading, so a genuine 404 elsewhere still surfaces as an error.
  if (unavailableTitle && errorCode(query.error) === "NOT_FOUND") {
    return (
      <div className="p-4">
        <EmptyState glyph="◇" title={unavailableTitle} body={unavailableBody} />
      </div>
    );
  }

  return (
    <>
      {query.isPending &&
        Array.from({ length: skeletonCount }, (_, i) => <RowSkeleton key={i} />)}

      {query.isError && (
        <div className="p-4">
          <ErrorState
            error={query.error}
            fallback={errorFallback}
            onRetry={() => query.refetch()}
          />
        </div>
      )}

      {/* "Nothing here" only once there is genuinely nothing left to ask for.
          A loaded page can legitimately yield no rows — the People directory
          filters the viewer out of it — and claiming the list is empty while a
          cursor is still outstanding flashes a wrong answer before the next
          page arrives. */}
      {query.isSuccess && items.length === 0 && !query.hasNextPage && (
        <div className="p-4">
          <EmptyState glyph="◇" title={emptyTitle} body={emptyBody} />
        </div>
      )}

      {items.map((item) => renderItem(item))}

      <div ref={sentinel} />
      {query.isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6 text-meta" />
        </div>
      )}
    </>
  );
}
