"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount, relativeTime } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { isVideoPost } from "@/lib/media";
import type { VideoItem } from "@/lib/video-context";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { MediaFrame } from "@/components/ui/media-frame";
import { VerifiedBadge } from "@/components/ui/badge";
import { IconComment, IconHeart } from "@/components/ui/icons";
import { useLikePost } from "@/features/feed/hooks/use-feed";
import { CommentsSheet } from "@/features/feed/components/comments-sheet";

const DOUBLE_TAP_MS = 300;

/**
 * One full-viewport slide in a vertical snap feed.
 *
 * This is the single implementation of the pattern: mobile Home's `SnapFeed`
 * and Explore's immersive video viewer both render it, so a clip behaves
 * identically in both places rather than drifting into two players.
 *
 * Playback grammar (the same one `InlineVideo` uses in the timeline): muted
 * autoplay once the slide is actually on screen, pause AND re-mute the moment
 * it leaves — scrolling back never surprises the reader with audio they did
 * not ask for — and sound only ever from an explicit tap. Under
 * `prefers-reduced-motion` nothing plays on its own and the element keeps its
 * native controls.
 */
export function PostSlide({
  post,
  /**
   * Morph target for the View Transition that carried the tapped card into
   * this slide. Only ever set on the slide the reader opened, and only while
   * the transition is running — two elements sharing one name aborts it.
   */
  viewTransitionName,
}: {
  post: VideoItem;
  viewTransitionName?: string;
}) {
  const like = useLikePost();
  const gate = useGate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [muted, setMuted] = useState(true);
  const [reduced, setReduced] = useState(false);
  const lastTap = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideo = isVideoPost(post);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // A play() that loses a race with an unmount rejects; not an error
          // worth surfacing.
          void video.play().catch(() => {});
        } else {
          video.pause();
          setMuted(true);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced, post.id]);

  const doLike = () => gate(() => like.mutate({ postId: post.id, like: !post.likedByMe }));

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      setBurst((n) => n + 1);
      if (!post.likedByMe) gate(() => like.mutate({ postId: post.id, like: true }));
    } else {
      lastTap.current = now;
      // Sound only on an explicit tap — never autoplayed.
      if (hasVideo) setMuted((v) => !v);
    }
  };

  const cta = resolveCta(post.deepLink);
  const author = post.author;

  return (
    <section
      className="ws-snap-item relative flex h-dvh w-full flex-col justify-center overflow-hidden"
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      {/* content stage: media fills the slide; text posts stay typographic. */}
      {post.mediaUrl && (
        // Contained, never cropped — see MediaFrame. A wide photo used to lose
        // its sides to `object-cover`, which is how a scoreboard arrived as a
        // single cropped digit and a caption lost its first and last words.
        <MediaFrame
          backdrop={hasVideo ? post.thumbnailUrl : post.mediaUrl}
          className="absolute inset-0"
        >
          {hasVideo ? (
            <video
              ref={videoRef}
              src={post.mediaUrl}
              poster={post.thumbnailUrl ?? undefined}
              muted={muted}
              loop
              playsInline
              preload="metadata"
              controls={reduced}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media
            <img
              src={post.mediaUrl}
              alt=""
              decoding="async"
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
        </MediaFrame>
      )}
      {/* Reduced motion keeps the native controls usable, so no tap layer. */}
      {!reduced && (
        <button className="absolute inset-0 cursor-default" onClick={onTap} aria-label="Post" />
      )}
      {hasVideo && muted && !reduced && (
        <span className="ws-glass pointer-events-none absolute left-4 top-14 rounded-full px-2.5 py-1 text-[10px] font-semibold text-body">
          Tap for sound
        </span>
      )}
      {post.text && (
        <div
          className={cn("pointer-events-none px-6", post.mediaUrl && "ws-text-shadow")}
          style={{ paddingBottom: "calc(var(--ws-nav-h) + 96px)" }}
        >
          <p className="ws-display text-2xl leading-snug">{post.text}</p>
        </div>
      )}

      {/* double-tap heart burst */}
      {burst > 0 && (
        <span
          key={burst}
          className="ws-heart-burst pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-like"
          aria-hidden
        >
          <IconHeart className="h-24 w-24" filled />
        </span>
      )}

      {/* bottom scrim: author + caption meta */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 to-transparent" />
      {/* Author and actions are two SEPARATE blocks, because they clear two
          different obstacles: the author row only has to sit above the tab
          bar, while the action rail shares the right edge with the create
          button and has to start above its hit frame. As one flex row with a
          single `pb-28` the rail landed underneath the button, which hid the
          comment control completely and clipped the like tally. */}
      <div
        className="absolute inset-x-0 flex items-end px-4"
        style={{ bottom: "calc(var(--ws-nav-h) + 16px)" }}
      >
        <div className="min-w-0 flex-1 pr-20">
          {author && (
            <Link
              href={`/u/${author.username}`}
              className="pointer-events-auto flex items-center gap-2"
            >
              <Avatar
                name={author.displayName}
                seed={author.id}
                src={author.avatarUrl}
                size={36}
              />
              <span className="ws-text-shadow flex items-center gap-1.5 text-sm font-semibold text-heading">
                {author.displayName}
                <VerifiedBadge verification={author.verification} />
              </span>
              <span className="ws-text-shadow text-xs text-meta">
                {relativeTime(post.createdAt)}
              </span>
            </Link>
          )}
          {cta && (
            <Link
              href={cta.href}
              target={cta.external ? "_blank" : undefined}
              rel={cta.external ? "noreferrer" : undefined}
              className="ws-press pointer-events-auto mt-3 inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-ink"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </div>

      {/* right action rail */}
      <div
        className="pointer-events-auto absolute right-4 flex flex-col items-center gap-4"
        style={{ bottom: "var(--ws-fab-clearance)" }}
      >
        <button
          onClick={doLike}
          aria-label={post.likedByMe ? "Unlike" : "Like"}
          className="ws-press flex flex-col items-center gap-0.5"
        >
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full bg-black/40",
              post.likedByMe ? "text-like" : "text-heading"
            )}
          >
            <IconHeart className="h-5 w-5" filled={post.likedByMe} />
          </span>
          {/* A payload without the tally renders no number rather than a
              fabricated zero. */}
          {post.likeCount !== undefined && (
            <span className="tnum ws-text-shadow text-xs text-body">
              {formatCount(post.likeCount)}
            </span>
          )}
        </button>
        <button
          onClick={() => setCommentsOpen(true)}
          aria-label="Comments"
          className="ws-press flex flex-col items-center gap-0.5"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading">
            <IconComment className="h-5 w-5" />
          </span>
          {post.commentCount !== undefined && (
            <span className="tnum ws-text-shadow text-xs text-body">
              {formatCount(post.commentCount)}
            </span>
          )}
      </button>
    </div>
      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </section>
  );
}
