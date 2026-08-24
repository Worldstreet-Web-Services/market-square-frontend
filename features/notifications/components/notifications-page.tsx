"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ColumnHeader } from "@/components/layout/column-header";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import type { MarketNotification } from "@/features/notifications/lib/types";

// One glyph per kind. Unknown kinds coerce to "follow" at the schema boundary,
// so this map is total.
const GLYPHS: Record<MarketNotification["kind"], string> = {
  follow: "◎",
  like: "♥",
  comment: "◇",
  repost: "⇄",
  bookmark: "▱",
  ticket_purchased: "▣",
  stream_live: "◉",
  verification_resolved: "✓",
  role_resolved: "○",
};

// The service sends structured events, not prose — the copy lives here so it
// stays in the product's voice.
function describe(item: MarketNotification): string {
  switch (item.kind) {
    case "follow":
      return "followed you";
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "repost":
      return "reposted your post";
    case "bookmark":
      return "saved your post to their Arkmarks";
    case "ticket_purchased":
      return "bought a ticket to your stream";
    case "stream_live":
      return "is live now";
    case "verification_resolved":
      return "resolved your verification request";
    case "role_resolved":
      return "resolved your role request";
  }
}

// Where a notification points. Nulls are real — a like on a deleted post has
// no post to open — so the row stays unclickable rather than linking nowhere.
function hrefFor(item: MarketNotification): string | null {
  if (item.streamId) return `/live/${item.streamId}`;
  if (item.postId) return `/p/${item.postId}`;
  if (item.actor) return `/u/${item.actor.username}`;
  return null;
}

function Row({ item, onMarkRead }: { item: MarketNotification; onMarkRead: (id: string) => void }) {
  const href = hrefFor(item);
  const unread = !item.readAt;

  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-xl text-featured">
        {GLYPHS[item.kind]}
      </span>
      {item.actor ? (
        <Avatar name={item.actor.displayName} src={item.actor.avatarUrl} size={36} />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-normal text-body">
          <span className="font-bold text-heading">
            {item.actor?.displayName ?? "Someone"}
          </span>{" "}
          {describe(item)}
        </span>
        {item.createdAt && (
          <span className="mt-1 block text-[13px] text-meta">{relativeTime(item.createdAt)}</span>
        )}
      </span>
      {/* The unread dot is the per-row acknowledgement. `useMarkNotificationsRead`
          has always taken ids; the UI only ever passed `undefined`, so a reader
          could clear everything or nothing. */}
      {unread && (
        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onMarkRead(item.id);
          }}
          aria-label="Mark as read"
          title="Mark as read"
          className="ws-press shrink-0 rounded-full p-1.5 transition-colors hover:bg-white/10"
        >
          <span className="block h-2 w-2 rounded-full bg-featured" />
        </button>
      )}
    </>
  );

  const className = cn(
    "ws-row flex items-start gap-3 px-4 py-3",
    // Unread rows carry a faint silver wash, the way X tints new items.
    unread && "bg-white/4"
  );

  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export function NotificationsPage() {
  const { ready, authenticated, login } = useAuth();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const sentinel = useInfiniteScroll(
    () => notifications.fetchNextPage(),
    Boolean(notifications.hasNextPage && !notifications.isFetchingNextPage)
  );

  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  const unread = notifications.data?.pages[0]?.unreadCount ?? 0;

  // Mark-as-read on view: opening the surface is the acknowledgement, so it
  // fires once per arrival at the page rather than on every refetch.
  const acknowledged = useRef(false);
  useEffect(() => {
    if (!authenticated || acknowledged.current || unread === 0) return;
    acknowledged.current = true;
    markRead.mutate(undefined);
  }, [authenticated, unread, markRead]);

  return (
    <>
      <ColumnHeader title="Notifications" subtitle="Activity from across the square" />

      {ready && !authenticated && (
        <div className="p-4">
          <EmptyState
            glyph="○"
            title="Sign in to see your notifications"
            body="Follows, likes and replies land here."
            action={
              <button
                onClick={login}
                className="ws-btn-silver ws-press rounded-full px-5 py-2 text-[13px] font-bold"
              >
                Sign in
              </button>
            }
          />
        </div>
      )}

      {authenticated && (
        <>
          {notifications.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}
          {notifications.isError && (
            <div className="p-4">
              <ErrorState
                error={notifications.error}
                fallback="Couldn't load notifications."
                onRetry={() => notifications.refetch()}
              />
            </div>
          )}
          {notifications.isSuccess && items.length === 0 && (
            <div className="p-4">
              <EmptyState
                glyph="○"
                title="You're all caught up"
                body="Follow creators, products and activities to see updates here."
              />
            </div>
          )}

          {items.map((item) => (
            <Row key={item.id} item={item} onMarkRead={(id) => markRead.mutate([id])} />
          ))}

          <div ref={sentinel} />
          {notifications.isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <Spinner className="h-6 w-6 text-meta" />
            </div>
          )}
        </>
      )}
    </>
  );
}
