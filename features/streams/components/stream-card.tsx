"use client";

import { TransitionLink } from "@/components/ui/transition-link";
import { formatCount, formatDateTime, formatKash } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, VerifiedBadge } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconEye, IconPlay } from "@/components/ui/icons";
import { gameLabel } from "@/lib/deeplink";
import type { Stream } from "@/features/streams/lib/types";
import { MARKET_FLAGS } from "@/lib/market-config";
import { sq } from "@/lib/square-path";

export function streamPriceLabel(stream: Pick<Stream, "ticketPriceKash" | "vipPriceKash">): string {
  if (stream.ticketPriceKash) return formatKash(stream.ticketPriceKash);
  if (MARKET_FLAGS.vipAccess && stream.vipPriceKash) return `Free · VIP ${formatKash(stream.vipPriceKash)}`;
  return "Free";
}

// List row for the Live column: thumbnail left, everything else stacked
// beside it, so a full section scans in one vertical pass.
export function StreamCard({ stream }: { stream: Stream }) {
  // Live viewers only. `peakViewers` is a historical high-water mark, so
  // showing it as "watching" on a discovery surface is a lie — when there is
  // no live count, the row says nothing.
  const viewers = stream.status === "live" ? stream.viewerCount : null;
  // Ark-created streams carry a game deep link; native ones do not.
  const game = gameLabel(stream.deepLink);
  return (
    <TransitionLink
      href={sq(`/live/${stream.id}`)}
      className="ws-row flex items-start gap-3 px-4 py-3"
    >
      <GradientThumb
        seed={stream.id}
        className="aspect-[16/10] w-32 shrink-0 rounded-xl sm:w-36"
        style={{ viewTransitionName: `stream-${stream.id}` }}
      >
        {stream.status === "live" && (
          <span className="absolute left-1.5 top-1.5">
            <LiveBadge className="px-2 py-0 text-[9px]" />
          </span>
        )}
        {/* A play badge promises playback. Only live does that today: an
            ended stream has no replay to open while `replays` is off. */}
        {(stream.status === "live" || (MARKET_FLAGS.replays && stream.replayUrl)) && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="ws-glass flex h-9 w-9 items-center justify-center rounded-full">
              <IconPlay className="ml-0.5 h-4 w-4 text-white" />
            </span>
          </span>
        )}
      </GradientThumb>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-heading">{stream.title}</p>

        <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-meta">
          {stream.owner && (
            <>
              <Avatar name={stream.owner.displayName} seed={stream.owner.id} src={stream.owner.avatarUrl} size={18} />
              <span className="truncate">{stream.owner.displayName}</span>
              <VerifiedBadge verification={stream.owner.verification} className="h-3.5 w-3.5" />
            </>
          )}
          {stream.category && (
            <span className="shrink-0">{stream.owner ? `· ${stream.category}` : stream.category}</span>
          )}
        </p>

        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-meta">
          <Pill tone="accent" className="px-2 py-0 text-[10px]">
            {streamPriceLabel(stream)}
          </Pill>
          {/* Broadcast of an Ark casino game. The whole card is already a link
              into the room, so this is a label rather than a nested anchor —
              the actual route back into Ark lives in the room itself. */}
          {game && (
            <Pill tone="premium" className="px-2 py-0 text-[10px]">
              {game}
            </Pill>
          )}
          {viewers !== null && viewers > 0 && (
            <span className="tnum flex items-center gap-1">
              <IconEye className="h-3.5 w-3.5" /> {formatCount(viewers)} watching
            </span>
          )}
          {stream.status === "scheduled" && stream.scheduledAt && (
            <span>{formatDateTime(stream.scheduledAt)}</span>
          )}
          {stream.status === "ended" && (
            <span>
              {MARKET_FLAGS.replays && stream.replayUrl ? "Replay available" : "Ended"}
            </span>
          )}
        </p>
      </div>
    </TransitionLink>
  );
}
