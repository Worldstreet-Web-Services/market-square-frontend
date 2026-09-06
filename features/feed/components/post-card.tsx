"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TransitionLink } from "@/components/ui/transition-link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { isVideoPost } from "@/lib/media";
import { InlineVideo } from "@/components/ui/inline-video";
import { MediaFrame } from "@/components/ui/media-frame";
import { PostText } from "@/components/ui/post-text";
import { CoinChips } from "@/components/ui/coin-chips";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { useRecordView } from "@/features/feed/hooks/use-record-view";
import { useGate } from "@/hooks/use-gate";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { IconFlag, IconFullscreen, IconQuote, IconSend } from "@/components/ui/icons";
import {
  IconMsBookmark,
  IconMsComment,
  IconMsLike,
  IconMsMore,
  IconMsRepost,
  IconMsShare,
} from "@/components/ui/design-icons";
import { formatCount } from "@/lib/format";
import { IconStats } from "@/components/ui/icons";
import {
  useAddComment,
  useBookmarkPost,
  useDeletePost,
  useEditPost,
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

/**
 * The post's overflow menu.
 *
 * It used to offer only Report. `PATCH /posts/:id` and `DELETE /posts/:id` are
 * both live, so the AUTHOR now gets Edit and Delete above the report reasons —
 * and only the author: the service refuses both for anybody else (403 even for
 * an admin, because admins remove rather than rephrase), so offering them would
 * be a control that can only fail.
 *
 * EDIT IS TEXT ONLY, which the sheet says. Media, a quote and a deep link are
 * deliberately not editable — swapping the picture under a post people have
 * already liked changes what they endorsed.
 */
function ReportMenu({ post, mine }: { post: Post; mine: boolean }) {
  const targetId = post.id;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const report = useReport();
  const remove = useDeletePost();
  const gate = useGate();
  return (
    <div className="relative">
      {/* The design draws "more" as a ringed 38px disc at the end of the
          action row, not as a bare glyph in the header. */}
      <button
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        /* Node 236:4750 reports a transparent fill with a WHITE STROKE and no
           weight — the zero-weight trap. The rendered node is the opaque
           near-black lens `ws-glass-pill` paints, which is what the file shows:
           a solid dark disc, not a hairline ring. Same control, same material,
           as the gist room's circular buttons. */
        className="ws-glass-pill flex h-[38px] w-[38px] items-center justify-center rounded-full text-grey-100 transition-opacity hover:opacity-90"
      >
        <IconMsMore className="h-6 w-6" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="ws-popover absolute right-0 z-20 mt-1 w-56 rounded-2xl p-1.5">
            {mine && (
              <>
                <button
                  onClick={() => {
                    setOpen(false);
                    setEditing(true);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10"
                >
                  Edit post
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-white/10"
                >
                  {post.kind === "story" ? "Delete story" : "Delete post"}
                </button>
                <span aria-hidden className="my-1 block h-px bg-white/10" />
              </>
            )}
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

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit post">
        <EditPostForm post={post} onDone={() => setEditing(false)} />
      </Sheet>

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={post.kind === "story" ? "Delete this story?" : "Delete this post?"}
      >
        {/* This one IS final — unlike removing a chat, which only leaves your
            own inbox — so it says so. */}
        <p className="text-[13px] leading-5 text-body">
          It comes off every timeline it appears on, along with its replies. This cannot be
          undone.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            className="flex-1"
            loading={remove.isPending}
            onClick={() =>
              gate(() =>
                remove.mutate(targetId, { onSuccess: () => setConfirmDelete(false) })
              )
            }
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * The edit form — text only.
 *
 * Its own component so the draft starts fresh on every opening: the sheet is
 * mounted only while open, so there is nothing stale to reset and no effect
 * needed to reset it. The 2000-character cap is the service's own, applied here
 * so a request cannot be rejected for length after the fact.
 */
function EditPostForm({ post, onDone }: { post: Post; onDone: () => void }) {
  const [text, setText] = useState(post.text);
  const edit = useEditPost(post.id);
  const trimmed = text.trim();
  const valid = trimmed.length > 0 && trimmed !== post.text.trim();
  return (
    <div>
      <textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={2000}
        rows={5}
        className="ws-inset w-full resize-none px-4 py-3 text-[15px] leading-6 text-heading outline-none placeholder:text-meta"
      />
      <p className="mt-2 text-[11px] leading-4 text-meta">
        Text only — a post&apos;s picture, quote and link stay as published.
      </p>
      <Button
        className="mt-4 w-full"
        disabled={!valid}
        loading={edit.isPending}
        onClick={() => edit.mutate(trimmed, { onSuccess: onDone })}
      >
        Save
      </Button>
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
  /** Absent for a tally that is only a fact — views have nothing to do. */
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="flex shrink-0 items-center gap-0.5 transition-colors md:gap-[2px]"
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center transition-colors",
          active ? activeClass : "text-grey-400 hover:text-heading"
        )}
      >
        {children}
      </span>
      {/* 12/16 in `#FFFFFF` — node 236:4729. */}
      <span className="tnum text-[12px] leading-4 text-white">{formatCount(count)}</span>
    </button>
  );
}

/**
 * The quoted original, inset inside the quoting post.
 *
 * One level only: this card never renders its own quotedPost, so a quote of a
 * quote stops here rather than nesting frames forever. A removed or expired
 * original keeps its slot and says so — dropping it silently would leave the
 * commentary above it dangling with no referent.
 */
function QuotedPost({ quoted }: { quoted: NonNullable<Post["quotedPost"]> }) {
  if (quoted.unavailable) {
    return (
      <div className="ws-inset mt-3 px-4 py-3">
        <p className="text-[13px] text-meta">This post is unavailable.</p>
      </div>
    );
  }

  const author = quoted.author;
  return (
    <Link
      href={`/p/${quoted.id}`}
      className="ws-inset mt-3 block px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
    >
      <span className="flex items-center gap-2">
        <Avatar name={author?.displayName ?? "?"} seed={author?.id} src={author?.avatarUrl} size={20} />
        <span className="truncate text-[13px] font-bold text-heading">
          {author?.displayName ?? "Unknown"}
        </span>
        {author && (
          <>
            <VerifiedBadge verification={author.verification} className="h-3 w-3" />
            <span className="truncate text-[12px] text-meta">@{author.username}</span>
          </>
        )}
      </span>
      {quoted.text && (
        <span className="mt-1.5 line-clamp-3 block text-[13px] leading-normal text-body">
          {quoted.text}
        </span>
      )}
      {quoted.mediaUrl && !isVideoPost(quoted) && (
        <MediaFrame backdrop={quoted.mediaUrl} className="mt-2 h-40 w-full rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown */}
          <img
            src={quoted.mediaUrl}
            alt=""
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
          />
        </MediaFrame>
      )}
    </Link>
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
  /** Absent for a tally that is only a fact — views have nothing to do. */
  onClick?: () => void;
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
        active ? "text-create" : "text-body hover:text-heading"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Repost, or quote it with your own commentary.
 *
 * The tally stays on the trigger so the row reads the same as the other two
 * actions; the choice opens underneath. Undoing a repost is a direct toggle —
 * only the "add" direction needs the menu.
 */
function RepostMenu({
  post,
  onRepost,
  onQuote,
}: {
  post: Post;
  onRepost: () => void;
  onQuote: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Already reposted: the only sensible action is to undo it.
  if (post.repostedByMe) {
    return (
      <CountAction
        label="Undo repost"
        count={post.repostCount}
        active
        activeClass="text-up"
        onClick={onRepost}
      >
        <IconMsRepost className="h-[18px] w-[18px]" />
      </CountAction>
    );
  }

  return (
    <div className="relative">
      <CountAction
        label="Repost or quote"
        count={post.repostCount}
        onClick={() => setOpen((v) => !v)}
      >
        <IconMsRepost className="h-[18px] w-[18px]" />
      </CountAction>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="ws-popover absolute bottom-full left-0 z-20 mb-2 w-44 rounded-2xl p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onRepost();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10"
            >
              <IconMsRepost className="h-4 w-4" /> Repost
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onQuote();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10"
            >
              <IconQuote className="h-4 w-4" /> Quote
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Reply without leaving the timeline.
 *
 * The point of it is the navigation step it removes: a short reply should not
 * cost you your place in the feed. So it is deliberately NOT a second
 * composer — no media, no length ambitions. Anything longer than a line wants
 * the sheet, where the thread is readable.
 */
function InlineComment({
  postId,
  onOpenThread,
  className,
}: {
  postId: string;
  onOpenThread: () => void;
  className?: string;
}) {
  const add = useAddComment(postId);
  const gate = useGate();
  const me = useMe();
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    const body = text.trim();
    // Guarded on isPending too: Enter held down, or a fast double tap on send,
    // would otherwise post the same reply twice.
    if (!body || add.isPending) return;
    gate(() =>
      add.mutate(body, {
        onSuccess: () => {
          setText("");
          // Something has to happen. The reply lands in a thread the reader
          // cannot see from here, so without this the field just empties and
          // it is not obvious anything was posted. The tally moves at the same
          // time (useAddComment patches it everywhere), so the confirmation
          // and the count agree.
          setSent(true);
          window.setTimeout(() => setSent(false), 2400);
        },
      }),
    );
  };

  const insert = (emoji: string) => {
    setText((current) => (current + emoji).slice(0, 500));
    field.current?.focus();
  };

  return (
    /*
      NODE 236:4738 — the comment pill: `white/3` at a full round, 8.08 of
      padding, a 24px glyph, then the field.

      TWO DEPARTURES FROM THE FILE, both stated:

      · The file leads with a comment GLYPH at 60% white and no avatar. This
        keeps the reader's own avatar and puts the glyph beside it, because the
        pill is a live field here rather than a placeholder — seeing whose reply
        it will be is worth the 24px, and it is the same affordance every
        composer in the app uses.
      · The placeholder is the file's copy but NOT its colour. `236:4743` is
        `#3C3C3C`, which reads on the white the mockup accidentally exported
        (the page frame's fill is `visible: false`, so the PNG has no
        background) and is very nearly invisible on the real `#0F0F0F` card.
        The app's own placeholder grey is used instead.
    */
    <div className={cn("ws-comment-field flex h-10 min-w-0 flex-1 items-center gap-2 px-2", className)}>
      <Avatar name={me.data?.displayName ?? "You"} seed={me.data?.id} src={me.data?.avatarUrl} size={24} />
      <IconMsComment aria-hidden className="h-6 w-6 shrink-0 text-white/60" />
      {sent ? (
        // Says what happened AND offers the one thing a person wants next.
        <button
          type="button"
          onClick={onOpenThread}
          className="min-w-0 flex-1 truncate text-left text-[12px] text-grey-300"
        >
          Posted · <span className="font-semibold text-accent">See the thread</span>
        </button>
      ) : (
        <input
          ref={field}
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 500))}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="Comment here..."
          aria-label="Write a reply"
          disabled={add.isPending}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-heading outline-none placeholder:text-grey-700 disabled:opacity-60"
        />
      )}
      {!sent && (
        // Right-aligned: this button sits at the end of the reply row, so a
        // left-anchored panel would open off the edge of the card.
        <EmojiPicker onPick={insert} label="Add an emoji to your reply" align="right" />
      )}
      {!sent && text.trim() && (
        <button
          onClick={submit}
          disabled={add.isPending}
          aria-label="Post reply"
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
  tipSlot,
  onOpenMedia,
  onQuote,
  full = false,
}: {
  post: Post;
  /**
   * Show the caption whole, with no "Show more".
   *
   * The timeline clamps: one long post otherwise makes a card taller than the
   * screen and pushes every other post out of view. A post's OWN page is the
   * place that owes you the whole thing, so it sets this.
   */
  full?: boolean;
  /** Opens the composer with this post quoted. Omitted where there is no composer. */
  onQuote?: (post: Post) => void;
  /** Set when this post reached the timeline through someone's repost. */
  repostedBy?: Profile | null;
  /** Composed from outside the slice — feed never imports profile. */
  followSlot?: (author: Profile) => React.ReactNode;
  /** Composed from outside the slice — the tip control belongs to the tips
   *  slice, and it takes the POST because a tip goes to `/posts/:id/tips`. */
  tipSlot?: (post: Post) => React.ReactNode;
  /** Promotes a media card into the full-screen viewer. */
  onOpenMedia?: (post: Post) => void;
}) {
  const like = useLikePost();
  const repost = useRepostPost();
  const bookmark = useBookmarkPost();
  const gate = useGate();
  // Who is reading, so the overflow menu can offer Edit and Delete to the
  // author and to nobody else. COMPARED rather than assumed impossible — the
  // same rule the follow control and the directory filter apply.
  const me = useMe();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const author = post.author;
  // A button when the media can expand, a plain div when it cannot. Rendering
  // an inert button would announce a control to a screen reader that does
  // nothing when activated.
  const Tag = onOpenMedia ? "button" : "div";
  // Recorded on dwell, not on mount: see useRecordView.
  const viewRef = useRecordView(post.id);
  const cta = resolveCta(post.deepLink, `feed:post:${post.id}`);

  // Share the POST, not its author's profile — a reader following the link
  // has to land on the thing they were shown.
  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
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
    <article ref={viewRef} className="ws-post p-4">
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
            <Avatar name={author.displayName} seed={author.id} src={author.avatarUrl} size={39} />
          </TransitionLink>
        ) : (
          <Avatar name="?" seed={post.authorId} size={39} />
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
                <OrgBadgeChip orgBadge={author.orgBadge} />
                <RoleChip role={author.role} />
              </>
            )}
          </div>
          <p className="truncate text-[12px] leading-4 text-white/50">
            {author ? `@${author.username}  •  ` : ""}
            {relativeTime(post.createdAt)}
            {/*
              EDITED, from `editedAt` alone.

              Every edit stamps the field — there is no quiet window in which a
              post can change without saying so — so the marker is read straight
              off it rather than diffing anything. It carries a `title` with the
              time, because "edited" without "when" invites the reader to
              wonder whether it changed since THEY read it.
            */}
            {post.editedAt && (
              <span title={`Edited ${relativeTime(post.editedAt)}`}>  •  edited</span>
            )}
          </p>
        </div>
        {/* The design's action row: 26px tall, 8px between the two controls,
            tip first. The row exists even with one control in it so the
            header's right edge does not shift when tipping goes quiet. */}
        {author && (
          <div className="flex h-[26px] shrink-0 items-center gap-2">
            {tipSlot?.(post)}
            {followSlot?.(author)}
          </div>
        )}
      </header>



      {/* mediaUrl carries both images and clips; the upload endpoint only
          issues mp4/webm for video, so extension sniffing is enough. */}
      {post.mediaUrl &&
        (isVideoPost(post) ? (
          // A tap goes FULL SCREEN, the way it does in Reels and TikTok. The
          // inline preview still autoplays muted so the timeline is alive, but
          // the tap is a promotion into the immersive viewer rather than a
          // mute toggle: a clip playing in a card is a thumbnail that happens
          // to move, and that is what "it doesn't feel like a reel" was.
          // Without a handler it stays an inline player, which is what the
          // surfaces that have nowhere to promote to need.
          onOpenMedia ? (
            // A DIV, not a button. The player owns a real sound control, and a
            // button inside a button is invalid markup — which is why the
            // player had to be neutralised with `pointer-events-none`, and why
            // "Tap for sound" expanded the video instead of unmuting it.
            //
            // Now the frame opens the video and the pill toggles sound, each
            // with its own hit area. The keyboard gets an explicit control
            // below rather than a clickable div it cannot reach.
            <div
              onClick={() => onOpenMedia(post)}
              className="ws-press relative mt-4 block h-[420px] w-full cursor-pointer overflow-hidden rounded-xl"
              style={{ viewTransitionName: `media-${post.id}` }}
            >
              <InlineVideo
                src={post.mediaUrl}
                poster={post.thumbnailUrl}
                className="h-full w-full"
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenMedia(post);
                }}
                aria-label="Play full screen"
                className="ws-glass ws-press absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-body transition-colors hover:text-white"
              >
                <IconFullscreen className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <InlineVideo
              src={post.mediaUrl}
              poster={post.thumbnailUrl}
              className="mt-4 h-[420px] w-full rounded-xl"
            />
          )
        ) : (
          // A photo expands too. It is contained in the card, so a tall shot
          // is letterboxed there and a tap is the only way to see it at any
          // size: leaving the clip tappable and the photo inert taught two
          // different rules for the same gesture on the same surface.
          <Tag
            {...(onOpenMedia
              ? {
                  type: "button" as const,
                  onClick: () => onOpenMedia(post),
                  "aria-label": "View full screen",
                }
              : {})}
            className={cn(
              "mt-4 block h-[420px] w-full",
              onOpenMedia && "ws-press cursor-pointer"
            )}
            style={{ viewTransitionName: `media-${post.id}` }}
          >
            {/* Same height as InlineVideo so the timeline keeps one rhythm,
                and contained so a tall photo is not cropped to fit it. */}
            <MediaFrame backdrop={post.mediaUrl} className="h-full w-full rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown */}
              <img
                src={post.mediaUrl}
                alt=""
                decoding="async"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </MediaFrame>
          </Tag>
        ))}

      <PostText
        text={post.text}
        mentions={post.mentions}
        className="mt-3 text-[13.8px] leading-[23px] text-white/90"
        clampLines={full ? undefined : 6}
      />
      {/* The coins the post names, with today's move — the row Ark draws. */}
      <CoinChips text={post.text} />

      {post.quotedPost && <QuotedPost quoted={post.quotedPost} />}

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
      {/* Tighter on a phone. Both end groups are shrink-0, so at the design's
          spacing the row could not fit a 360px screen and pushed the page
          wider than the viewport. The spacing is the design's from md up. */}
      {/* The reply field takes its OWN ROW on a phone and sits inline from md
          up. It used to be hidden below md, which fixed the overflow by
          deleting the feature on mobile: it cannot shrink past its avatar and
          padding, so on one row it made the action row wider than the screen.
          Giving it a row of its own solves the geometry instead. */}
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
      <div className="flex items-center justify-between gap-3 md:contents">
        {/*
          THE TALLIES PILL — node 236:4725.

          `white/3` at a full round, 8.08 of padding, and THREE items on a 17px
          gap, each a 24px glyph beside its count at 12/16 in white.

          WHICH three is the correction. It used to be comment · repost · like,
          with views floating outside the pill behind an eye glyph. The file has
          repost · like · STATS: the comment tally moved out to the "Comment
          here…" pill beside it — which is where a reader actually replies — and
          views came IN, as the bar chart, because a view is something that
          happened to the post rather than something you can do to it, which is
          exactly what the other two tallies are.
        */}
        <div className="ws-action-pill flex h-10 shrink-0 items-center gap-3 px-2 md:gap-[17px]">
          <RepostMenu
            post={post}
            onRepost={() =>
              gate(() => repost.mutate({ postId: post.id, repost: !post.repostedByMe }))
            }
            onQuote={() => gate(() => onQuote?.(post))}
          />
          {/* Liked is red (--color-like, #e84a4a). It was amber until the
              2026-08-25 design revision moved it off the featured accent —
              all four liked cards in the file changed together. Amber now
              means featured/premium only, and the heart is not that. */}
          <CountAction
            label={post.likedByMe ? "Unlike" : "Like"}
            count={post.likeCount}
            active={post.likedByMe}
            activeClass="text-like"
            onClick={() => gate(() => like.mutate({ postId: post.id, like: !post.likedByMe }))}
          >
            <IconMsLike className="h-6 w-6" filled={post.likedByMe} />
          </CountAction>
          {/* Rendered only when the payload carries a count — a confident
              "0 views" on a service that does not count them yet is a lie the
              reader cannot detect. The pill then holds two, which is what the
              file's own geometry allows: its items are hug-width. */}
          {post.viewCount !== undefined && (
            <CountAction
              label={`${post.viewCount} ${post.viewCount === 1 ? "view" : "views"}`}
              count={post.viewCount}
            >
              <IconStats className="h-6 w-6" />
            </CountAction>
          )}
        </div>

        {/* `md:order-3` — see the note on the row below. */}
        <div className="flex shrink-0 items-center gap-3 md:order-3 md:gap-[17px]">
          <div className="flex items-center gap-3 md:gap-3">
            <GlyphAction label="Share" onClick={share}>
              <IconMsShare className="h-6 w-6" />
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
              <IconMsBookmark className="h-6 w-6" filled={post.bookmarkedByMe} />
            </GlyphAction>
          </div>
          {/* `mine` gates Edit and Delete — the service refuses both for
              anybody but the author, so offering them elsewhere would be a
              control that can only fail. */}
          <ReportMenu post={post} mine={Boolean(me.data && post.authorId === me.data.id)} />
        </div>
      </div>

        {/*
          THE FIELD SITS IN THE MIDDLE, AND ORDER IS WHAT PUTS IT THERE.

          Node 236:4723 lays the row out as: tallies pill, 24, comment pill,
          then a wide gap, then share · bookmark · more hard against the right
          edge. The field is second, and it is the thing that stretches.

          It is second on screen but LAST in the DOM, so a keyboard reaches the
          post's actions before a text input it may not want. `md:contents`
          flattens the mobile wrapper into this row on desktop — and `contents`
          preserves DOM order, which is precisely why this needs `order`:
          without it the flatten produced tallies → share/bookmark/more →
          field, putting the actions in the middle and the input at the far
          right. `flex-1` then pushes the action group to the extreme end at
          any card width, which is what the file's fixed 113px gap expresses at
          its one width.
        */}
        <InlineComment
          postId={post.id}
          onOpenThread={() => setCommentsOpen(true)}
          className="md:order-2"
        />
      </div>

      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </article>
  );
}
