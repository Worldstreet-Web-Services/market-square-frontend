"use client";

import { useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/badge";
import { IconSend } from "@/components/ui/icons";
import { ColumnHeader } from "@/components/layout/column-header";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAddComment, useComments, usePost } from "@/features/feed/hooks/use-feed";
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
function CommentComposer({ postId }: { postId: string }) {
  const add = useAddComment(postId);
  const gate = useGate();
  const [text, setText] = useState("");

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    gate(() => add.mutate(body, { onSuccess: () => setText("") }));
  };

  return (
    <div className="ws-hair flex items-center gap-2 border-b px-4 py-3">
      <input
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 500))}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="Post your reply…"
        aria-label="Write a reply"
        className="ws-field min-w-0 flex-1 px-4 py-2 text-[15px] text-heading outline-none placeholder:text-meta"
      />
      <button
        onClick={submit}
        disabled={!text.trim() || add.isPending}
        aria-label="Post reply"
        className="ws-press shrink-0 rounded-full bg-accent p-2 text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconSend className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PostDetailPage({
  postId,
  followSlot,
  tipSlot,
}: {
  postId: string;
  /** Composed from outside the slice — feed never imports profile. */
  followSlot?: (author: Profile) => React.ReactNode;
  /** Composed from outside the slice — the tip control lives in the tips
   *  slice and takes the POST, since a tip goes to `/posts/:id/tips`. */
  tipSlot?: (post: Post) => React.ReactNode;
}) {
  const post = usePost(postId);
  const comments = useComments(postId, true);
  // Quoting from the permalink opens the same composer the timeline uses.
  const [quoting, setQuoting] = useState<Post | null>(null);

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
          tipSlot={tipSlot}
          onQuote={(target) => setQuoting(target)}
        />
      </div>

      {quoting && (
        <div className="ws-post mx-4 mb-4">
          <Composer autoFocus quoted={quoting} onDone={() => setQuoting(null)} />
        </div>
      )}

      <CommentComposer postId={postId} />

      {comments.isPending && [0, 1].map((i) => <RowSkeleton key={i} />)}
      {comments.isError && (
        <div className="p-4">
          <ErrorState
            error={comments.error}
            fallback="Couldn't load the replies."
            onRetry={() => comments.refetch()}
          />
        </div>
      )}
      {comments.isSuccess && comments.data.items.length === 0 && (
        <div className="p-4">
          <EmptyState glyph="◇" title="No replies yet" body="Be the first to reply." />
        </div>
      )}
      {comments.data?.items.map((comment) => (
        <article key={comment.id} className="ws-row flex gap-3 px-4 py-3">
          {comment.author ? (
            <Link href={`/u/${comment.author.username}`} className="shrink-0">
              <Avatar name={comment.author.displayName} seed={comment.author.id} src={comment.author.avatarUrl} size={36} />
            </Link>
          ) : (
            <Avatar name="?" seed={comment.authorId} size={36} />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[14px]">
              {comment.author ? (
                <>
                  <Link
                    href={`/u/${comment.author.username}`}
                    className="font-bold text-heading hover:underline"
                  >
                    {comment.author.displayName}
                  </Link>
                  <VerifiedBadge verification={comment.author.verification} className="h-3.5 w-3.5" />
                  <span className="text-[13px] text-meta">@{comment.author.username}</span>
                </>
              ) : (
                <span className="font-bold text-heading">Member</span>
              )}
              <span className="text-[13px] text-meta">· {relativeTime(comment.createdAt)}</span>
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-normal text-body">
              {comment.text}
            </p>
          </div>
        </article>
      ))}
    </>
  );
}
