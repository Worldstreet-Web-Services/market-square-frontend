"use client";

import { useState } from "react";
import { useQueryParam } from "@/hooks/use-query-param";
import { ColumnHeader } from "@/components/layout/column-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { usePost } from "@/features/feed/hooks/use-feed";
import { CommentBox, CommentThread, type ReplyTarget } from "@/features/feed/components/comment-thread";
import { PostCard } from "@/features/feed/components/post-card";
import { Composer } from "@/features/feed/components/composer";
import type { Post } from "@/features/feed/lib/types";
import type { Profile } from "@/lib/api/schemas";

/**
 * The post permalink.
 *
 * Every surface that pointed a reader at a single post — a notification row, a
 * quoted card, a search result, the share sheet — used to link at `/?post=id`,
 * a query the home timeline never read. This is the page those links always
 * meant: the post itself, then its comments, on the same reading column.
 */
export function PostDetailPage({
  postId,
  followSlot,
  winkSlot,
  tipSlot,
}: {
  postId: string;
  /** Composed from outside the slice — feed never imports profile. */
  followSlot?: (author: Profile) => React.ReactNode;
  winkSlot?: (author: Profile) => React.ReactNode;
  /** Composed from outside the slice — the tip control lives in the tips
   *  slice and takes the POST, since a tip goes to `/posts/:id/tips`. */
  tipSlot?: (post: Post) => React.ReactNode;
}) {
  const post = usePost(postId);
  // Quoting from the permalink opens the same composer the timeline uses.
  const [quoting, setQuoting] = useState<Post | null>(null);
  // Which comment the box answers — null is a plain top-level reply. Held
  // here because the box is pinned under the header while the thread scrolls.
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  // `?comment=` — a notification lands ON the comment it is about.
  const focusCommentId = useQueryParam("comment");

  if (post.isPending) {
    return (
      <>
        <ColumnHeader title="Post" back />
        <div className="px-4 py-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </>
    );
  }

  if (post.isError) {
    return (
      <>
        <ColumnHeader title="Post" back />
        <div className="p-4">
          <ErrorState
            error={post.error}
            fallback="Couldn't load this post."
            onRetry={() => post.refetch()}
          />
        </div>
      </>
    );
  }

  const data = post.data;

  return (
    <>
      <ColumnHeader
        title="Post"
        subtitle={data.author ? `by @${data.author.username}` : undefined}
        back
      />

      <div className="px-4 py-4">
        <PostCard
          post={data}
          full
          followSlot={followSlot}
          winkSlot={winkSlot}
          tipSlot={tipSlot}
          onQuote={(target) => setQuoting(target)}
        />
      </div>

      {quoting && (
        <div className="ws-post mx-4 mb-4">
          <Composer autoFocus quoted={quoting} onDone={() => setQuoting(null)} />
        </div>
      )}

      <CommentBox postId={postId} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />

      {/* The thread — replies nest under their comment, TikTok's shape. See
          `comment-thread.tsx` for what is live and what waits on a route. */}
      <CommentThread postId={postId} onReply={setReplyTo} focusCommentId={focusCommentId} />
    </>
  );
}
