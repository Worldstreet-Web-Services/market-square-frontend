"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { formatCount, relativeTime } from "@/lib/format";
import { expanderLabel, groupThread, locateComment, threadOf } from "@/lib/comment-thread";
import { useGate } from "@/hooks/use-gate";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconMsComment, IconMsLike } from "@/components/ui/design-icons";
import { IconSend, IconX } from "@/components/ui/icons";
import { IconTrash } from "@/components/ui/thread-icons";
import { RowSkeleton } from "@/components/ui/skeleton";
import { PostText } from "@/components/ui/post-text";
import { useMentionTyping } from "@/features/feed/hooks/use-mention-typing";
import { MentionPicker } from "@/features/feed/components/mention-picker";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  commentsOf,
  useAddComment,
  useComment,
  useComments,
  useDeleteComment,
  useLikeComment,
  useReplies,
} from "@/features/feed/hooks/use-comments";
import type { Comment } from "@/features/feed/lib/types";

/**
 * A POST'S COMMENT THREAD — the TikTok shape.
 *
 * Top-level comments newest first; under each, its replies oldest first,
 * behind a "View N replies" expander so a page of thirty comments costs one
 * request until a thread is opened. One level of nesting, kept by the SERVER:
 * a reply is posted against the comment that was tapped, filed under the
 * top-level parent, and names the person it answered through `replyTo`.
 *
 * Every comment and reply carries a heart with a live count — `--color-like`
 * when the reader has liked it, the same red the post card's heart uses. Own
 * rows carry a delete. Reply, like and delete all sit behind `useGate` for a
 * signed-out reader.
 *
 * ─── WHAT GOES QUIET ────────────────────────────────────────────────────────
 * Replies, likes and delete are asked-for routes. Until each ships, the
 * matching control stops offering itself on the first 404 (`unavailable`)
 * rather than toasting an error on every tap — the bookmark pattern. A reply
 * still posts today: the service ignores `parentId` and files the words
 * top-level, which is the honest fallback, and the thread refetches to show
 * where they actually landed.
 *
 * ─── COMPOSITION ────────────────────────────────────────────────────────────
 * `CommentThread` draws the list and `CommentBox` the composer; the SURFACE
 * (permalink page, comments sheet) owns the `replyTo` state and hands it to
 * both, because the box sits wherever that surface puts it — pinned under the
 * header on the permalink, at the sheet's foot in the sheet.
 */
export interface ReplyTarget {
  /** The comment the reader tapped Reply on — sent as `parentId`, as is. */
  parentId: string;
  /** The top-level thread it will land in, for the bump and the refetch. */
  threadId: string;
  /** Who is being answered — "Replying to @x" above the box. */
  username: string | null;
  displayName: string;
}

/** The target a tap on Reply produces, for the surface to hold. */
export function replyTargetFor(comment: Comment): ReplyTarget {
  return {
    parentId: comment.id,
    threadId: threadOf(comment),
    username: comment.author?.username ?? null,
    displayName: comment.author?.displayName ?? "this comment",
  };
}

/**
 * The composer.
 *
 * With a `replyTo` it says who is being answered above the field and offers a
 * cancel — Escape does the same. The text is NOT prefilled with "@handle":
 * the service records who was answered from the tapped comment and returns
 * them as `replyTo`, and the reply row draws the handle from that field, so a
 * typed mention would print twice.
 */
export function CommentBox({
  postId,
  replyTo,
  onCancelReply,
  className,
}: {
  postId: string;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  className?: string;
}) {
  const add = useAddComment(postId);
  const gate = useGate();
  const field = useRef<HTMLInputElement>(null);
  // The same @-typing the post composer has: "@" opens the list, a pick
  // writes the handle and keeps the Mention to send.
  const typing = useMentionTyping({ max: 1000, field });
  const { text } = typing;

  // A tap on Reply is a tap that wants to type.
  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);

  const submit = () => {
    const body = text.trim();
    // Guarded on isPending too: Enter held down would post the same words twice.
    if (!body || add.isPending) return;
    gate(() =>
      add.mutate(
        {
          text: body,
          parentId: replyTo?.parentId ?? null,
          threadId: replyTo?.threadId ?? null,
          mentions: typing.mentionsFor(body),
        },
        {
          onSuccess: () => {
            typing.reset();
            onCancelReply();
          },
        }
      )
    );
  };

  return (
    <div className={cn("ws-hair flex flex-col gap-2 border-b px-4 py-3", className)}>
      {replyTo && (
        <div className="flex items-center justify-between gap-2 text-[13px] text-meta">
          <span className="min-w-0 truncate">
            Replying to{" "}
            <span className="font-semibold text-body">
              {replyTo.username ? `@${replyTo.username}` : replyTo.displayName}
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="ws-press flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-meta transition-colors hover:bg-white/10 hover:text-heading"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="relative flex items-center gap-2">
        <input
          ref={field}
          value={text}
          onChange={(event) => typing.update(event.target.value, event.target.selectionStart)}
          onKeyDown={(event) => {
            // With the list open, Enter is not a send and Escape closes the
            // list first; a second Escape cancels the reply.
            if (event.key === "Enter" && !typing.token) submit();
            if (event.key === "Escape") {
              event.preventDefault();
              if (typing.token) typing.dismiss();
              else if (replyTo) onCancelReply();
            }
          }}
          placeholder={replyTo ? "Write your reply…" : "Post your reply…"}
          aria-label={replyTo ? "Write a reply to this comment" : "Write a reply"}
          disabled={add.isPending}
          className="ws-field min-w-0 flex-1 px-4 py-2 text-[15px] text-heading outline-none placeholder:text-meta disabled:opacity-60"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || add.isPending}
          aria-label={replyTo ? "Post reply to comment" : "Post reply"}
          className="ws-press shrink-0 rounded-full bg-accent p-2 text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconSend className="h-4 w-4" />
        </button>
        {typing.token && <MentionPicker typing={typing} />}
      </div>
    </div>
  );
}

/**
 * The heart on a comment. The count sits under the heart, TikTok's column,
 * and the whole control is one button so the count is part of the hit area.
 */
function CommentHeart({
  comment,
  onToggle,
  disabled,
}: {
  comment: Comment;
  onToggle: () => void;
  /** Set once the like route has answered 404: still drawn, no longer live. */
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? "Liking comments isn't available yet" : undefined}
      aria-label={comment.likedByMe === true ? "Unlike this comment" : "Like this comment"}
      aria-pressed={comment.likedByMe === true}
      className={cn(
        "flex shrink-0 flex-col items-center gap-0.5 self-start transition-colors",
        comment.likedByMe === true ? "text-like" : "text-grey-400 hover:text-heading",
        disabled && "cursor-not-allowed"
      )}
    >
      <IconMsLike className="h-5 w-5" filled={comment.likedByMe === true} />
      <span className="tnum text-[11px] leading-4 text-grey-300">
        {formatCount(comment.likeCount)}
      </span>
    </button>
  );
}

function CommentRow({
  comment,
  answering,
  reply,
  onReply,
  like,
  remove,
  isMine,
  gate,
  highlighted = false,
  className,
  children,
}: {
  comment: Comment;
  /** For a reply: the person it answered, from the payload's `replyTo`. */
  answering?: Comment["replyTo"];
  reply?: boolean;
  onReply: (comment: Comment) => void;
  like: ReturnType<typeof useLikeComment>;
  remove: ReturnType<typeof useDeleteComment>;
  isMine: boolean;
  gate: (action: () => void) => void;
  /** The comment the permalink was opened on — a brief tint, then it fades. */
  highlighted?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const author = comment.author;
  const size = reply ? 28 : 36;
  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        "ws-row flex gap-3 px-4 py-3 transition-colors duration-700 motion-reduce:transition-none",
        // A reply is indented by the parent's avatar column: 36 + the 12 gap.
        reply && "pl-16",
        // The purple ramp's light stop at a wash, so the row the reader was
        // sent to is unmistakable and still reads as the same row once it fades.
        highlighted && "bg-create/10",
        className
      )}
    >
      {author ? (
        <Link href={`/u/${author.username}`} className="shrink-0">
          <Avatar name={author.displayName} seed={author.id} src={author.avatarUrl} size={size} />
        </Link>
      ) : (
        <Avatar name="?" seed={comment.authorId} size={size} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px]">
          {author ? (
            <>
              <Link href={`/u/${author.username}`} className="font-bold text-heading hover:underline">
                {author.displayName}
              </Link>
              <VerifiedBadge verification={author.verification} className="h-3.5 w-3.5 shrink-0" />
              <OrgBadgeChip orgBadge={author.orgBadge} />
              <RoleChip role={author.role} className="shrink-0" />
              <span className="text-[13px] text-meta">@{author.username}</span>
            </>
          ) : (
            <span className="font-bold text-heading">Member</span>
          )}
          <span className="text-[13px] text-meta">· {relativeTime(comment.createdAt)}</span>
        </p>
        {/* The "@handle" a reply opens with is the RESOLVED person from
            `replyTo` — a link, never a parse of the text — and absent when
            the reply answered the parent directly or the account is gone. */}
        <div className="mt-0.5 text-[15px] leading-normal text-body">
          {reply && answering && (
            <Link
              href={`/u/${answering.username}`}
              className="mr-1 font-semibold text-create hover:underline"
            >
              @{answering.username}
            </Link>
          )}
          {/* The one renderer for post-shaped text: mentions become links
              from the RESOLVED `mentions` field, never a second parser. */}
          <PostText text={comment.text} mentions={comment.mentions} className="inline" />
        </div>
        <div className="mt-1.5 flex items-center gap-4 text-[13px] font-semibold text-meta">
          <button
            type="button"
            onClick={() => gate(() => onReply(comment))}
            className="transition-colors hover:text-heading"
          >
            Reply
          </button>
          {isMine && (
            <button
              type="button"
              disabled={remove.unavailable || remove.isPending}
              title={remove.unavailable ? "Deleting comments isn't available yet" : undefined}
              onClick={() =>
                gate(() => remove.mutate({ commentId: comment.id, parentId: comment.parentId }))
              }
              aria-label="Delete your comment"
              className="flex items-center gap-1 transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
        {children}
      </div>
      <CommentHeart
        comment={comment}
        disabled={like.unavailable}
        onToggle={() =>
          gate(() => like.mutate({ commentId: comment.id, like: comment.likedByMe !== true }))
        }
      />
    </article>
  );
}

/**
 * One top-level comment with its replies behind the expander.
 *
 * Replies the PAGE already carried (a backend that interleaves) are shown at
 * once; the expander then fetches the rest through the replies route. The
 * count on the expander is the server's `replyCount` less what is on screen.
 */
function Thread({
  comment,
  inlineReplies,
  onReply,
  like,
  remove,
  myId,
  gate,
  openInitially = false,
  flashId,
}: {
  comment: Comment;
  inlineReplies: Comment[];
  onReply: (comment: Comment) => void;
  like: ReturnType<typeof useLikeComment>;
  remove: ReturnType<typeof useDeleteComment>;
  myId: string | undefined;
  gate: (action: () => void) => void;
  /** The permalink was opened on one of this thread's replies: start expanded. */
  openInitially?: boolean;
  /** The id currently tinted, if it is on this thread. */
  flashId?: string | null;
}) {
  const [open, setOpen] = useState(openInitially);
  const fetched = useReplies(comment.id, open);
  const fetchedItems = fetched.data?.pages.flatMap((page) => page.items) ?? [];
  // Inline first, then fetched, deduplicated on id — the same reply can arrive
  // both ways once the backend fills `parentId` in on the page.
  const seen = new Set<string>();
  const replies = [...inlineReplies, ...(open ? fetchedItems : [])].filter((item) =>
    seen.has(item.id) ? false : (seen.add(item.id), true)
  );
  const count = Math.max(comment.replyCount, inlineReplies.length);
  const label = expanderLabel(count, replies.length, open);

  return (
    <CommentRow
      comment={comment}
      onReply={onReply}
      like={like}
      remove={remove}
      isMine={Boolean(myId && comment.authorId === myId)}
      gate={gate}
      highlighted={flashId === comment.id}
    >
      {label && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-meta transition-colors hover:text-heading"
        >
          <span aria-hidden className="ws-hair h-px w-6 border-t" />
          {label}
        </button>
      )}
      {open && fetched.isPending && <RowSkeleton />}
      {/* A 404 is the route not being deployed yet, not a failed thread: the
          expander stays honest about the count and the row says nothing. */}
      {open && fetched.isError && errorCode(fetched.error) !== "NOT_FOUND" && (
        <p className="mt-2 text-[13px] text-meta">Couldn&apos;t load the replies.</p>
      )}
      {open && fetched.hasNextPage && (
        <button
          type="button"
          onClick={() => fetched.fetchNextPage()}
          disabled={fetched.isFetchingNextPage}
          className="mt-2 text-[13px] font-semibold text-meta transition-colors hover:text-heading disabled:opacity-40"
        >
          View more replies
        </button>
      )}
      {replies.length > 0 && (
        <div className="-mx-4 mt-2 -mb-3 border-t border-white/5">
          {replies.map((item) => {
            return (
              <CommentRow
                key={item.id}
                comment={item}
                reply
                answering={item.replyTo}
                onReply={onReply}
                like={like}
                remove={remove}
                isMine={Boolean(myId && item.authorId === myId)}
                gate={gate}
                highlighted={flashId === item.id}
                className="pl-16"
              />
            );
          })}
        </div>
      )}
    </CommentRow>
  );
}

export function CommentThread({
  postId,
  enabled = true,
  onReply,
  focusCommentId = null,
  emptyTitle = "No replies yet",
  emptyBody = "Be the first to reply.",
}: {
  postId: string;
  enabled?: boolean;
  onReply: (target: ReplyTarget) => void;
  /**
   * The comment the page was opened ON (`?comment=` — where a "replied to
   * your comment" notification lands). Its thread opens, it scrolls into
   * view, and it is tinted for a moment. Only a loaded comment can be found;
   * see `locateComment`.
   */
  focusCommentId?: string | null;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const comments = useComments(postId, enabled);
  const like = useLikeComment();
  const remove = useDeleteComment(postId);
  const me = useMe();
  const gate = useGate();
  const reduced = useReducedMotion();
  const items = commentsOf(comments.data);
  const threads = groupThread(items);
  /*
    THE DEEP LINK reads the comment itself (`GET /comments/:id`): a reply's id
    is never on the top-level page, so only the service can say which thread
    to open. What is already loaded is the fast path while that answers.
  */
  const focused = useComment(focusCommentId, Boolean(focusCommentId));
  const located = focused.data
    ? { commentId: focused.data.id, parentId: focused.data.parentId }
    : locateComment(items, focusCommentId);

  /*
    SCROLL ONCE, WHEN THE ROW EXISTS. The row may arrive a beat after the
    data (a reply's thread has to open and its replies fetch), so this waits
    for the element for up to ~3s rather than firing against nothing. The
    tint clears itself; under reduced motion the scroll is a jump and the
    tint is simply on, then off.
  */
  const [flashId, setFlashId] = useState<string | null>(null);
  const targetId = located?.commentId ?? null;
  useEffect(() => {
    if (!targetId) return;
    let cancelled = false;
    let tries = 0;
    let clear: number | undefined;
    const attempt = () => {
      if (cancelled) return;
      const node = document.getElementById(`comment-${targetId}`);
      if (!node) {
        if (tries++ < 90) requestAnimationFrame(attempt);
        return;
      }
      node.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      setFlashId(targetId);
      clear = window.setTimeout(() => setFlashId(null), 1800);
    };
    attempt();
    return () => {
      cancelled = true;
      if (clear) window.clearTimeout(clear);
    };
  }, [targetId, reduced]);

  if (comments.isPending) return <>{[0, 1].map((i) => <RowSkeleton key={i} />)}</>;
  if (comments.isError)
    return (
      <div className="p-4">
        <ErrorState
          error={comments.error}
          fallback="Couldn't load the replies."
          onRetry={() => comments.refetch()}
        />
      </div>
    );
  if (threads.length === 0)
    return (
      <div className="p-4">
        <EmptyState icon={<IconMsComment className="h-5 w-5" />} title={emptyTitle} body={emptyBody} />
      </div>
    );

  return (
    <>
      {threads.map(({ comment, replies }) => (
        <Thread
          key={comment.id}
          comment={comment}
          inlineReplies={replies}
          onReply={(target) => onReply(replyTargetFor(target))}
          like={like}
          remove={remove}
          myId={me.data?.id}
          gate={gate}
          openInitially={located?.parentId === comment.id}
          flashId={flashId}
        />
      ))}
      {comments.hasNextPage && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => comments.fetchNextPage()}
            disabled={comments.isFetchingNextPage}
            className="text-[13px] font-semibold text-meta transition-colors hover:text-heading disabled:opacity-40"
          >
            More comments
          </button>
        </div>
      )}
    </>
  );
}
