"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TransitionLink } from "@/components/ui/transition-link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { isVideoUrl } from "@/lib/media";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { RoleChip, VerifiedBadge } from "@/components/ui/badge";
import {
  IconComment,
  IconDots,
  IconFlag,
  IconHeart,
  IconRepost,
  IconSend,
  IconShare,
} from "@/components/ui/icons";
import { formatCount } from "@/lib/format";
import {
  useAddComment,
  useLikePost,
  useReport,
  useRepostPost,
} from "@/features/feed/hooks/use-feed";
import { CommentsSheet } from "@/features/feed/components/comments-sheet";
import type { Post, ReportReason } from "@/features/feed/lib/types";

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
      <button
        aria-label="More options"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-meta transition-colors hover:bg-white/10 hover:text-heading"
      >
        <IconDots className="h-4 w-4" />
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

/** Count action: icon, tally, and a hover halo that never shifts the row. */
function CountAction({
  label,
  count,
  active,
  tone = "neutral",
  onClick,
  children,
}: {
  label: string;
  count: number;
  active?: boolean;
  tone?: "neutral" | "up" | "down";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "ws-action text-[13px]",
        active
          ? tone === "down"
            ? "text-like"
            : tone === "up"
              ? "text-up"
              : "text-heading"
          : "text-meta",
        tone === "down" ? "hover:text-like" : tone === "up" ? "hover:text-up" : "hover:text-heading"
      )}
    >
      <span className="relative">{children}</span>
      <span className="tnum">{formatCount(count)}</span>
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
    <div className="ws-comment-field flex min-w-0 flex-1 items-center gap-2 px-2 py-1">
      <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={20} />
      <input
        value={text}
        onChange={(event) => setText(event.target.value.slice(0, 500))}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="Comment here"
        aria-label="Write a comment"
        className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-meta"
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

export function PostCard({ post }: { post: Post }) {
  const like = useLikePost();
  const repost = useRepostPost();
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
    <article className="ws-post p-3">
      {/* Identity row: author, badges, timestamp, follow state. */}
      <header className="flex items-center gap-2.5 px-1">
        {author ? (
          <TransitionLink href={`/u/${author.username}`} className="shrink-0">
            <Avatar name={author.displayName} src={author.avatarUrl} size={36} />
          </TransitionLink>
        ) : (
          <Avatar name="?" size={36} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            {author && (
              <>
                <Link
                  href={`/u/${author.username}`}
                  className="truncate text-[14px] font-bold text-heading hover:underline"
                >
                  {author.displayName}
                </Link>
                <VerifiedBadge verification={author.verification} className="h-3.5 w-3.5" />
                <RoleChip role={author.role} />
              </>
            )}
          </div>
          <p className="truncate text-[11px] text-meta">
            {author ? `@${author.username} · ` : ""}
            {relativeTime(post.createdAt)}
          </p>
        </div>
        <ReportMenu targetId={post.id} />
      </header>

      {/* mediaUrl carries both images and clips; the upload endpoint only
          issues mp4/webm for video, so extension sniffing is enough. */}
      {post.mediaUrl &&
        (isVideoUrl(post.mediaUrl) ? (
          <video
            src={post.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="ws-hair mt-3 max-h-[420px] w-full rounded-2xl border"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
          <img
            src={post.mediaUrl}
            alt=""
            className="ws-hair mt-3 max-h-[420px] w-full rounded-2xl border object-cover"
          />
        ))}

      <p className="mt-3 whitespace-pre-wrap break-words px-1 text-[13px] leading-relaxed text-body">
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

      {/* Action row: three tallies, the inline reply, then share and more. */}
      <div className="mt-3 flex items-center gap-3 px-1">
        <div className="flex shrink-0 items-center gap-4">
          <CountAction
            label="Comments"
            count={post.commentCount}
            onClick={() => setCommentsOpen(true)}
          >
            <IconComment className="h-4 w-4" />
          </CountAction>
          <CountAction
            label={post.repostedByMe ? "Undo repost" : "Repost"}
            count={post.repostCount}
            active={post.repostedByMe}
            tone="up"
            onClick={() =>
              gate(() => repost.mutate({ postId: post.id, repost: !post.repostedByMe }))
            }
          >
            <IconRepost className="h-4 w-4" />
          </CountAction>
          <CountAction
            label={post.likedByMe ? "Unlike" : "Like"}
            count={post.likeCount}
            active={post.likedByMe}
            tone="down"
            onClick={() => gate(() => like.mutate({ postId: post.id, like: !post.likedByMe }))}
          >
            <IconHeart className="h-4 w-4" filled={post.likedByMe} />
          </CountAction>
        </div>

        <InlineComment postId={post.id} />

        <button
          onClick={share}
          aria-label="Share"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-meta transition-colors hover:bg-white/10 hover:text-heading"
        >
          <IconShare className="h-4 w-4" />
        </button>
      </div>

      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </article>
  );
}
