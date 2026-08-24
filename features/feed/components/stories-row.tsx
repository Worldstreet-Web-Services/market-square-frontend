"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Skeleton } from "@/components/ui/skeleton";
import { IconChevronLeft, IconChevronRight, IconPlus, IconX } from "@/components/ui/icons";
import { useMe } from "@/hooks/use-me";
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
    // Landscape-ish 100×96 tile in the design, cover art under a flat 27%
    // black scrim with the author's avatar pinned top-left.
    <span className={cn("ws-story-ring block !rounded-[18px]", seen && "ws-story-seen")}>
      <span className="ws-story-gap block !rounded-[17px]">
        <span className="relative block h-24 w-[100px] overflow-hidden rounded-[16.5px]">
          <GradientThumb seed={group.username} className="absolute inset-0 h-full w-full" />
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 bg-black/[0.27]" />
          <span className="absolute left-2 top-2">
            <Avatar name={group.displayName} src={group.avatarUrl} size={24} />
          </span>
          <span className="sr-only">{group.username}</span>
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
  // Progress is driven from the SAME clock that advances the story, so a hold
  // freezes the bar with the story instead of racing on to 100% underneath a
  // paused card.
  const [progress, setProgress] = useState(0);

  const group = groups[groupIndex];
  const story = group?.stories[index];
  const storyKey = `${groupIndex}:${index}`;
  // The authoritative elapsed fraction, so a pause/resume cycle can pick up
  // where it stopped without re-arming the frame loop on every tick.
  const progressRef = useRef(0);
  const storyKeyRef = useRef(storyKey);

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
    // A new story starts from zero; a resumed one continues from the hold.
    if (storyKeyRef.current !== storyKey) {
      storyKeyRef.current = storyKey;
      progressRef.current = 0;
    }
    const elapsed = progressRef.current * STORY_MS;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const ratio = Math.min(1, (elapsed + (now - start)) / STORY_MS);
      progressRef.current = ratio;
      setProgress(ratio);
      if (ratio >= 1) {
        next();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [next, paused, storyKey]);

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
  const cta = resolveCta(story.deepLink);

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
              <div
                className="h-full bg-white"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                }}
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

/**
 * Circular story rail — the mobile frame's shape.
 *
 * Same author grouping, same seen semantics and same viewer as the desktop
 * card strip; only the tile geometry differs (41px ring, name beneath).
 */
export function StoriesRail() {
  const me = useMe();
  const stories = useStories();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getSeenServerSnapshot);
  const groups = useMemo(() => groupByAuthor(stories.data?.items ?? []), [stories.data]);

  if (stories.isPending) return <div className="h-[74px]" />;

  return (
    <>
      <div className="flex items-center gap-[11px] overflow-x-auto rounded-[22px] border border-white/[0.18] bg-[#101012]/62 px-3 py-2 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/?compose=story"
          aria-label="Add to your story"
          className="ws-press flex w-[41px] shrink-0 flex-col items-center gap-1"
        >
          <span className="relative flex h-[41px] w-[41px] items-center justify-center rounded-full border border-white/20 bg-white/5">
            <span className="opacity-60">
              <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={33} />
            </span>
            <span className="absolute -bottom-0.5 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
              <IconPlus className="h-2.5 w-2.5 [&]:stroke-[3]" />
            </span>
          </span>
          <span className="w-full truncate text-center text-[8px] text-white/60">Your Story</span>
        </Link>

        {groups.map((group, i) => {
          const allSeen = group.stories.every((story) => seen.has(story.id));
          return (
            <button
              key={group.username}
              onClick={() => setOpenAt(i)}
              aria-label={`Stories from ${group.displayName}`}
              className="ws-press flex w-[41px] shrink-0 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "ws-story-ring block !h-[41px] !w-[41px] !p-[1.4px]",
                  allSeen && "ws-story-seen"
                )}
              >
                <span className="ws-story-gap block !p-0">
                  <Avatar name={group.displayName} src={group.avatarUrl} size={38} />
                </span>
              </span>
              <span className="w-full truncate text-center text-[8px] text-white/80">
                {group.displayName.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {openAt !== null && groups[openAt] && (
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

export function StoriesRow() {
  const me = useMe();
  const stories = useStories();
  const [openAt, setOpenAt] = useState<number | null>(null);
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getSeenServerSnapshot);

  const groups = useMemo(() => groupByAuthor(stories.data?.items ?? []), [stories.data]);

  if (stories.isPending) {
    return (
      <div className="flex gap-[5px]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24 w-[100px] shrink-0 rounded-[16.5px]" />
        ))}
      </div>
    );
  }

  // "Your story" always leads the rail, even with nothing to show behind it —
  // that first tile is how Instagram teaches the gesture.
  return (
    <>
      <div className="flex gap-[5px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* "Your Story" leads: an outlined tile carrying the viewer's own
            avatar, a white + badge cut into it, and the label beneath. */}
        <Link href="/?compose=story" className="ws-press shrink-0" aria-label="Add to your story">
          <span className="ws-story-card relative flex h-24 w-[100px] flex-col items-center justify-center gap-1">
            <span className="relative">
              <Avatar name={me.data?.displayName ?? "You"} src={me.data?.avatarUrl} size={48} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-white text-black">
                <IconPlus className="h-2.5 w-2.5 [&]:stroke-[3]" />
              </span>
            </span>
            <span className="text-[8px] font-bold text-white/40">Your Story</span>
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
