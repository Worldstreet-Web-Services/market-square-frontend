"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe } from "@/hooks/use-me";
import { formatDateTime } from "@/lib/format";
import { LiveBadge, Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCamera } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useMyStreams } from "@/features/streams/hooks/use-streams";
import { streamPriceLabel } from "@/features/streams/components/stream-card";
import { CreateStreamSheet } from "@/features/streams/components/create-stream-sheet";
import type { Stream } from "@/features/streams/lib/types";

function StreamRow({ stream }: { stream: Stream }) {
  const state =
    stream.status === "live" ? "cockpit" : stream.status === "scheduled" ? "green room" : "summary";
  return (
    <li>
      <Link
        href={`/studio/${stream.id}`}
        className="ws-card ws-press flex items-center gap-4 p-4 transition-colors hover:bg-white/8"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-heading">{stream.title}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-grey-500">
            {stream.status === "live" ? (
              <LiveBadge className="px-2 py-0 text-[9px]" />
            ) : (
              <Pill className="px-2 py-0 text-[10px] capitalize">{stream.status}</Pill>
            )}
            {stream.scheduledAt && <span>{formatDateTime(stream.scheduledAt)}</span>}
            <span>· {streamPriceLabel(stream)}</span>
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-accent">
          {state === "cockpit" ? "Open cockpit →" : state === "green room" ? "Green room →" : "Summary →"}
        </span>
      </Link>
    </li>
  );
}

// State 0: not a form page — one CTA into the flow, plus your streams.
export function StudioHome() {
  const me = useMe();
  const mine = useMyStreams();
  const [createOpen, setCreateOpen] = useState(false);

  if (me.isSuccess && (me.data.role === "citizen" || me.data.role === "ambassador")) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <EmptyState
          glyph="◈"
          title="Studio is for creators"
          body="Apply for a creator role from your profile to schedule and host streams."
          action={
            <Link
              href={`/u/${me.data.username}#creator`}
              className="ws-press rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white"
            >
              Become a creator
            </Link>
          }
        />
      </div>
    );
  }

  const items = mine.data?.items ?? [];
  const active = items.filter((s) => s.status === "live" || s.status === "scheduled");
  const past = items.filter((s) => s.status === "ended" || s.status === "cancelled");

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="ws-display text-2xl">Studio</h1>
          <p className="mt-1 text-sm text-grey-500">Your streams, your room, your audience.</p>
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)}>
          <IconCamera className="h-5 w-5" /> Go Live
        </Button>
      </div>

      <section>
        <h2 className="ws-display mb-3 text-lg">Up next & live</h2>
        {mine.isPending && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-18" />
            ))}
          </div>
        )}
        {mine.isError && (
          <ErrorState error={mine.error} fallback="Couldn't load your streams." onRetry={() => mine.refetch()} />
        )}
        {mine.isSuccess && active.length === 0 && (
          <EmptyState
            glyph="◉"
            title="Nothing scheduled"
            body="Hit Go Live — you'll check your camera in the green room before anyone sees you."
          />
        )}
        <ul className="space-y-3">
          {active.map((stream) => (
            <StreamRow key={stream.id} stream={stream} />
          ))}
        </ul>
      </section>

      {(mine.isPending || past.length > 0) && (
        <section>
          <h2 className="ws-display mb-3 text-lg">Past streams</h2>
          <ul className="space-y-3">
            {past.map((stream) => (
              <StreamRow key={stream.id} stream={stream} />
            ))}
          </ul>
        </section>
      )}

      <CreateStreamSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
