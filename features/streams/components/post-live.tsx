"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCount, formatCountdown, formatKash } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKET_FLAGS } from "@/lib/market-config";
import { IconPlay } from "@/components/ui/icons";
import { useStreamStats } from "@/features/streams/hooks/use-streams";
import { CreateStreamSheet, type StreamDraft } from "@/features/streams/components/create-stream-sheet";
import { BROADCAST_CATEGORIES, type Stream, type StreamCategory } from "@/features/streams/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="ws-card p-4">
      <p className="tnum ws-display text-2xl">{value}</p>
      <p className="ws-meta mt-1">{label}</p>
    </div>
  );
}

function formatViewTime(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1).replace(/\.0$/, "")}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

// State 3 — the summary. Real numbers only; a missing stats endpoint states
// itself plainly. Never a dead end: clone into a new draft or back to Studio.
export function PostLive({ stream }: { stream: Stream }) {
  const stats = useStreamStats(stream.id, true);
  const [cloneOpen, setCloneOpen] = useState(false);

  const duration =
    stream.startedAt && stream.endedAt
      ? formatCountdown(Date.parse(stream.endedAt) - Date.parse(stream.startedAt))
      : null;

  const draft: StreamDraft = {
    title: stream.title,
    thumbnailUrl: stream.thumbnailUrl ?? "",
    category: (BROADCAST_CATEGORIES as readonly string[]).includes(stream.category)
      ? (stream.category as StreamCategory)
      : "other",
    ticketPriceKash: stream.ticketPriceKash ?? "",
    vipPriceKash: stream.vipPriceKash ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-6">
      <div>
        <p className="ws-meta">Stream ended</p>
        <h1 className="ws-display mt-1 text-2xl">{stream.title}</h1>
        {duration && <p className="mt-1 text-sm text-grey-500">You were live for {duration}</p>}
        {stream.status === "cancelled" && (
          <p className="mt-1 text-sm text-grey-500">This stream was cancelled before going live.</p>
        )}
      </div>

      {stats.isPending && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}
      {stats.isError && (
        <p className="ws-inset px-4 py-6 text-center text-sm text-grey-500">
          Stats aren&apos;t available yet for this stream.
        </p>
      )}
      {stats.isSuccess && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Peak viewers" value={formatCount(stats.data.peakViewers)} />
          <Stat label="Unique viewers" value={formatCount(stats.data.uniqueViewers)} />
          <Stat label="View time" value={formatViewTime(stats.data.totalViewSeconds)} />
          <Stat label="Messages" value={formatCount(stats.data.messages)} />
          <Stat label="Tickets sold" value={formatCount(stats.data.ticketsSold)} />
          {stats.data.kashEarned !== null && (
            <Stat label="KASH earned" value={formatKash(stats.data.kashEarned)} />
          )}
        </div>
      )}

      {/* The host just finished streaming, so "where is my recording?" is the
          first question they have. The card stays to answer it — but as a
          statement, not a link: with `replays` off there is nothing to open,
          and a tappable card that goes nowhere is worse than no card. */}
      {!MARKET_FLAGS.replays ? (
        <div className="ws-card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/6">
            <IconPlay className="ml-0.5 h-5 w-5 text-grey-600" />
          </span>
          <div>
            <p className="text-sm font-semibold text-grey-400">Replay — coming soon</p>
            <p className="text-xs text-grey-600">
              Streams aren&apos;t recorded yet, so this one wasn&apos;t saved.
            </p>
          </div>
        </div>
      ) : (
        stream.replayUrl && (
          <Link
            href={`/live/${stream.id}`}
            className="ws-card ws-press flex items-center gap-3 p-4 transition-colors hover:bg-white/8"
          >
            <span className="ws-glass flex h-10 w-10 items-center justify-center rounded-full">
              <IconPlay className="ml-0.5 h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-sm font-semibold text-heading">Watch the replay</p>
              <p className="text-xs text-grey-500">Available on your stream page</p>
            </div>
          </Link>
        )
      )}

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => setCloneOpen(true)}>
          Go live again
        </Button>
        <Link
          href="/studio"
          className="ws-press inline-flex h-12 items-center rounded-full border border-white/15 px-7 text-base font-semibold text-grey-200 transition-colors hover:bg-white/10"
        >
          Back to Studio
        </Link>
      </div>

      <CreateStreamSheet open={cloneOpen} onClose={() => setCloneOpen(false)} initial={draft} />
    </div>
  );
}
