"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { inboxTime } from "@/lib/inbox-time";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import type { MarketNotification } from "@/features/notifications/lib/types";

/**
 * ONE GLYPH PER KIND, AND EVERY ONE IS THE FILE'S OWN — node 742:15341.
 *
 * The row does NOT lead with the actor's photograph. It leads with a 48px disc
 * on 10% white holding a KIND glyph, which is easy to miss because the disc's
 * layer in the file is named after a person ("Fatima Bello") while its only
 * child is a vector group. Checked the child rather than assuming a face went
 * there.
 *
 * These were dingbats — "◎", "♥", "⇄" — standing in for art nobody had
 * exported. They are exported now, from this node, as real SVGs in
 * `public/notifications/`. Multi-colour art keeps its own fills (the wink is a
 * two-tone gradient with `#7E3BEB` and `#6F23EB` accents), so these are files
 * rather than `currentColor` icon components.
 *
 * WHAT THE FILE DRAWS, AND WHAT IT DOES NOT. It gives five glyphs — a wink, a
 * follow, a trending mark, a mention and a post. Our contract has eleven kinds.
 * The extra ones are mapped to the file's own art by what they are ABOUT rather
 * than given invented glyphs: everything that happens to a post takes the post
 * mark, and the two money kinds take the coin already exported for the earnings
 * panel. The two admin resolutions get no glyph at all — there is none in the
 * file and none of the five means "an operator answered you" — so those rows
 * fall back to the actor's avatar, which is at least true.
 */
const GLYPHS: Partial<Record<MarketNotification["kind"], string>> = {
  wink: "/notifications/notif-wink.svg",
  follow: "/notifications/notif-follow.svg",
  stream_live: "/notifications/notif-trending.svg",
  comment: "/notifications/notif-mention.svg",
  like: "/notifications/notif-post.svg",
  repost: "/notifications/notif-post.svg",
  bookmark: "/notifications/notif-post.svg",
  tip_received: "/gifts/coin-stack.svg",
  ticket_purchased: "/gifts/coin-stack.svg",
  // Chat-shaped events take the file's mention mark, which is the glyph it
  // draws on "Mentioned in Gistroom chat".
  message: "/notifications/notif-mention.svg",
  chat_request: "/notifications/notif-mention.svg",
  // Being added to a house is a fact about people, not about a post.
  group_added: "/notifications/notif-follow.svg",
  // A raised hand belongs to a live room, so it takes the trending mark.
  speaker_request: "/notifications/notif-trending.svg",
};

/**
 * THE ROW IS A TITLE AND A BODY, not one sentence — 742:15859 and 742:15860.
 *
 * A bold 16/16 headline that says what KIND of thing happened, then a 14/16.5
 * line at 50% white that says who and what. The old row was a single "{name}
 * followed you" string, which is the same information with none of the
 * scanning value: the headline is what lets somebody read a column of these
 * without reading any of them.
 *
 * The file's own copy is used verbatim where it gives it — "Someone is
 * interested in you!", "New Follower", "Happening Now! 🔥" — because the
 * wording IS the design. The rest is written in the same voice, and the two
 * standing rules survive: a wink says what happened and never what it obliges,
 * and a tip says what arrived rather than what it was worth, because the
 * payload carries no amount.
 */
function headline(item: MarketNotification): string {
  switch (item.kind) {
    case "wink":
      return "Someone is interested in you!";
    case "follow":
      return "New Follower";
    case "stream_live":
      return "Happening Now! 🔥";
    case "comment":
      return "New comment";
    case "like":
      return "New like";
    case "repost":
      return "Reposted";
    case "bookmark":
      return "Saved to Arkmarks";
    case "tip_received":
      return "You were tipped";
    case "ticket_purchased":
      return "Ticket sold";
    case "verification_resolved":
      return "Verification resolved";
    case "role_resolved":
      return "Role resolved";
    case "message":
      return "New message";
    case "chat_request":
      return "Message request";
    case "group_added":
      return "Added to a house";
    case "speaker_request":
      return "Speaker request";
  }
}

// The service sends structured events, not prose — the copy lives here so it
// stays in the product's voice.
function describe(item: MarketNotification): string {
  const who = item.actor?.displayName || item.actor?.username || "Someone";
  switch (item.kind) {
    case "follow":
      return `${who} started following you on Square.`;
    case "like":
      return `${who} liked your post.`;
    case "comment":
      return `${who} commented on your post.`;
    case "repost":
      return `${who} reposted your post.`;
    case "bookmark":
      return `${who} saved your post to their Arkmarks.`;
    case "ticket_purchased":
      return `${who} bought a ticket to your stream.`;
    case "tip_received":
      // What ARRIVED, not what it was worth. The notification payload carries
      // no amount or gift, so this says the true general thing and the tips
      // list (Earnings) carries the detail.
      return `${who} sent you a tip.`;
    case "wink":
      // Says what happened and nothing about what it obliges. A wink is an
      // opening, not a request, and copy that implies otherwise ("wants to
      // meet you") puts the recipient on a spot they did not step onto.
      return `${who} just winked at you. Wink back at them now to kick things off.`;
    case "stream_live":
      return `${who} is live right now. Tune in.`;
    case "verification_resolved":
      return "Your verification request has been resolved.";
    case "role_resolved":
      return "Your role request has been resolved.";
    case "message":
      return `${who} sent you a message.`;
    case "chat_request":
      // A request is not yet a conversation, and the copy must not imply the
      // reader has agreed to one.
      return `${who} wants to start a chat with you.`;
    case "group_added":
      return `${who} added you to a house.`;
    case "speaker_request":
      return `${who} asked to speak in your room.`;
  }
}

// Where a notification points. Nulls are real — a like on a deleted post has
// no post to open — so the row stays unclickable rather than linking nowhere.
function hrefFor(item: MarketNotification): string | null {
  // A chat event has no post and no stream, so without this it fell through to
  // the sender's PROFILE — which is not where the message is.
  if (item.kind === "message" || item.kind === "chat_request") return "/messages";
  if (item.streamId) return `/live/${item.streamId}`;
  if (item.postId) return `/p/${item.postId}`;
  if (item.actor) return `/u/${item.actor.username}`;
  return null;
}

function Row({
  item,
  onMarkRead,
  actionSlot,
}: {
  item: MarketNotification;
  onMarkRead: (id: string) => void;
  actionSlot?: (item: MarketNotification) => React.ReactNode;
}) {
  const href = hrefFor(item);
  const unread = !item.readAt;
  const glyph = GLYPHS[item.kind];
  const action = actionSlot?.(item);

  const body = (
    <>
      {/* 742:15857 — 48 at a full round on 10% white. The glyph is the file's
          own art; where the file draws none, the actor's face stands in. */}
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
        {glyph ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={glyph} alt="" aria-hidden className="h-6 w-6" />
        ) : item.actor ? (
          <Avatar
            name={item.actor.displayName || item.actor.username}
            seed={item.actor.id}
            src={item.actor.avatarUrl}
            size={48}
          />
        ) : null}
      </span>

      {/* 742:15858 — 8 between the headline and the line under it. */}
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="truncate text-[16px] font-bold leading-4 text-white">
          {headline(item)}
        </span>
        <span className="line-clamp-2 text-[14px] leading-[16.5px] text-white/50">
          {describe(item)}
        </span>
      </span>

      {/* 742:15884 — the action and the stamp, 16 apart, held at the right.
          The stamp is `inboxTime`, not `relativeTime`: the file shows "11:39",
          "Yesterday", "2d", "3d" — a clock inside today and an age past it,
          which is exactly what that helper already produces for the inbox. */}
      <span className="flex shrink-0 items-center gap-4">
        {action}
        {item.createdAt && (
          <time
            dateTime={item.createdAt}
            className="shrink-0 text-[10px] leading-[15px] text-white/50"
          >
            {inboxTime(item.createdAt)}
          </time>
        )}
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
            <span className="block h-2 w-2 rounded-full bg-create" />
          </button>
        )}
      </span>
    </>
  );

  /* 742:15855 — 97 tall, 32 in from the left, 16 between the three groups, and
     NO divider: the rows are separated by an unread wash and nothing else. An
     unread row is `#FFFFFF` at 3%; a read one has no fill at all. */
  const className = cn(
    "flex min-h-[97px] items-center gap-4 px-8 py-6 transition-colors",
    unread ? "bg-white/[0.03] hover:bg-white/[0.06]" : "hover:bg-white/[0.03]"
  );

  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export function NotificationsPage({
  actionSlot,
}: {
  /**
   * The per-row action — "Wink back" (742:15885) and "Follow back"
   * (742:15901). Both are the PROFILE slice's mutations, and slices never
   * import each other, so they arrive through a route slot composed in
   * `components/layout/notifications-screen.tsx`.
   */
  actionSlot?: (item: MarketNotification) => React.ReactNode;
} = {}) {
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
      {/*
        742:15830 — the page's own head, not a `ColumnHeader`.

        It was `ColumnHeader` with the subtitle "Activity from across the
        square", which the file does not have: node 742:15830 is a
        SPACE_BETWEEN row carrying the title at Geist 500 24/31.2 and a filter
        pill opposite it, and nothing else. The subtitle was ours.
      */}
      <div className="flex items-center justify-between gap-4 px-8 pb-2 pt-6">
        <h1 className="text-[24px] font-medium leading-[31.2px] text-white">Notifications</h1>

        {/*
          742:15825 — 145x44 at a full round on `#979797` at 5%, the label at
          Geist 500 14/20 and the file's own chevron beside it.

          IT IS INERT, AND VISIBLY SO. The file draws a filter, and
          `GET /me/notifications` takes only `limit` and `cursor` — there is no
          `kind` parameter to narrow on, so there is nothing to switch between
          and every option would answer the same list. Rendering it live would
          be a control that changes nothing; rendering it `disabled` says what
          is true. The same rule the chat inbox's three inert tabs follow.
        */}
        <button
          type="button"
          disabled
          title="Filtering notifications isn't available yet"
          className="flex h-11 shrink-0 cursor-not-allowed items-center gap-2.5 rounded-full bg-[#979797]/5 px-4 text-[14px] font-medium leading-5 text-white opacity-60"
        >
          All notification
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/notifications/notif-chevron.svg"
            alt=""
            aria-hidden
            className="h-[3.5px] w-[7px] shrink-0"
          />
        </button>
      </div>

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
            <Row
              key={item.id}
              item={item}
              onMarkRead={(id) => markRead.mutate([id])}
              actionSlot={actionSlot}
            />
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
