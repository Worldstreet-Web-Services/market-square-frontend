"use client";

import { useState } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { errorCode } from "@/lib/api/envelope";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnHeader } from "@/components/layout/column-header";
import { useBookmarks } from "@/features/feed/hooks/use-feed";
import { FeedItemCard } from "@/features/feed/components/feed-cards";
import { Composer } from "@/features/feed/components/composer";
import type { Post } from "@/features/feed/lib/types";
import type { Profile } from "@/lib/api/schemas";

/**
 * Arkmarks — the posts the viewer has saved.
 *
 * `GET /me/bookmarks` ships on the backend's own cadence. Until it lands the
 * call 404s, and that is a deployment gap rather than a fault: the surface
 * says so plainly instead of raising an error or showing invented saves.
 */
export function ArkmarksPage({
  followSlot,
  winkSlot,
  tipSlot,
}: {
  followSlot?: (author: Profile) => React.ReactNode;
  winkSlot?: (author: Profile) => React.ReactNode;
  /** Composed from outside the slice — the tip control lives in the tips
   *  slice and takes the POST, since a tip goes to `/posts/:id/tips`. */
  tipSlot?: (post: Post) => React.ReactNode;
}) {
  const { ready, authenticated, login } = useAuth();
  const bookmarks = useBookmarks();
  // Quote lives on every post card's repost menu. Without a composer to open,
  // choosing it on /arkmarks did nothing at all.
  const [quoting, setQuoting] = useState<Post | null>(null);
  const sentinel = useInfiniteScroll(
    () => bookmarks.fetchNextPage(),
    Boolean(bookmarks.hasNextPage && !bookmarks.isFetchingNextPage)
  );

  const items = bookmarks.data?.pages.flatMap((page) => page.items) ?? [];
  const unavailable = errorCode(bookmarks.error) === "NOT_FOUND";

  return (
    <>
      <ColumnHeader title="Arkmarks" subtitle="Posts you've saved from the square" />

      <div className="space-y-4 px-4 py-4 lg:px-6">
        {!ready && <Skeleton className="h-24 w-full rounded-2xl" />}

        {ready && !authenticated && (
          <EmptyState
            glyph="◇"
            title="Sign in to see your Arkmarks"
            body="Saved posts follow your account across the square."
            action={
              <button
                onClick={login}
                className="ws-btn-silver ws-press rounded-full px-5 py-2 text-[13px] font-bold"
              >
                Sign in
              </button>
            }
          />
        )}

        {ready && authenticated && quoting && (
          <div className="ws-post">
            <Composer autoFocus quoted={quoting} onDone={() => setQuoting(null)} />
          </div>
        )}

        {ready && authenticated && (
          <>
            {bookmarks.isPending && <Skeleton className="h-40 w-full rounded-2xl" />}

            {unavailable && (
              <EmptyState
                glyph="◇"
                title="Arkmarks aren't available yet"
                body="Saving posts turns on as soon as the service ships the endpoint."
              />
            )}

            {bookmarks.isError && !unavailable && (
              <ErrorState
                error={bookmarks.error}
                fallback="Couldn't load your Arkmarks."
                onRetry={() => bookmarks.refetch()}
              />
            )}

            {bookmarks.isSuccess && items.length === 0 && (
              <EmptyState
                glyph="◇"
                title="Nothing saved yet"
                body="Use the Arkmark on any post to keep it here."
              />
            )}

            {items.map((item) => (
              <div key={item.id} className="ws-enter">
                <FeedItemCard
                  item={item}
                  followSlot={followSlot}
                  winkSlot={winkSlot}
                  tipSlot={tipSlot}
                  onQuote={setQuoting}
                />
              </div>
            ))}

            <div ref={sentinel} />
            {bookmarks.isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Spinner className="h-6 w-6 text-meta" />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
