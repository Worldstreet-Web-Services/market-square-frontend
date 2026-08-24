"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronLeft, IconChevronRight, IconPlus, IconX } from "@/components/ui/icons";
import { useStories } from "@/features/feed/hooks/use-feed";
import type { Post } from "@/features/feed/lib/types";

const STORY_MS = 5000;
const SEEN_KEY = "ms.stories.seen";

/** One author's stories, oldest first — the unit Instagram opens on a tap. */
interface StoryGroup {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stories: Post[];
}

// Seen state has no backend field, so it lives per-browser, read through an
// external store: the server snapshot is empty, so the first client render
// matches the served HTML and the real value lands right after hydration.
// Every access is guarded — a private window or blocked site data throws.
const EMPTY_SEEN: ReadonlySet<string> = new Set();
const seenListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSeen: ReadonlySet<string> = EMPTY_SEEN;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

// Must return a stable reference while the underlying string is unchanged,
// or useSyncExternalStore re-renders forever.
function getSeenSnapshot(): ReadonlySet<string> {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSeen = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      cachedSeen = EMPTY_SEEN;
    }
  }
  return cachedSeen;
}

function getSeenServerSnapshot(): ReadonlySet<string> {
  return EMPTY_SEEN;
}

function subscribeSeen(onChange: () => void) {
  seenListeners.add(onChange);
  return () => {
    seenListeners.delete(onChange);
  };
}

function markStorySeen(storyId: string) {
  const current = getSeenSnapshot();
  if (current.has(storyId)) return;
  const next = new Set(current).add(storyId);
  const raw = JSON.stringify([...next].slice(-400));
  try {
    window.localStorage.setItem(SEEN_KEY, raw);
  } catch {
    /* storage unavailable — the ring simply stays bright */
  }
  cachedRaw = raw;
  cachedSeen = next;
  for (const listener of seenListeners) listener();
}

function groupByAuthor(posts: Post[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const post of posts) {
    const author = post.author;
    if (!author) continue;
    const existing = groups.get(author.username);
    if (existing) existing.stories.push(post);
    else
      groups.set(author.username, {
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        stories: [post],
      });
  }
  // Oldest first inside a group: a tap replays the author's day in order.
  for (const group of groups.values()) {
    group.stories.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return [...groups.values()];
}

/** Portrait story card. Unseen carries the bright gradient edge; seen drains
    to a flat grey, which is the Instagram signal in the design's card shape. */
function StoryCard({
  group,
  seen,
}: {
  group: StoryGroup;
  seen: boolean;
}) {
  const cover = group.stories.find((story) => story.mediaUrl)?.mediaUrl ?? null;
  return (
    <span className={cn("ws-story-ring block !rounded-2xl", seen && "ws-story-seen")}>
      <span className="ws-story-gap block !rounded-[14px]">
        <span className="relative block h-[104px] w-[72px] overflow-hidden rounded-xl">
          <GradientThumb seed={group.username} className="absolute inset-0 h-full w-full" />
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 to-transparent" />
          <span className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1">
            <Avatar name={group.displayName} src={group.avatarUrl} size={18} />
            <span className="truncate text-[9px] font-semibold text-white">{group.username}</span>
          </span>
        </span>
      </span>
    </span>
  );
}

function StoryViewer({
  groups,
  startGroup,
  onClose,
  onSeen,
}: {
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
  onSeen: (storyId: string) => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const group = groups[groupIndex];
  const story = group?.stories[index];

  // Advance within the author, then to the next author, then close — the
  // Instagram traversal.
  const next = useCallback(() => {
    if (!group) return onClose();
    if (index + 1 < group.stories.length) return setIndex(index + 1);
    if (groupIndex + 1 < groups.length) {
      setGroupIndex(groupIndex + 1);
      return setIndex(0);
    }
    onClose();
  }, [group, groupIndex, groups.length, index, onClose]);

  const previous = useCallback(() => {
    if (index > 0) return setIndex(index - 1);
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      return setIndex(Math.max(0, previousGroup.stories.length - 1));
    }
    onClose();
  }, [groupIndex, groups, index, onClose]);

  useEffect(() => {
    if (story) onSeen(story.id);
  }, [story, onSeen]);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(next, STORY_MS);
    return () => clearTimeout(timer);
  }, [next, paused, index, groupIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, onClose]);

  if (!group || !story) return null;
  const cta = story.deepLink ? resolveDeepLink(story.deepLink) : null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* The card: a 9:16 frame, centred, exactly as Instagram stages it. */}
      <div className="relative mx-auto flex h-full max-h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-none sm:rounded-3xl sm:border sm:border-white/10">
        {/* Card ground: the seeded texture, lifted so the frame separates
            from the dimmed page, then a scrim top and bottom so the header
            and the CTA stay readable over any artwork. */}
        <GradientThumb
          seed={story.id}
          className="absolute inset-0 h-full w-full rounded-none sm:rounded-3xl"
        />
        <div className="absolute inset-0 bg-white/[0.07]" />

        {/* One segment per story in this author's set. */}
        <div className="relative z-20 flex gap-1 px-3 pt-3">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <motion.div
                className="h-full bg-white"
                initial={{ width: i < index ? "100%" : "0%" }}
                animate={{ width: i < index ? "100%" : i === index ? "100%" : "0%" }}
                transition={
                  i === index ? { duration: STORY_MS / 1000, ease: "linear" } : { duration: 0 }
                }
              />
            </div>
          ))}
        </div>

        <div className="relative z-20 flex items-center gap-3 px-3 py-3">
          <Link href={`/u/${group.username}`} onClick={onClose}>
            <Avatar name={group.displayName} src={group.avatarUrl} size={32} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/u/${group.username}`}
              onClick={onClose}
              className="ws-text-shadow block truncate text-sm font-bold text-white"
            >
              {group.displayName}
            </Link>
            <p className="ws-text-shadow text-xs text-white/70">{relativeTime(story.createdAt)}</p>
          </div>
          <button onClick={onClose} aria-label="Close stories" className="p-1.5 text-white">
            <IconX className="h-5 w-5" />
          </button>
        </div>

        {/* Tap zones: left third steps back, the rest advances. Holding
            anywhere pauses, the way Instagram does. */}
        <button
          aria-label="Previous story"
          className="absolute inset-y-0 left-0 z-10 w-1/3"
          onClick={previous}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />
        <button
          aria-label="Next story"
          className="absolute inset-y-0 right-0 z-10 w-2/3"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        />

        {story.mediaUrl && (
          story.mediaUrl.startsWith("data:video/") || /\.(mp4|webm|mov)(?:$|[?#])/i.test(story.mediaUrl) ? (
            <video src={story.mediaUrl} autoPlay muted playsInline loop className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
            <img src={story.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />

        <div className="relative z-0 flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="ws-display ws-text-shadow text-2xl leading-snug text-white">{story.text}</p>
        </div>

        {cta && (
          <div className="relative z-20 px-6 pb-8">
            <Link
              href={cta.href}
              onClick={onClose}
              className="ws-press flex h-11 w-full items-center justify-center rounded-full bg-accent text-sm font-bold text-ink"
            >
              {cta.label}
            </Link>
          </div>
        )}
      </div>

      {/* Desktop arrows sit outside the card, Instagram-style. */}
      <button
        onClick={previous}
        aria-label="Previous"
        className="ws-glass absolute left-6 hidden h-10 w-10 items-center justify-center rounded-full text-white lg:flex"
      >
        <IconChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        aria-label="Next"
        className="ws-glass absolute right-6 hidden h-10 w-10 items-center justify-center rounded-full text-white lg:flex"
      >
        <IconChevronRight className="h-5 w-5" />
      </button>
    </motion.div>
  );
}

export function StoriesRow() {
  const stories = useStories();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getSeenServerSnapshot);

  const groups = useMemo(() => groupByAuthor(stories.data?.items ?? []), [stories.data]);

  if (stories.isPending) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[104px] w-[72px] shrink-0 rounded-2xl" />
        ))}
      </div>
    );
  }

  // "Your story" always leads the rail, even with nothing to show behind it —
  // that first tile is how Instagram teaches the gesture.
  return (
    <>
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link href="/?compose=story" className="ws-press shrink-0" aria-label="Add to your story">
          <span className="ws-hair relative flex h-[104px] w-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-ink">
              <IconPlus className="h-4 w-4 [&]:stroke-[3]" />
            </span>
            <span className="text-[9px] font-semibold text-body">Your story</span>
          </span>
        </Link>

        {groups.map((group, i) => {
          const allSeen = group.stories.every((story) => seen.has(story.id));
          return (
            <button
              key={group.username}
              onClick={() => setOpenAt(i)}
              aria-label={`Stories from ${group.displayName}`}
              className="ws-press shrink-0"
            >
              <StoryCard group={group} seen={allSeen} />
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {openAt !== null && (
          <StoryViewer
            groups={groups}
            startGroup={openAt}
            onClose={() => setOpenAt(null)}
            onSeen={markStorySeen}
          />
        )}
      </AnimatePresence>
    </>
  );
}
