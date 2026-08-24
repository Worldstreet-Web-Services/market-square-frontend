"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TransitionLink } from "@/components/ui/transition-link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { isVideoPost } from "@/lib/media";
import { InlineVideo } from "@/components/ui/inline-video";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconFlag, IconSend } from "@/components/ui/icons";
import {
  IconMsBookmark,
  IconMsComment,
  IconMsLike,
  IconMsMore,
  IconMsRepost,
  IconMsShare,
} from "@/components/ui/design-icons";
import { formatCount } from "@/lib/format";
import {
  useAddComment,
  useBookmarkPost,
  useLikePost,
  useReport,
  useRepostPost,
} from "@/features/feed/hooks/use-feed";
import { CommentsSheet } from "@/features/feed/components/comments-sheet";
import type { Post, ReportReason } from "@/features/feed/lib/types";
import type { Profile } from "@/lib/api/schemas";

// Labels map onto the backend's fixed reason enum.
const REPORT_REASONS: Array<{ reason: ReportReason; label: string }> = [
  { reason: "spam", label: "Spam" },
  { reason: "scam", label: "Scam or fraud" },
  { reason: "abuse", label: "Harassment or abuse" },
  { reason: "other", label: "Something else" },
];

function ReportMenu({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const report = useReport();
  const gate = useGate();
  return (
    <div className="relative">
      {/* The design draws "more" as a ringed 38px disc at the end of the
          action row, not as a bare glyph in the header. */}
      <button
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/10 text-grey-100 transition-colors hover:bg-white/10"
      >
        <IconMsMore className="h-6 w-6" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="ws-glass absolute right-0 z-20 mt-1 w-56 rounded-2xl p-1.5">
            <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-meta">
              <IconFlag className="h-3.5 w-3.5" /> Report
            </p>
            {REPORT_REASONS.map(({ reason, label }) => (
              <button
                key={reason}
                onClick={() => {
                  setOpen(false);
                  gate(() => report.mutate({ targetType: "post", targetId, reason }));
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Count action: a 24px glyph, a 2px gap, then the tally.
 *
 * The design groups the three of these inside one soft pill, so the hover
 * affordance is the glyph tinting up rather than `ws-action`'s halo — a halo
 * inside a pill reads as two overlapping surfaces.
 */
function CountAction({
  label,
  count,
  active,
  activeClass = "text-heading",
  onClick,
  children,
}: {
  label: string;
  count: number;
  active?: boolean;
  activeClass?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex shrink-0 items-center gap-0.5 transition-colors"
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center transition-colors",
          active ? activeClass : "text-grey-400 hover:text-heading"
        )}
      >
        {children}
      </span>
      <span className="tnum text-[12px] text-heading">{formatCount(count)}</span>
    </button>
  );
}

/** A bare 24px glyph action — share, Arkmark, more. */
function GlyphAction({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "text-featured" : "text-body hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}

/** The design's inline reply field — comment without leaving the timeline. */
function InlineComment({ postId }: { postId: string }) {
  const add = useAddComment(postId);
  const gate = useGate();
  const me = useMe();
  const [text, setText] = useState("");

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    gate(() => add.mutate(body, { onSuccess: () => setText("") }));
  };

  return (
    <div className="ws-comment-field flex h-10 min-w-0 flex-1 items-center gap-2 px-2">
      <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={24} />
      <input
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 500))}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="Comment here..."
        aria-label="Write a comment"
        className="min-w-0 flex-1 bg-transparent text-[12px] text-heading outline-none placeholder:text-grey-700"
      />
      {text.trim() && (
        <button
          onClick={submit}
          disabled={add.isPending}
          aria-label="Post comment"
          className="shrink-0 rounded-full p-1 text-accent transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <IconSend className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function PostCard({
  post,
  repostedBy,
  followSlot,
}: {
  post: Post;
  /** Set when this post reached the timeline through someone's repost. */
  repostedBy?: Profile | null;
  /** Composed from outside the slice — feed never imports profile. */
  followSlot?: (author: Profile) => React.ReactNode;
}) {
  const like = useLikePost();
  const repost = useRepostPost();
  const bookmark = useBookmarkPost();
  const gate = useGate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const author = post.author;
  const cta = post.deepLink ? resolveDeepLink(post.deepLink, `feed:post:${post.id}`) : null;

  const share = async () => {
    const url = `${window.location.origin}/u/${author?.username ?? ""}`;
    try {
      if (navigator.share) await navigator.share({ text: post.text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed share sheets are not errors */
    }
  };

  return (
    <article className="ws-post p-4">
      {/* Repost attribution. The card still belongs to the original author —
          this line only says who passed it along. */}
      {repostedBy && (
        <p className="mb-2 flex items-center gap-1.5 pl-1 text-[12px] text-white/50">
          <IconMsRepost className="h-3.5 w-3.5 shrink-0" />
          <Link href={`/u/${repostedBy.username}`} className="truncate hover:underline">
            {repostedBy.displayName}
          </Link>
          <span>reposted</span>
        </p>
      )}

      {/* Identity row: author, role badge, timestamp, follow state. */}
      <header className="flex items-center gap-2.5">
        {author ? (
          <TransitionLink href={`/u/${author.username}`} className="shrink-0">
            <Avatar name={author.displayName} src={author.avatarUrl} size={39} />
          </TransitionLink>
        ) : (
          <Avatar name="?" size={39} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            {author && (
              <>
                <Link
                  href={`/u/${author.username}`}
                  className="truncate text-[14px] font-bold leading-5 text-white hover:underline"
                >
                  {author.displayName}
                </Link>
                <VerifiedBadge verification={author.verification} className="h-3.5 w-3.5" />
                <RoleChip role={author.role} />
              </>
            )}
          </div>
          <p className="truncate text-[12px] leading-4 text-white/50">
            {author ? `@${author.username}  •  ` : ""}
            {relativeTime(post.createdAt)}
          </p>
        </div>
        {author && followSlot?.(author)}
      </header>

      {/* The design rules the identity row off from the body. */}
      <hr className="ws-post-rule mt-4 border-t" />

      {/* mediaUrl carries both images and clips; the upload endpoint only
          issues mp4/webm for video, so extension sniffing is enough. */}
      {post.mediaUrl &&
        (isVideoPost(post) ? (
          <InlineVideo
            src={post.mediaUrl}
            poster={post.thumbnailUrl}
            className="mt-4 h-[420px] w-full rounded-xl"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
          <img
            src={post.mediaUrl}
            alt=""
            className="mt-4 max-h-[420px] w-full rounded-xl object-cover"
          />
        ))}

      <p className="mt-3 whitespace-pre-wrap break-words text-[13.8px] leading-[23px] text-white/90">
        {post.text}
      </p>

      {cta && (
        <Link
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noreferrer" : undefined}
          className="ws-hair ws-rail-row mt-3 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5"
        >
          <span className="truncate text-[13px] font-semibold text-heading">{cta.label}</span>
          <span className="shrink-0 text-[13px] text-accent">Open →</span>
        </Link>
      )}

      {/* Action row. The design groups it as: a tallies pill, the inline reply
          pill, then share / Arkmark / more standing free at the end. */}
      <div className="mt-5 flex items-center gap-6">
        <div className="ws-action-pill flex h-10 shrink-0 items-center gap-[17px] px-2">
          <CountAction
            label="Comments"
            count={post.commentCount}
            onClick={() => setCommentsOpen(true)}
          >
            <IconMsComment className="h-[18px] w-[18px]" />
          </CountAction>
          <CountAction
            label={post.repostedByMe ? "Undo repost" : "Repost"}
            count={post.repostCount}
            active={post.repostedByMe}
            activeClass="text-up"
            onClick={() =>
              gate(() => repost.mutate({ postId: post.id, repost: !post.repostedByMe }))
            }
          >
            <IconMsRepost className="h-[18px] w-[18px]" />
          </CountAction>
          {/* Liked is amber in the design, not red — the same semantic amber
              that marks featured and premium elsewhere. */}
          <CountAction
            label={post.likedByMe ? "Unlike" : "Like"}
            count={post.likeCount}
            active={post.likedByMe}
            activeClass="text-featured"
            onClick={() => gate(() => like.mutate({ postId: post.id, like: !post.likedByMe }))}
          >
            <IconMsLike className="h-[18px] w-[18px]" />
          </CountAction>
        </div>

        <InlineComment postId={post.id} />

        <div className="flex shrink-0 items-center gap-[17px]">
          <div className="flex items-center gap-3">
            <GlyphAction label="Share" onClick={share}>
              <IconMsShare className="h-5 w-5" />
            </GlyphAction>
            {/* Arkmark. While the endpoint is absent the control goes quiet
                rather than pretending the save landed. */}
            <GlyphAction
              label={
                bookmark.unavailable
                  ? "Arkmarks aren't available yet"
                  : post.bookmarkedByMe
                    ? "Remove from Arkmarks"
                    : "Save to Arkmarks"
              }
              active={post.bookmarkedByMe}
              disabled={bookmark.unavailable}
              onClick={() =>
                gate(() =>
                  bookmark.mutate({ postId: post.id, bookmark: !post.bookmarkedByMe })
                )
              }
            >
              <IconMsBookmark className="h-5 w-5" />
            </GlyphAction>
          </div>
          <ReportMenu targetId={post.id} />
        </div>
      </div>

      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </article>
  );
}
