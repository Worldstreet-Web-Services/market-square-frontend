"use client";

import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import type { VideoItem } from "@/lib/video-context";
import { IconHeart } from "@/components/ui/icons";
import { useLikePost } from "@/features/feed/hooks/use-feed";

/**
 * The like control on an Explore card.
 *
 * This pill was originally built as a VIEWER COUNT with an eye glyph — the
 * design draws the icon `#E84A4A` on some cards and `#979797` on others, the
 * Figma node could not be fetched, and the guess was "red = live". The
 * designer has since confirmed it is a HEART: red is liked by the viewer, grey
 * is not. Recorded so the wrong reading is not re-derived.
 *
 * Colour comes from `--color-like`, not the spec's literal `#E84A4A` — the
 * token already holds exactly that red, and it exists precisely so the heart
 * cannot drift per surface. Inlining the hex here is the drift it prevents.
 *
 * It reuses `useLikePost` unchanged: one like path, with its optimistic update,
 * rollback on failure, and `reconcilePost` so a like here updates the same post
 * everywhere else it appears.
 */
export function PostLikePill({ post }: { post: VideoItem }) {
  const like = useLikePost();
  const gate = useGate();
  // Never assumed: a payload without the field renders the UNLIKED state.
  const liked = post.likedByMe ?? false;
  const label = post.text?.trim() || "this post";

  return (
    <button
      type="button"
      onClick={(event) => {
        // The card itself navigates (or opens the player) — the pill must not.
        event.preventDefault();
        event.stopPropagation();
        gate(() => like.mutate({ postId: post.id, like: !liked }));
      }}
      aria-pressed={liked}
      // A bare heart says nothing to a screen reader.
      aria-label={liked ? `Unlike ${label}` : `Like ${label}`}
      className="ws-press flex h-6 shrink-0 items-center gap-[2px] rounded-[5000px] bg-white/[0.09] px-2 py-1 transition-colors hover:bg-white/[0.14]"
    >
      <IconHeart
        className={cn("h-[14.97px] w-[14.97px]", liked ? "text-like" : "text-grey-400")}
        filled={liked}
      />
      {/* A payload without the tally renders the heart alone rather than a
          fabricated 0 — "no count available" is not "nobody liked this". */}
      {post.likeCount !== undefined && (
        <span className="tnum text-[12px] font-normal leading-4 text-white">
          {formatCount(post.likeCount)}
        </span>
      )}
    </button>
  );
}
