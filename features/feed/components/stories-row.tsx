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
import { useFeed, useStories } from "@/features/feed/hooks/use-feed";
import type { FeedItem, Post } from "@/features/feed/lib/types";

const STORY_MS = 5000;

/** Stories carry raw author media, so the kind is sniffed from the URL — the
    same test the viewer used inline before it needed two layers of it. */
function isStoryVideo(url: string): boolean {
  return url.startsWith("data:video/") || /\.(mp4|webm|mov)(?:$|[?#])/i.test(url);
}
const SEEN_KEY = "ms.stories.seen";

/** One author's stories, oldest first — the unit Instagram opens on a tap. */
interface StoryGroup {
  /** The author's Privy DID. Seeded artwork hashes on this everywhere else in
      the app, so dropping it here made the same person draw a different
      illustration in the rail than in the feed or on their profile. Group and
      seed on the id; the username is for links and labels only. */
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stories: Post[];
}

/**
 * A live broadcast in the strip.
 *
 * Live is a different object from a story: it opens the room, never the
 * 5-second viewer, and it has no seen/unseen state — it is live or it is not
 * in the strip at all. Keeping it in its own type is what stops the two from
 * being handled interchangeably.
 */
interface LiveEntry {
  /** Stream id — the room to open. */
  id: string;
  /** Host's Privy DID; artwork seeds on this like everywhere else. */
  hostId: string;
  displayName: string;
  avatarUrl: string | null;
  title: string;
  thumbnailUrl: string | null;
}

/**
 * Live entries out of the `live` feed lane.
 *
 * The lane also carries scheduled activities and streams that have not started,
 * so the status filter is load-bearing: scheduled is NOT live, and inventing a
 * LIVE marker for one would be a lie the design never asked for. Deduped by
 * stream id because a lane page can repeat a stream across cursors.
 */
function toLiveEntries(items: FeedItem[]): LiveEntry[] {
  const seenIds = new Set<string>();
  const live: LiveEntry[] = [];
  for (const item of items) {
    const stream = item.stream;
    if (!stream || stream.status !== "live") continue;
    if (seenIds.has(stream.id)) continue;
    seenIds.add(stream.id);
    live.push({
      id: stream.id,
      // `owner` is not always hydrated on list payloads, so the seed falls back
      // to ownerId — still the DID, so the illustration stays consistent.
      hostId: stream.owner?.id ?? stream.ownerId,
      displayName: stream.owner?.displayName ?? stream.title,
      avatarUrl: stream.owner?.avatarUrl ?? null,
      title: stream.title,
      thumbnailUrl: stream.thumbnailUrl,
    });
  }
  return live;
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
    const existing = groups.get(author.id);
    if (existing) existing.stories.push(post);
    else
      groups.set(author.id, {
        id: author.id,
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

/**
 * Where a live tile goes.
 *
 * A host tapping their own broadcast wants the control surface, not a seat in
 * their own audience — so their tile points at the studio. "Your Story" is left
 * alone either way: it is the compose affordance, and turning it into a live
 * tile would delete the only way to post a story.
 */
function liveHref(entry: LiveEntry, meId?: string): string {
  return entry.hostId && entry.hostId === meId
    ? `/studio/${entry.id}`
    : `/live/${entry.id}?source=home:stories`;
}

/*
 * ORDERING — the server ranks stories, the client does not re-sort them.
 *
 * `GET /stories?scope=all` returns a deliberate ranking: the viewer's own
 * stories, then people they follow, then everyone else, each band newest-first.
 * An earlier version sorted unseen-before-seen across the whole list, which
 * flattened those bands — a stranger's unseen story would jump ahead of a
 * friend's unseen story, which is worse relevance, not better.
 *
 * Sorting unseen-first *within* each band is not possible either: the payload
 * carries no band marker, so the boundaries cannot be reconstructed client-side
 * without guessing. So the rail defers to the server order entirely. Seen state
 * still drives the RING (silver vs drained), it just no longer moves tiles —
 * which also stops the rail reshuffling under the viewer as they watch.
 *
 * Live entries are exempt: they lead the rail, from a separate list, so they
 * are never mixed into the story sequence the viewer plays through.
 */

/** The strip's LIVE marker: the design's solid #ff0b0b pill, white bold label,
    centred on the tile's bottom edge and overhanging it by a pixel. */
function LivePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 flex h-3 -translate-x-1/2 items-center justify-center rounded-full bg-live px-2 text-[8px] font-bold leading-3 text-white",
        className
      )}
    >
      Live
    </span>
  );
}

/**
 * Portrait live tile — the desktop strip's broadcast entry.
 *
 * Same 100×96 footprint as a story card so the row stays on one rhythm, but the
 * silver ring/black-gap sandwich is replaced by the design's red ring drawn
 * straight on the tile edge, and it renders as a link into the room.
 */
function LiveCard({ entry }: { entry: LiveEntry }) {
  return (
    <span className="relative block p-[4.5px]">
      <span className="ws-story-live relative block h-24 w-[100px] overflow-hidden rounded-[16.5px]">
        <GradientThumb seed={entry.id} className="absolute inset-0 h-full w-full" />
        {entry.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- host-supplied media host is unknown
          <img src={entry.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 bg-black/[0.27]" />
        <span className="absolute left-2 top-2">
          <Avatar name={entry.displayName} seed={entry.hostId} src={entry.avatarUrl} size={24} />
        </span>
      </span>
      <LivePill className="bottom-[3px]" />
    </span>
  );
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
          <GradientThumb seed={group.id} className="absolute inset-0 h-full w-full" />
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <span className="absolute inset-0 bg-black/[0.27]" />
          <span className="absolute left-2 top-2">
            <Avatar name={group.displayName} seed={group.id} src={group.avatarUrl} size={24} />
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
            <Avatar name={group.displayName} seed={group.id} src={group.avatarUrl} size={32} />
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

        {/* Media is CONTAINED, never cropped: the frame is 9:16 but a story can
            be any ratio, and `object-cover` sliced the ends off every landscape
            photo. The letterbox is filled by a blurred, over-scaled copy of the
            same frame — the Instagram/WhatsApp treatment — so the card still
            reads full-bleed without losing content. The copy is decorative and
            hidden from assistive tech; both layers stay under the tap zones
            (z-10) and the progress/header chrome (z-20). */}
        {story.mediaUrl && (
          <div className="absolute inset-0 overflow-hidden">
            {isStoryVideo(story.mediaUrl) ? (
              <>
                <video
                  src={story.mediaUrl}
                  autoPlay
                  muted
                  playsInline
                  loop
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl saturate-150"
                />
                <video
                  src={story.mediaUrl}
                  autoPlay
                  muted
                  playsInline
                  loop
                  className="relative h-full w-full object-contain"
                />
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown */}
                <img
                  src={story.mediaUrl}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl saturate-150"
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown */}
                <img
                  src={story.mediaUrl}
                  alt=""
                  className="relative h-full w-full object-contain"
                />
              </>
            )}
          </div>
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
  const live = useFeed("live");
  const [openAt, setOpenAt] = useState<number | null>(null);
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getSeenServerSnapshot);
  const liveEntries = useMemo(
    () => toLiveEntries(live.data?.pages.flatMap((page) => page.items) ?? []),
    [live.data]
  );
  const groups = useMemo(
    () => groupByAuthor(stories.data?.items ?? []),
    [stories.data]
  );

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
              <Avatar name={me.data?.displayName ?? "You"} seed={me.data?.id} src={me.data?.avatarUrl} size={33} />
            </span>
            <span className="absolute -bottom-0.5 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-black">
              <IconPlus className="h-2.5 w-2.5 [&]:stroke-[3]" />
            </span>
          </span>
          <span className="w-full truncate text-center text-[8px] text-white/60">Your Story</span>
        </Link>

        {/* Same ordering rule as desktop: live leads. The design never drew a
            live entry in the circular variant, so the treatment is carried over
            from the card strip — red ring, red pill — sized to the 41px ring. */}
        {liveEntries.map((entry) => (
          <Link
            key={entry.id}
            href={liveHref(entry, me.data?.id)}
            aria-label={`${entry.displayName} is live: ${entry.title}`}
            className="ws-press flex w-[41px] shrink-0 flex-col items-center gap-1"
          >
            <span className="relative block">
              <span className="ws-story-live block rounded-full">
                <Avatar name={entry.displayName} seed={entry.hostId} src={entry.avatarUrl} size={41} />
              </span>
              <LivePill className="-bottom-1" />
            </span>
            <span className="w-full truncate text-center text-[8px] text-white/80">
              {entry.displayName.split(" ")[0]}
            </span>
          </Link>
        ))}

        {groups.map((group, i) => {
          const allSeen = group.stories.every((story) => seen.has(story.id));
          return (
            <button
              key={group.id}
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
                  <Avatar name={group.displayName} seed={group.id} src={group.avatarUrl} size={38} />
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
  // The `live` lane, not `GET /streams?status=live`: Home already fetches this
  // exact query for the featured hero, so the strip costs no extra request, and
  // it keeps the rail inside the feed slice instead of reaching into streams.
  const live = useFeed("live");
  const [openAt, setOpenAt] = useState<number | null>(null);
  const seen = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getSeenServerSnapshot);

  const liveEntries = useMemo(
    () => toLiveEntries(live.data?.pages.flatMap((page) => page.items) ?? []),
    [live.data]
  );
  const groups = useMemo(
    () => groupByAuthor(stories.data?.items ?? []),
    [stories.data]
  );

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
              <Avatar name={me.data?.displayName ?? "You"} seed={me.data?.id} src={me.data?.avatarUrl} size={48} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-black bg-white text-black">
                <IconPlus className="h-2.5 w-2.5 [&]:stroke-[3]" />
              </span>
            </span>
            <span className="text-[8px] font-bold text-white/40">Your Story</span>
          </span>
        </Link>

        {/* Live leads the rail — the highest-urgency thing on the square, and
            the one entry that expires while you look at it. A tap opens the
            room, never the story viewer. */}
        {liveEntries.map((entry) => (
          <Link
            key={entry.id}
            href={liveHref(entry, me.data?.id)}
            aria-label={`${entry.displayName} is live: ${entry.title}`}
            className="ws-press shrink-0"
          >
            <LiveCard entry={entry} />
          </Link>
        ))}

        {groups.map((group, i) => {
          const allSeen = group.stories.every((story) => seen.has(story.id));
          return (
            <button
              key={group.id}
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
