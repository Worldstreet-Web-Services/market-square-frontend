"use client";

import { ColumnHeader } from "@/components/layout/column-header";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useDiscussion, FeedItemCard } from "@/features/feed";
import { FollowPill } from "@/features/profile";

/**
 * One discussion: every post carrying a tag.
 *
 * A hashtag is only worth making tappable if it goes somewhere, and "somewhere"
 * has to be the conversation itself rather than a search results page — a
 * search for "#kospi" would also return people talking ABOUT the tag without
 * being in it.
 */
export function DiscussionScreen({ tag }: { tag: string }) {
  const feed = useDiscussion(tag);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinel = useInfiniteScroll(
    () => feed.fetchNextPage(),
    Boolean(feed.hasNextPage && !feed.isFetchingNextPage)
  );

  return (
    <>
      <ColumnHeader title={`#${tag}`} subtitle="Discussion" back />

      <div className="space-y-4 px-4 py-4 lg:px-6">
        {feed.isPending && (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6 text-meta" />
          </div>
        )}

        {feed.isError && (
          <ErrorState
            error={feed.error}
            fallback="Couldn't load this discussion."
            onRetry={() => feed.refetch()}
          />
        )}

        {feed.isSuccess && items.length === 0 && (
          <EmptyState
            glyph="#"
            title={`Nothing in #${tag} yet`}
            body="Post with this tag and you start the discussion."
          />
        )}

        {items.map((item) => (
          <div key={item.id} className="ws-enter">
            <FeedItemCard
              item={item}
              followSlot={(author) => <FollowPill profile={author} variant="header" />}
            />
          </div>
        ))}

        <div ref={sentinel} />
        {feed.isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6 text-meta" />
          </div>
        )}
      </div>
    </>
  );
}
