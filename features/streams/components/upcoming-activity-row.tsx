"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { Avatar } from "@/components/ui/avatar";
import { IconCalendar } from "@/components/ui/icons";
import type { Activity } from "@/features/streams/lib/types";

/**
 * A scheduled ACTIVITY in the Upcoming list.
 *
 * Upcoming used to query `GET /streams?status=scheduled` only, so an activity
 * — which is what the schedule form actually creates — could never appear
 * there however many were made. Streams and activities are different records
 * with different shapes, so each gets its own row rather than one being forced
 * into the other's card.
 */
export function ActivityRow({ activity }: { activity: Activity }) {
  const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
  const host = activity.owner;

  return (
    <article className="ws-row flex items-start gap-3 px-4 py-3">
      <span className="ws-inset flex h-11 w-16 shrink-0 items-center justify-center rounded-lg text-grey-400">
        <IconCalendar className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[15px] font-bold text-heading">{activity.title}</h3>
          <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-meta">
            {activity.type || "activity"}
          </span>
        </div>
        {/* Start time is the whole point of an Upcoming row. */}
        <p className="mt-0.5 text-[13px] text-body">{formatDateTime(activity.startsAt)}</p>
        {host && (
          <Link
            href={`/u/${host.username}`}
            className="mt-1.5 flex items-center gap-1.5 text-[12px] text-meta hover:text-body"
          >
            <Avatar name={host.displayName} src={host.avatarUrl} size={18} />
            {host.displayName}
          </Link>
        )}
        {activity.description && (
          <p className="mt-1 line-clamp-2 text-[13px] text-meta">{activity.description}</p>
        )}
      </div>
      {cta && (
        <Link
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noreferrer" : undefined}
          className="ws-press shrink-0 self-center rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
        >
          {cta.label}
        </Link>
      )}
    </article>
  );
}
