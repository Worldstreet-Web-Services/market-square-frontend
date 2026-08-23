"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { IconX } from "@/components/ui/icons";
import { useStories } from "@/features/feed/hooks/use-feed";
import type { Post } from "@/features/feed/lib/types";

const STORY_MS = 5000;

function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: Post[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const story = stories[index];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (index + 1 < stories.length) setIndex(index + 1);
      else onClose();
    }, STORY_MS);
    return () => clearTimeout(timer);
  }, [index, stories.length, onClose]);

  if (!story) return null;
  const cta = story.deepLink ? resolveDeepLink(story.deepLink) : null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* progress bars */}
      <div className="absolute inset-x-4 top-4 flex gap-1.5">
        {stories.map((s, i) => (
          <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full bg-white"
              initial={{ width: i < index ? "100%" : "0%" }}
              animate={{ width: i <= index ? "100%" : "0%" }}
              transition={i === index ? { duration: STORY_MS / 1000, ease: "linear" } : { duration: 0 }}
            />
          </div>
        ))}
      </div>
      <button onClick={onClose} aria-label="Close story" className="absolute right-4 top-8 z-10 p-2 text-white">
        <IconX className="h-5 w-5" />
      </button>
      {/* tap zones */}
      <button
        aria-label="Previous story"
        className="absolute inset-y-0 left-0 w-1/3"
        onClick={() => (index > 0 ? setIndex(index - 1) : onClose())}
      />
      <button
        aria-label="Next story"
        className="absolute inset-y-0 right-0 w-1/3"
        onClick={() => (index + 1 < stories.length ? setIndex(index + 1) : onClose())}
      />
      <div className="mx-6 flex max-w-md flex-col items-center gap-6 text-center">
        {story.author && (
          <div className="flex items-center gap-3">
            <Avatar name={story.author.displayName} src={story.author.avatarUrl} size={40} ring />
            <div className="text-left">
              <p className="text-sm font-semibold">{story.author.displayName}</p>
              <p className="text-xs text-grey-500">{relativeTime(story.createdAt)}</p>
            </div>
          </div>
        )}
        <p className="ws-display text-2xl leading-snug text-white">{story.text}</p>
        {cta && (
          <Link
            href={cta.href}
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export function StoriesRow() {
  const stories = useStories();
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (stories.isPending) {
    return (
      <div className="flex gap-4 overflow-x-auto px-1 py-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-2 w-10" />
          </div>
        ))}
      </div>
    );
  }
  const items = stories.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-1 py-2">
        {items.map((story, i) => (
          <button key={story.id} onClick={() => setOpenAt(i)} className="flex shrink-0 flex-col items-center gap-1.5">
            <Avatar name={story.author?.displayName ?? "?"} src={story.author?.avatarUrl} size={56} ring />
            <span className="max-w-16 truncate text-[11px] text-grey-400">
              {story.author?.username ?? "story"}
            </span>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {openAt !== null && (
          <StoryViewer stories={items} startIndex={openAt} onClose={() => setOpenAt(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
