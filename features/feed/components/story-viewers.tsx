"use client";

import Link from "next/link";
import { profileHref } from "@/lib/profile-href";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { atHandle } from "@/lib/handle";
import { relativeTime } from "@/lib/format";
import { seenByLabel } from "@/lib/story-viewers";
import type { StoryViewersQuery } from "@/features/feed/hooks/use-story-viewers";

/**
 * WHO SAW YOUR STORY — the list, drawn INSIDE the story card.
 *
 * It slides up over the lower part of the story, the way Instagram does it,
 * rather than opening a separate sheet: the story viewer is already a
 * full-screen dialog that owns focus, and a second dialog stacked on top of it
 * is where focus and layering bugs live. The story is held while this is open.
 *
 * Each row is the person, their handle and how long ago they looked, and it
 * opens their profile. There is no Follow button: follow belongs to the profile
 * slice, which the feed may not import, and the row already leads to it.
 *
 * The heading counts from \`total\`, never from the rows — people blocked in
 * either direction are left out of the list, so it can be shorter.
 */
export function StoryViewersPanel({
  query,
  total,
  onClose,
}: {
  query: StoryViewersQuery;
  total: number;
  onClose: () => void;
}) {
  const sentinel = useInfiniteScroll(
    () => void query.fetchNextPage(),
    Boolean(query.hasNextPage && !query.isFetchingNextPage)
  );
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div
      role="dialog"
      aria-label={seenByLabel(total)}
      // The card's tap zones and press-to-hold listen for pointer events; a
      // scroll or a tap in here is about the list, not the story.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70%] flex-col rounded-t-3xl border-t border-white/10 bg-[#121214]"
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 className="text-[15px] font-bold text-white">{seenByLabel(total)}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewers"
          className="ws-press flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {rows.map(({ profile, viewedAt }) => (
          <li key={profile.id}>
            <Link
              href={profileHref(profile)}
              className="ws-press flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06]"
            >
              <Avatar name={profile.displayName} seed={profile.id} src={profile.avatarUrl} size={40} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold text-white">{profile.displayName}</span>
                {atHandle(profile.username) && (
                  <span className="truncate text-[12px] text-white/50">{atHandle(profile.username)}</span>
                )}
              </span>
              <span className="tnum shrink-0 text-[12px] text-white/50">{relativeTime(viewedAt)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && !query.isFetching && (
          <li className="px-3 py-6 text-center text-[13px] text-white/50">No views yet</li>
        )}
        <div ref={sentinel} />
        {query.isFetchingNextPage && (
          <li className="flex justify-center py-3">
            <Spinner className="h-5 w-5 text-white/60" />
          </li>
        )}
      </ul>
    </div>
  );
}
