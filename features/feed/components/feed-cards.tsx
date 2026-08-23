"use client";

import Link from "next/link";
import { TransitionLink } from "@/components/ui/transition-link";
import { formatDateTime, formatKash, formatCount, relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, VerifiedBadge } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconCalendar, IconEye, IconPlay } from "@/components/ui/icons";
import type { FeedItem, FeedStream } from "@/features/feed/lib/types";
import { PostCard } from "@/features/feed/components/post-card";

export function pricePillLabel(stream: FeedStream): string {
  if (stream.ticketPriceKash) return formatKash(stream.ticketPriceKash);
  if (stream.vipPriceKash) return `Free · VIP ${formatKash(stream.vipPriceKash)}`;
  return "Free";
}

function StreamFeedCard({ stream }: { stream: FeedStream }) {
  return (
    <TransitionLink
      href={`/live/${stream.id}`}
      className="ws-card ws-press block overflow-hidden transition-colors hover:bg-white/8"
    >
      <GradientThumb
        seed={stream.id}
        className="h-40 w-full"
        style={{ viewTransitionName: `stream-${stream.id}` }}
      >
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {stream.status === "live" ? (
            <LiveBadge />
          ) : (
            <Pill>
              <IconCalendar className="h-3 w-3" />
              {stream.scheduledAt ? formatDateTime(stream.scheduledAt) : "Scheduled"}
            </Pill>
          )}
        </div>
        <div className="absolute bottom-3 right-3">
          <Pill tone="accent">{pricePillLabel(stream)}</Pill>
        </div>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="ws-glass flex h-12 w-12 items-center justify-center rounded-full">
            <IconPlay className="ml-0.5 h-5 w-5 text-white" />
          </span>
        </span>
      </GradientThumb>
      <div className="flex items-center gap-3 p-4">
        {stream.owner && (
          <Avatar name={stream.owner.displayName} src={stream.owner.avatarUrl} size={36} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{stream.title}</p>
          <p className="flex items-center gap-2 text-xs text-grey-500">
            {stream.owner && (
              <span className="flex items-center gap-1">
                {stream.owner.displayName}
                <VerifiedBadge verification={stream.owner.verification} className="h-3.5 w-3.5" />
              </span>
            )}
            {stream.category && <span>· {stream.category}</span>}
            {stream.status === "live" && stream.peakViewers > 0 && (
              <span className="flex items-center gap-1">
                · <IconEye className="h-3.5 w-3.5" /> {formatCount(stream.peakViewers)}
              </span>
            )}
          </p>
        </div>
      </div>
    </TransitionLink>
  );
}

export function FeedItemCard({ item }: { item: FeedItem }) {
  if (item.type === "post" && item.post) return <PostCard post={item.post} />;
  if (item.type === "stream" && item.stream) return <StreamFeedCard stream={item.stream} />;

  if (item.type === "activity" && item.activity) {
    const activity = item.activity;
    const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
    return (
      <div className="ws-card flex items-center gap-4 p-4">
        <span className="ws-inset flex h-11 w-11 shrink-0 items-center justify-center text-grey-300">
          <IconCalendar className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{activity.title}</p>
          <p className="text-xs text-grey-500">
            {activity.owner ? `${activity.owner.displayName} · ` : ""}
            {formatDateTime(activity.startsAt)}
          </p>
        </div>
        {cta && (
          <Link
            href={cta.href}
            target={cta.external ? "_blank" : undefined}
            rel={cta.external ? "noreferrer" : undefined}
            className="shrink-0 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-grey-200 transition-colors hover:bg-white/10"
          >
            {cta.label}
          </Link>
        )}
      </div>
    );
  }

  if (item.type === "platform_event" && item.platformEvent) {
    const event = item.platformEvent;
    const cta = item.deepLink ? resolveDeepLink(item.deepLink) : null;
    return (
      <div className="ws-card border-accent/20 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent">WorldStreet</p>
        <p className="ws-display mt-1 text-base">{event.title}</p>
        {event.body && <p className="mt-1 text-sm text-grey-400">{event.body}</p>}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-grey-600">{relativeTime(event.occurredAt)}</span>
          {cta && (
            <Link
              href={cta.href}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {cta.label} →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}
