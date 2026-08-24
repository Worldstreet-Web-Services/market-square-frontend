"use client";

import Link from "next/link";
import { relativeTime } from "@/lib/format";
import { ColumnHeader } from "@/components/layout/column-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import {
  useNotifications,
  useReadAllNotifications,
  useReadNotification,
} from "@/features/notifications/hooks/use-notifications";

const GLYPHS = {
  follow: "◎",
  activity: "◇",
  stream_live: "◉",
  ticket: "▱",
  product: "◈",
  account: "○",
} as const;

export function NotificationsPage() {
  const notifications = useNotifications();
  const read = useReadNotification();
  const readAll = useReadAllNotifications();
  const unread = notifications.data?.items.filter((item) => !item.read).length ?? 0;

  return (
    <>
      <ColumnHeader
        title="Notifications"
        subtitle="Activity from people and products you follow"
        action={
          unread > 0 ? (
            <button
              onClick={() => readAll.mutate()}
              disabled={readAll.isPending}
              className="ws-press shrink-0 rounded-full border border-white/20 px-4 py-1.5 text-sm font-bold text-body transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

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
      {notifications.isSuccess && notifications.data.items.length === 0 && (
        <div className="p-4">
          <EmptyState
            glyph="○"
            title="You're all caught up"
            body="Follow creators, products and activities to see updates here."
          />
        </div>
      )}

      {notifications.data?.items.map((item) => (
        <Link
          key={item.id}
          href={item.href ?? "#"}
          onClick={() => !item.read && read.mutate(item.id)}
          className={cn(
            "ws-row flex items-start gap-3 px-4 py-3",
            // Unread rows carry a faint silver wash, the way X tints new items.
            !item.read && "bg-white/4"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center text-xl text-accent">
            {GLYPHS[item.kind]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[15px] font-bold text-heading">
              {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
              {item.title}
            </span>
            <span className="mt-0.5 block text-[15px] leading-normal text-body">{item.body}</span>
            <span className="mt-1 block text-[13px] text-meta">{relativeTime(item.createdAt)}</span>
          </span>
        </Link>
      ))}
    </>
  );
}
