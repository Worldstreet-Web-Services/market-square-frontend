"use client";

import { useState } from "react";
import Link from "next/link";
import { TransitionLink } from "@/components/ui/transition-link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { isVideoUrl } from "@/lib/media";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconComment, IconDots, IconFlag, IconHeart } from "@/components/ui/icons";
import { formatCount } from "@/lib/format";
import { useLikePost, useReport } from "@/features/feed/hooks/use-feed";
import { CommentsSheet } from "@/features/feed/components/comments-sheet";
import type { Post, ReportReason } from "@/features/feed/lib/types";

// Labels map onto the backend's fixed reason enum.
const REPORT_REASONS: Array<{ reason: ReportReason; label: string }> = [
  { reason: "spam", label: "Spam" },
  { reason: "scam", label: "Scam or fraud" },
  { reason: "abuse", label: "Harassment or abuse" },
  { reason: "other", label: "Something else" },
];

function ReportMenu({
  targetType,
  targetId,
}: {
  targetType: "post" | "comment" | "profile" | "stream_message";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const report = useReport();
  const gate = useGate();
  return (
    <div className="relative">
      <button
        aria-label="More options"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1.5 text-grey-500 transition-colors hover:bg-white/10 hover:text-white"
      >
        <IconDots className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="ws-glass absolute right-0 z-20 mt-1 w-56 rounded-2xl p-1.5">
            <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-grey-400">
              <IconFlag className="h-3.5 w-3.5" /> Report
            </p>
            {REPORT_REASONS.map(({ reason, label }) => (
              <button
                key={reason}
                onClick={() => {
                  setOpen(false);
                  gate(() => report.mutate({ targetType, targetId, reason }));
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-grey-200 transition-colors hover:bg-white/10"
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

export function PostCard({ post }: { post: Post }) {
  const like = useLikePost();
  const gate = useGate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const author = post.author;
  const cta = post.deepLink ? resolveDeepLink(post.deepLink) : null;

  return (
    <article className="ws-card p-5">
      <div className="flex items-start gap-3">
        {author ? (
          <TransitionLink href={`/u/${author.username}`} className="shrink-0">
            <Avatar name={author.displayName} src={author.avatarUrl} size={40} />
          </TransitionLink>
        ) : (
          <Avatar name="?" size={40} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {author && (
              <>
                <Link
                  href={`/u/${author.username}`}
                  className="truncate text-sm font-semibold hover:underline"
                >
                  {author.displayName}
                </Link>
                <VerifiedBadge verification={author.verification} />
                <RoleChip role={author.role} />
                <span className="truncate text-xs text-grey-500">@{author.username}</span>
              </>
            )}
            <span className="text-xs text-grey-600">· {relativeTime(post.createdAt)}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-grey-100">
            {post.text}
          </p>
          {post.mediaUrl &&
            (isVideoUrl(post.mediaUrl) ? (
              <video
                src={post.mediaUrl}
                controls
                playsInline
                preload="metadata"
                className="ws-inset mt-3 max-h-96 w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
              <img
                src={post.mediaUrl}
                alt=""
                className="ws-inset mt-3 max-h-96 w-full object-cover"
              />
            ))}
          {cta && (
            <Link
              href={cta.href}
              target={cta.external ? "_blank" : undefined}
              rel={cta.external ? "noreferrer" : undefined}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-ink transition-colors hover:bg-white"
            >
              {cta.label}
            </Link>
          )}
          <div className="mt-3 flex items-center gap-5 text-grey-500">
            <button
              onClick={() => gate(() => like.mutate({ postId: post.id, like: !post.likedByMe }))}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors hover:text-like",
                post.likedByMe && "text-like"
              )}
              aria-label={post.likedByMe ? "Unlike" : "Like"}
            >
              <IconHeart className="h-4 w-4" filled={post.likedByMe} />
              <span className="tnum">{formatCount(post.likeCount)}</span>
            </button>
            <button
              onClick={() => setCommentsOpen(true)}
              className="flex items-center gap-1.5 text-xs transition-colors hover:text-white"
              aria-label="Comments"
            >
              <IconComment className="h-4 w-4" />
              <span className="tnum">{formatCount(post.commentCount)}</span>
            </button>
            <div className="ml-auto">
              <ReportMenu targetType="post" targetId={post.id} />
            </div>
          </div>
        </div>
      </div>
      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </article>
  );
}
