"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { formatCount, formatCountdown, formatDateTime } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, VerifiedBadge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import {
  IconChevronLeft,
  IconComment,
  IconEye,
  IconHeart,
  IconLink,
  IconTicket,
} from "@/components/ui/icons";
import { ErrorState, InlineError } from "@/components/ui/states";
import type { Profile } from "@/lib/api/schemas";
import { useStream } from "@/features/streams/hooks/use-streams";
import { useHeartbeat, usePlaybackToken } from "@/features/streams/hooks/use-playback";
import { HlsPlayer } from "@/features/streams/components/hls-player";
import { LiveKitPlayer } from "@/features/streams/components/livekit-player";
import { ChatPanel } from "@/features/streams/components/chat-panel";
import { TicketSheet } from "@/features/streams/components/ticket-sheet";
import { streamPriceLabel } from "@/features/streams/components/stream-card";
import type { Stream } from "@/features/streams/lib/types";

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const remaining = Date.parse(target) - now;
  return (
    <p className="tnum ws-display text-4xl tracking-tight">
      {remaining <= 0 ? "Starting soon" : formatCountdown(remaining)}
    </p>
  );
}

// The playing surface for live and replay states. Owns the playback token,
// the ticket gate (403 ⇒ CTA), and the 15 s heartbeat. Full-bleed.
function PlaybackSurface({
  stream,
  mode,
  onNeedTicket,
}: {
  stream: Stream;
  mode: "live" | "replay";
  onNeedTicket: () => void;
}) {
  const playback = usePlaybackToken(stream.id, true);
  const [playing, setPlaying] = useState(false);
  useHeartbeat(stream.id, mode, playing && playback.isSuccess);

  if (playback.isPending) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner className="h-8 w-8 text-grey-600" />
      </div>
    );
  }
  if (playback.isError) {
    if (errorCode(playback.error) === "FORBIDDEN") {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
          <IconTicket className="h-8 w-8 text-grey-300" />
          <p className="text-sm text-body">This stream is for ticket holders.</p>
          <Button className="ws-press" onClick={onNeedTicket}>
            Get ticket · {streamPriceLabel(stream)}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6">
        <InlineError error={playback.error} fallback="Couldn't start playback." />
        <Button variant="secondary" size="sm" onClick={() => playback.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  // ws/wss URLs are LiveKit rooms; http(s) URLs are HLS manifests.
  if (/^wss?:/i.test(playback.data.url)) {
    return (
      <LiveKitPlayer url={playback.data.url} token={playback.data.token} onPlayingChange={setPlaying} fill />
    );
  }
  return <HlsPlayer src={playback.data.url} onPlayingChange={setPlaying} fill />;
}

// Non-live states rendered on the same immersive stage.
function StageBody({ stream, onOpenTickets }: { stream: Stream; onOpenTickets: () => void }) {
  const gate = useGate();
  const needsTicket =
    stream.visibility === "ticketed" &&
    !stream.myTicket &&
    Boolean(stream.ticketPriceKash ?? stream.vipPriceKash);

  if (stream.status === "cancelled") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="ws-display text-xl">This stream was cancelled</p>
        <p className="text-sm text-meta">The host called it off. Check their profile for what&apos;s next.</p>
      </div>
    );
  }
  if (stream.status === "scheduled") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        {stream.scheduledAt && (
          <>
            <p className="ws-meta">Starts in</p>
            <Countdown target={stream.scheduledAt} />
            <p className="text-sm text-meta">{formatDateTime(stream.scheduledAt)}</p>
          </>
        )}
        {needsTicket ? (
          <Button className="ws-press" onClick={() => gate(onOpenTickets)}>
            <IconTicket className="h-4 w-4" /> Get ticket · {streamPriceLabel(stream)}
          </Button>
        ) : stream.myTicket ? (
          <Pill tone="accent">Ticket confirmed — you&apos;re in</Pill>
        ) : (
          <Pill>Free to watch when it starts</Pill>
        )}
      </div>
    );
  }
  if (stream.status === "ended") {
    if (!stream.replayUrl) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="ws-display text-xl">Replay coming soon</p>
          <p className="text-sm text-meta">This stream has ended. The replay is processing — check back shortly.</p>
        </div>
      );
    }
    return <PlaybackSurface stream={stream} mode="replay" onNeedTicket={() => gate(onOpenTickets)} />;
  }
  return <PlaybackSurface stream={stream} mode="live" onNeedTicket={() => gate(onOpenTickets)} />;
}

interface Reaction {
  id: number;
  left: number;
  drift: number;
  rotate: number;
  duration: number;
}

const MAX_REACTIONS = 30;
let reactionSeq = 0;

export function StreamRoom({
  streamId,
  followSlot,
}: {
  streamId: string;
  /** Route-composed follow control (owner profile lives in another slice). */
  followSlot?: (owner: Profile) => React.ReactNode;
}) {
  const stream = useStream(streamId, true);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const reactionTimers = useRef<number[]>([]);

  useEffect(() => {
    const timers = reactionTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const spawnReaction = useCallback(() => {
    setReactions((current) => {
      if (current.length >= MAX_REACTIONS) return current;
      const reaction: Reaction = {
        id: reactionSeq++,
        left: 12 + Math.random() * 30,
        drift: -40 + Math.random() * 80,
        rotate: -25 + Math.random() * 50,
        duration: 2 + Math.random() * 1.2,
      };
      const timer = window.setTimeout(() => {
        setReactions((list) => list.filter((r) => r.id !== reaction.id));
      }, reaction.duration * 1000);
      reactionTimers.current.push(timer);
      return [...current, reaction];
    });
  }, []);

  const share = useCallback(() => {
    const url = window.location.href;
    const title = stream.data?.title ?? "Market Square stream";
    if (navigator.share) {
      void navigator.share({ title, url }).catch(() => {});
    } else {
      void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
    }
  }, [stream.data?.title]);

  if (stream.isPending) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <Spinner className="h-8 w-8 text-grey-600" />
      </div>
    );
  }
  if (stream.isError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black px-4">
        <ErrorState error={stream.error} fallback="Couldn't load this stream." onRetry={() => stream.refetch()} />
      </div>
    );
  }

  const data = stream.data;
  const owner = data.owner;

  return (
    <div className="flex h-dvh w-full bg-black">
      {/* Stage: full-bleed video with every control overlaid in safe-area. */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{ viewTransitionName: `stream-${data.id}` }}
      >
        <div className="absolute inset-0">
          <StageBody stream={data} onOpenTickets={() => setTicketsOpen(true)} />
        </div>

        {/* Scrims: gradients, not blur, over video. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-black/85 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />

        {/* Top overlay: back · host identity · viewers + LIVE. */}
        <div
          className="absolute inset-x-0 top-0 flex items-start gap-3 px-4 pb-2"
          style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
        >
          <Link
            href="/live"
            aria-label="Back to Live"
            className="ws-press mt-1 rounded-full bg-black/40 p-2 text-body"
          >
            <IconChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {owner && (
                <>
                  <Link href={`/u/${owner.username}`} className="shrink-0">
                    <Avatar name={owner.displayName} src={owner.avatarUrl} size={36} />
                  </Link>
                  <Link
                    href={`/u/${owner.username}`}
                    className="ws-text-shadow flex min-w-0 items-center gap-1.5 text-sm font-semibold text-heading"
                  >
                    <span className="truncate">{owner.displayName}</span>
                    <VerifiedBadge verification={owner.verification} />
                  </Link>
                  {followSlot?.(owner)}
                </>
              )}
            </div>
            <p className="ws-text-shadow mt-1 line-clamp-1 text-xs text-body">{data.title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {data.status === "live" && (
              <span className="ws-text-shadow flex items-center gap-1 text-xs text-body">
                <IconEye className="h-4 w-4" />
                <span className="tnum">{formatCount(data.viewerCount)}</span>
              </span>
            )}
            {data.status === "live" && <LiveBadge />}
            {data.status !== "live" && <Pill tone="accent">{streamPriceLabel(data)}</Pill>}
          </div>
        </div>

        {/* Bottom-left: transparent chat overlay (mobile / overlay mode). */}
        {chatOpen && (
          <div
            className="absolute bottom-0 left-0 h-[42dvh] w-[min(340px,78vw)] px-3 lg:hidden"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
          >
            <ChatPanel stream={data} variant="overlay" />
          </div>
        )}

        {/* Right edge: vertical action rail, 44px targets. */}
        <div
          className="absolute right-3 flex flex-col items-center gap-4"
          style={{ bottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          <button
            onClick={spawnReaction}
            aria-label="Send a heart"
            className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading"
          >
            <IconHeart className="h-5 w-5" />
          </button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            aria-label={chatOpen ? "Hide chat" : "Show chat"}
            aria-pressed={chatOpen}
            className={cn(
              "ws-press flex h-11 w-11 items-center justify-center rounded-full",
              chatOpen ? "bg-accent text-ink" : "bg-black/40 text-heading"
            )}
          >
            <IconComment className="h-5 w-5" />
          </button>
          <button
            onClick={share}
            aria-label="Share"
            className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading"
          >
            <IconLink className="h-5 w-5" />
          </button>
          {data.status === "live" && !data.myTicket && data.visibility === "ticketed" && (
            <button
              onClick={() => setTicketsOpen(true)}
              aria-label="Get ticket"
              className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-accent text-ink"
            >
              <IconTicket className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Floating tap reactions. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {reactions.map((reaction) => (
            <span
              key={reaction.id}
              className="ws-reaction bottom-24 text-accent"
              style={{
                right: `${reaction.left}%`,
                ["--rx" as string]: `${reaction.drift}px`,
                ["--rr" as string]: `${reaction.rotate}deg`,
                ["--rd" as string]: `${reaction.duration}s`,
              }}
            >
              <IconHeart className="h-6 w-6" filled />
            </span>
          ))}
        </div>
      </div>

      {/* Desktop theater: collapsible 340px chat column on raised surface. */}
      <aside
        className={cn(
          "hidden h-dvh shrink-0 flex-col border-l border-white/8 bg-panel transition-[width] duration-200 lg:flex",
          chatOpen ? "w-[340px]" : "w-0 overflow-hidden border-l-0"
        )}
      >
        {chatOpen && (
          <div className="flex h-full flex-col p-3">
            <div className="mb-2 px-1">
              <p className="ws-display line-clamp-1 text-sm">{data.title}</p>
              {data.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-meta">{data.description}</p>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel stream={data} />
            </div>
          </div>
        )}
      </aside>

      <TicketSheet stream={data} open={ticketsOpen} onClose={() => setTicketsOpen(false)} />
    </div>
  );
}
