"use client";

import { TransitionLink } from "@/components/ui/transition-link";
import { formatCount, formatDateTime, formatKash } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, VerifiedBadge } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconCalendar, IconEye, IconPlay } from "@/components/ui/icons";
import type { Stream } from "@/features/streams/lib/types";

export function streamPriceLabel(stream: Pick<Stream, "ticketPriceKash" | "vipPriceKash">): string {
  if (stream.ticketPriceKash) return formatKash(stream.ticketPriceKash);
  if (stream.vipPriceKash) return `Free · VIP ${formatKash(stream.vipPriceKash)}`;
  return "Free";
}

export function StreamCard({ stream }: { stream: Stream }) {
  return (
    <TransitionLink
      href={`/live/${stream.id}`}
      className="ws-card ws-press block overflow-hidden transition-colors hover:bg-white/8"
    >
      <GradientThumb
        seed={stream.id}
        className="h-36 w-full"
        style={{ viewTransitionName: `stream-${stream.id}` }}
      >
        <div className="absolute left-3 top-3">
          {stream.status === "live" ? (
            <LiveBadge />
          ) : stream.status === "ended" ? (
            <Pill>{stream.replayUrl ? "Replay" : "Ended"}</Pill>
          ) : (
            <Pill>
              <IconCalendar className="h-3 w-3" />
              {stream.scheduledAt ? formatDateTime(stream.scheduledAt) : "Scheduled"}
            </Pill>
          )}
        </div>
        <div className="absolute bottom-3 right-3">
          <Pill tone="accent">{streamPriceLabel(stream)}</Pill>
        </div>
        {(stream.status === "live" || stream.replayUrl) && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="ws-glass flex h-11 w-11 items-center justify-center rounded-full">
              <IconPlay className="ml-0.5 h-5 w-5 text-white" />
            </span>
          </span>
        )}
      </GradientThumb>
      <div className="flex items-center gap-3 p-4">
        {stream.owner && <Avatar name={stream.owner.displayName} src={stream.owner.avatarUrl} size={34} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{stream.title}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-grey-500">
            {stream.owner && (
              <>
                <span>{stream.owner.displayName}</span>
                <VerifiedBadge verification={stream.owner.verification} className="h-3.5 w-3.5" />
              </>
            )}
            {stream.category && <span>· {stream.category}</span>}
            {stream.status === "live" && (stream.viewerCount > 0 || stream.peakViewers > 0) && (
              <span className="flex items-center gap-1">
                · <IconEye className="h-3.5 w-3.5" /> {formatCount(stream.viewerCount || stream.peakViewers)}
              </span>
            )}
          </p>
        </div>
      </div>
    </TransitionLink>
  );
}
