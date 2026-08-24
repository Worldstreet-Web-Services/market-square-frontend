"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { formatCount, formatCountdown, formatDateTime } from "@/lib/format";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, VerifiedBadge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconCamera,
  IconChevronDown,
  IconChevronLeft,
  IconChevronUp,
  IconCoin,
  IconCollapseRight,
  IconComment,
  IconDots,
  IconEye,
  IconFullscreen,
  IconHeart,
  IconLink,
  IconLive,
  IconPause,
  IconPip,
  IconRefresh,
  IconShare,
  IconSpark,
  IconTheater,
  IconTicket,
  IconVolume,
} from "@/components/ui/icons";
import { ErrorState, InlineError } from "@/components/ui/states";
import type { Profile } from "@/lib/api/schemas";
import { useStream, useStreamList } from "@/features/streams/hooks/use-streams";
import { useHeartbeat, usePlaybackToken } from "@/features/streams/hooks/use-playback";
import { HlsPlayer } from "@/features/streams/components/hls-player";
import { LiveKitPlayer } from "@/features/streams/components/livekit-player";
import { ChatPanel } from "@/features/streams/components/chat-panel";
import { GiftSheet, LIVE_GIFTS, type LiveGift } from "@/features/streams/components/gift-sheet";
import { GuestSpeakerControl } from "@/features/streams/components/guest-speaker-control";
import {
  MarketPulse,
  type PulseChoice,
  type PulseCounts,
} from "@/features/streams/components/market-pulse";
import { TicketSheet } from "@/features/streams/components/ticket-sheet";
import { streamPriceLabel } from "@/features/streams/components/stream-card";
import type { Stream } from "@/features/streams/lib/types";
import { MARKET_FLAGS } from "@/lib/market-config";

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

function LiveElapsed({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt ?? new Date().toISOString())) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return <span className="tnum">{hours}:{String(minutes).padStart(2, "0")}:{String(rest).padStart(2, "0")}</span>;
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
  return <HlsPlayer src={playback.data.url} captionSrc={playback.data.captionUrl} onPlayingChange={setPlaying} fill />;
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
  color: string;
  size: number;
}

interface GiftBurst {
  id: number;
  gift: LiveGift;
  quantity: number;
}

const MAX_REACTIONS = 30;
// TikTok floats saturated hearts; Ark is monochrome, so the drift varies the
// silver ramp instead of the hue.
const REACTION_COLORS = ["#ffffff", "#f4f4f4", "#d4d4d8", "#bfbfbf", "#9b9b9b"];
let reactionSeq = 0;
let giftSeq = 0;

// Destinations repeat by design (Back and Discover both leave to /live), so
// the label is the identity here, not the href.
const STREAM_NAV = [
  { href: "/live", label: "Back", icon: IconChevronLeft },
  { href: "/live", label: "Discover LIVE", icon: IconLive, current: true },
  { href: "/studio", label: "Go LIVE", icon: IconCamera },
  { href: "/studio", label: "Creator tools", icon: IconSpark },
] as const;


function SuggestedCreators({ currentId }: { currentId: string }) {
  const live = useStreamList("live");
  const others = (live.data?.items ?? []).filter((item) => item.id !== currentId).slice(0, 5);

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-semibold text-grey-400">Suggested LIVE creators</p>
        <button
          onClick={() => live.refetch()}
          aria-label="Refresh suggestions"
          className="rounded-full p-1 text-grey-500 transition-colors hover:bg-white/10 hover:text-body"
        >
          <IconRefresh className="h-4 w-4" />
        </button>
      </div>

      {live.isPending && (
        <div className="mt-3 space-y-3 px-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
          ))}
        </div>
      )}

      {live.isSuccess && others.length === 0 && (
        <p className="mt-3 px-1 text-[11px] text-grey-600">No other creators are live right now.</p>
      )}

      <ul className="mt-2">
        {others.map((item) => (
          <li key={item.id}>
            <Link
              href={`/live/${item.id}`}
              className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-white/[0.07]"
            >
              <span className="relative shrink-0">
                <Avatar name={item.owner?.displayName ?? item.title} src={item.owner?.avatarUrl} size={36} />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-accent px-1 text-[7px] font-bold text-ink">
                  LIVE
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-heading">
                  {item.owner?.displayName ?? item.title}
                </span>
                <span className="block truncate text-[11px] text-meta">
                  {item.owner ? `@${item.owner.username}` : item.category}
                </span>
              </span>
              <span className="tnum shrink-0 text-[11px] text-meta">
                {formatCount(item.viewerCount || item.peakViewers)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/live" className="mt-2 flex items-center gap-1 px-1 py-1 text-[13px] font-semibold text-accent">
        <IconChevronDown className="h-3.5 w-3.5" /> See all
      </Link>
    </div>
  );
}

function StreamNav({ stream }: { stream: Stream }) {
  return (
    <aside className="hidden h-dvh w-[250px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-black px-5 py-6 text-body xl:flex 2xl:w-[304px]">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-xl font-black text-ink">M</span>
        <span className="ws-display text-xl">Market Square</span>
      </Link>
      <nav className="space-y-1" aria-label="Streaming navigation">
        {STREAM_NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={"current" in item && item.current ? "page" : undefined}
            className={cn(
              "flex items-center gap-4 rounded-lg px-3 py-3 text-[16px] font-semibold transition-colors hover:bg-white/[0.07]",
              "current" in item && item.current ? "bg-white/[0.08] text-heading" : "text-body"
            )}
          >
            <item.icon className="h-6 w-6" />
            {item.label}
          </Link>
        ))}
        <button className="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-[16px] font-semibold text-body transition-colors hover:bg-white/[0.07]">
          <IconDots className="h-6 w-6" /> More
        </button>
      </nav>
      {MARKET_FLAGS.liveGifts && (
        <button className="ws-press mt-6 flex items-center justify-center gap-2 rounded-lg bg-featured px-4 py-3 text-sm font-bold text-ink transition-colors hover:brightness-110">
          <IconCoin className="h-4 w-4" /> Get Coins
        </button>
      )}

      <SuggestedCreators currentId={stream.id} />
      <div className="mt-auto border-t border-white/10 px-1 pt-5 text-[12px] leading-6 text-grey-600">
        <p>Company</p>
        <p>Program</p>
        <p>Terms &amp; Policies</p>
        <p className="mt-2">© {new Date().getFullYear()} Market Square</p>
      </div>
    </aside>
  );
}

export function StreamRoom({
  streamId,
  followSlot,
}: {
  streamId: string;
  /** Route-composed follow control (owner profile lives in another slice). */
  followSlot?: (owner: Profile) => React.ReactNode;
}) {
  const stream = useStream(streamId, true);
  const gate = useGate();
  const me = useMe();
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  const [giftBursts, setGiftBursts] = useState<GiftBurst[]>([]);
  const [pulseVote, setPulseVote] = useState<PulseChoice | null>(null);
  const [localPulse, setLocalPulse] = useState<PulseCounts>({ bullish: 0, neutral: 0, bearish: 0 });
  const reactionTimers = useRef<number[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const timers = reactionTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const spawnReaction = useCallback((burst = 1) => {
    setLocalLikeCount((count) => count + burst);
    setReactions((current) => {
      const room = Math.max(0, MAX_REACTIONS - current.length);
      const additions = Array.from({ length: Math.min(burst, room) }, (_, index): Reaction => ({
        id: reactionSeq++,
        left: 5 + Math.random() * 20,
        drift: -54 + Math.random() * 108,
        rotate: -28 + Math.random() * 56,
        duration: 1.9 + Math.random() * 1.25 + index * 0.06,
        color: REACTION_COLORS[Math.floor(Math.random() * REACTION_COLORS.length)],
        size: 20 + Math.floor(Math.random() * 15),
      }));
      additions.forEach((reaction) => {
        const timer = window.setTimeout(() => {
          setReactions((list) => list.filter((item) => item.id !== reaction.id));
          reactionTimers.current = reactionTimers.current.filter((id) => id !== timer);
        }, reaction.duration * 1000);
        reactionTimers.current.push(timer);
      });
      return [...current, ...additions];
    });
  }, []);

  const sendGift = useCallback((gift: LiveGift, quantity: number) => {
    const burst = { id: giftSeq++, gift, quantity };
    setGiftBursts((current) => [...current.slice(-2), burst]);
    const timer = window.setTimeout(() => {
      setGiftBursts((current) => current.filter((item) => item.id !== burst.id));
      reactionTimers.current = reactionTimers.current.filter((id) => id !== timer);
    }, 3200);
    reactionTimers.current.push(timer);
    toast.success(`${gift.name} ×${quantity} sent`);
  }, []);

  const votePulse = useCallback((choice: PulseChoice) => {
    setLocalPulse((current) => {
      const next = { ...current };
      if (pulseVote) next[pulseVote] = Math.max(0, next[pulseVote] - 1);
      next[choice] += 1;
      return next;
    });
    setPulseVote(choice);
  }, [pulseVote]);

  const share = useCallback(() => {
    const url = window.location.href;
    const title = stream.data?.title ?? "Market Square stream";
    if (navigator.share) {
      void navigator.share({ title, url }).catch(() => {});
    } else {
      void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
    }
  }, [stream.data?.title]);

  const videoElement = useCallback(() => stageRef.current?.querySelector("video") ?? null, []);
  const togglePlayback = useCallback(() => {
    const video = videoElement();
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [videoElement]);
  const restartPlayback = useCallback(() => {
    const video = videoElement();
    if (!video) return;
    if (Number.isFinite(video.duration)) video.currentTime = 0;
    void video.play();
  }, [videoElement]);
  const toggleMute = useCallback(() => {
    const video = videoElement();
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, [videoElement]);
  const pictureInPicture = useCallback(() => {
    const video = videoElement();
    if (!video || !("requestPictureInPicture" in video)) return;
    void video.requestPictureInPicture();
  }, [videoElement]);
  const fullscreen = useCallback(() => {
    const node = stageRef.current;
    if (!node) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void node.requestFullscreen();
  }, []);

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
  // Gifting is governance-gated: with it off the panel is absent entirely,
  // and so is every piece of coin chrome that would imply it exists.
  const giftsAvailable = data.status === "live" && MARKET_FLAGS.liveGifts;
  const likeCount = data.likeCount + localLikeCount;
  const pulseCounts: PulseCounts = {
    bullish: data.pulse.bullish + localPulse.bullish,
    neutral: data.pulse.neutral + localPulse.neutral,
    bearish: data.pulse.bearish + localPulse.bearish,
  };

  return (
    <div className="flex h-dvh w-full bg-black">
      <StreamNav stream={data} />

      {/* Centre column. Below lg it is a full-bleed stage with everything
          overlaid; from lg it becomes the reference's vertical stack:
          header → player → handle → gift panel. */}
      <div
        className="relative min-w-0 flex-1 overflow-hidden bg-black lg:flex lg:flex-col"
        style={{ viewTransitionName: `stream-${data.id}` }}
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
          spawnReaction(5);
        }}
      >
        {/* ---- Header ------------------------------------------------- */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-start gap-3 px-4 pb-2 pt-3 lg:static lg:z-auto lg:h-[72px] lg:shrink-0 lg:items-center lg:border-b lg:border-white/10 lg:bg-panel lg:px-5 lg:py-0">
          <Link
            href="/live"
            aria-label="Back to Live"
            className="ws-press mt-1 rounded-full bg-black/40 p-2 text-body lg:hidden"
          >
            <IconChevronLeft className="h-5 w-5" />
          </Link>

          {owner && (
            <Link href={`/u/${owner.username}`} className="hidden shrink-0 lg:block">
              <Avatar name={owner.displayName} src={owner.avatarUrl} size={44} />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {owner ? (
                <>
                  <Link href={`/u/${owner.username}`} className="shrink-0 lg:hidden">
                    <Avatar name={owner.displayName} src={owner.avatarUrl} size={36} />
                  </Link>
                  <Link
                    href={`/u/${owner.username}`}
                    className="ws-text-shadow flex min-w-0 items-baseline gap-1.5 lg:[text-shadow:none]"
                  >
                    <span className="truncate text-[17px] font-bold text-heading">{owner.displayName}</span>
                    <VerifiedBadge verification={owner.verification} />
                    <span className="hidden truncate text-sm text-meta lg:inline">@{owner.username}</span>
                  </Link>
                </>
              ) : (
                <span className="ws-text-shadow truncate text-[17px] font-bold text-heading lg:[text-shadow:none]">
                  Market Live
                </span>
              )}
            </div>
            {/* Category then the live counters, as the reference stacks them. */}
            <div className="ws-text-shadow mt-0.5 flex items-center gap-3 text-xs text-body lg:text-meta lg:[text-shadow:none]">
              {data.category && (
                <span className="hidden uppercase tracking-wide lg:inline">{data.category}</span>
              )}
              {data.status === "live" && (
                <span className="flex items-center gap-1">
                  <IconEye className="h-4 w-4" />
                  <span className="tnum">{formatCount(data.viewerCount)}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <IconHeart className="h-4 w-4" filled />
                <span className="tnum">{formatCount(likeCount)}</span>
              </span>
              <span className="line-clamp-1">{data.title}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-1 lg:pt-0">
            <button
              onClick={share}
              aria-label="Reshare live stream"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-body transition-colors hover:bg-white/10 lg:flex"
            >
              <IconShare className="h-4 w-4" />
            </button>
            <button
              aria-label="More stream actions"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-body transition-colors hover:bg-white/10 lg:flex"
            >
              <IconDots className="h-4 w-4" />
            </button>
            <button className="hidden rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-[13px] font-bold text-heading transition-colors hover:bg-white/10 lg:block">
              Subscribe
            </button>
            {/* Follow is the filled, loudest control in the header. */}
            {owner && followSlot?.(owner)}
            {data.status === "live" && !data.myTicket && data.visibility === "ticketed" && (
              <button
                onClick={() => gate(() => setTicketsOpen(true))}
                className="ws-press hidden rounded-lg bg-accent px-4 py-2 text-[13px] font-bold text-ink transition-colors hover:bg-white lg:block"
              >
                Get ticket · {streamPriceLabel(data)}
              </button>
            )}
            {data.status !== "live" && <Pill tone="accent">{streamPriceLabel(data)}</Pill>}
          </div>
        </div>

        {/* ---- Player -------------------------------------------------- */}
        <div className="absolute inset-0 lg:static lg:min-h-0 lg:flex-1">
          <div className="relative h-full w-full bg-black">
            <div className="h-full w-full bg-black lg:mx-auto lg:aspect-[9/16] lg:w-auto lg:border-x lg:border-white/10">
              <div ref={stageRef} className="h-full w-full">
                <StageBody stream={data} onOpenTickets={() => setTicketsOpen(true)} />
              </div>
            </div>

            {/* Scrims: gradients, not blur, over video. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-gradient-to-b from-black/85 to-transparent lg:hidden" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent lg:h-32" />

            {/* Badges live inside the frame, not in the header. */}
            {data.status === "live" && (
              <span className="absolute left-4 top-3 z-10 hidden items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold text-heading backdrop-blur-sm lg:flex">
                <IconLive className="h-3.5 w-3.5 text-accent" />
                LIVE creator
              </span>
            )}
            <div className="absolute right-4 top-3 z-10 hidden items-center gap-2 lg:flex">
              {data.status === "live" && (
                <span className="tnum rounded-md bg-black/60 px-2 py-1 text-xs text-body backdrop-blur-sm">
                  <LiveElapsed startedAt={data.startedAt} />
                </span>
              )}
              {data.status === "live" && <LiveBadge />}
            </div>

            <button
              aria-label="Next live stream"
              className="absolute right-5 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-heading transition-colors hover:bg-white/15 lg:flex"
            >
              <IconChevronDown className="h-6 w-6" />
            </button>

            {/* Transport and window controls sit ON the frame, bottom edge. */}
            <div className="absolute inset-x-0 bottom-0 z-10 hidden items-center px-5 pb-3 lg:flex">
              <div className="flex items-center gap-1">
                <button
                  onClick={togglePlayback}
                  aria-label="Play or pause"
                  className="rounded-lg p-2 text-heading transition-colors hover:bg-white/10"
                >
                  <IconPause className="h-5 w-5" />
                </button>
                <button
                  onClick={restartPlayback}
                  aria-label="Restart playback"
                  className="rounded-lg p-2 text-heading transition-colors hover:bg-white/10"
                >
                  <IconRefresh className="h-5 w-5" />
                </button>
                {data.status === "live" && (
                  <>
                    <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
                    <button
                      onClick={() => setPulseOpen((open) => !open)}
                      aria-label="Open Market Pulse"
                      aria-pressed={pulseOpen}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-sm font-black transition-colors",
                        pulseOpen ? "bg-accent text-ink" : "text-heading hover:bg-white/10"
                      )}
                    >
                      ↗
                    </button>
                    {me.data?.id !== data.ownerId && <GuestSpeakerControl stream={data} />}
                  </>
                )}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button className="rounded-lg px-2 py-1.5 text-[10px] font-bold tracking-wide text-body transition-colors hover:bg-white/10">
                  AUTO
                </button>
                <button
                  onClick={fullscreen}
                  aria-label="Theater mode"
                  className="rounded-lg p-2 text-heading transition-colors hover:bg-white/10"
                >
                  <IconTheater className="h-5 w-5" />
                </button>
                <button
                  onClick={pictureInPicture}
                  aria-label="Picture in picture"
                  className="rounded-lg p-2 text-heading transition-colors hover:bg-white/10"
                >
                  <IconPip className="h-5 w-5" />
                </button>
                <button
                  onClick={fullscreen}
                  aria-label="Fullscreen"
                  className="rounded-lg p-2 text-heading transition-colors hover:bg-white/10"
                >
                  <IconFullscreen className="h-5 w-5" />
                </button>
                <button
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="rounded-lg p-2 text-heading transition-colors hover:bg-white/10"
                >
                  <IconVolume className="h-5 w-5" muted={muted} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Host handle under the frame, as in the reference. */}
        {owner && (
          <Link
            href={`/u/${owner.username}`}
            className="hidden shrink-0 px-5 py-2 text-[13px] text-meta transition-colors hover:text-body lg:block"
          >
            {owner.username}
          </Link>
        )}

        {/* ---- Gift panel: its own slab under the player -------------- */}
        {giftsAvailable && (
          <div className="mx-4 mb-4 hidden shrink-0 overflow-hidden rounded-2xl bg-raised lg:block">
            <div className="flex items-stretch">
              <div className="flex flex-1 items-center gap-1 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {LIVE_GIFTS.map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => gate(() => sendGift(gift, 1))}
                    className="ws-press group flex h-[82px] w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-transparent px-2 transition-colors hover:border-white/10 hover:bg-white/5"
                  >
                    <span className="text-[32px] leading-none transition-transform group-hover:-translate-y-1" aria-hidden>
                      {gift.emoji}
                    </span>
                    <span className="mt-1.5 max-w-full truncate text-[12px] font-semibold text-body">
                      {gift.name}
                    </span>
                    <span className="tnum mt-0.5 flex items-center gap-1 text-[11px] text-meta">
                      <IconCoin className="h-3 w-3 text-featured" />
                      {gift.priceKash}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => gate(() => setGiftsOpen(true))}
                aria-label="View all gifts"
                className="ws-press my-3 mr-3 flex w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 text-body transition-colors hover:bg-white/10"
              >
                <IconChevronUp className="h-4 w-4" />
              </button>
            </div>

            <div className="ws-hair flex items-center gap-3 border-t px-4 py-2 text-xs text-meta">
              <span className="flex items-center gap-1.5">
                Coin balance:
                <IconCoin className="h-3.5 w-3.5 text-featured" />
                <strong className="tnum text-heading">0</strong>
              </span>
              <button
                onClick={() => gate(() => setGiftsOpen(true))}
                className="ws-press rounded-md border border-featured/50 px-2 py-0.5 font-bold text-featured transition-colors hover:bg-featured/10"
              >
                Get Coins
              </button>
              <span className="ml-auto text-[10px]">Gifts support the creator</span>
            </div>
          </div>
        )}

        {/* ---- Mobile-only overlays ------------------------------------ */}
        {chatOpen && (
          <div
            className="absolute bottom-0 left-0 z-10 h-[42dvh] w-[min(340px,78vw)] px-3 lg:hidden"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
          >
            <ChatPanel stream={data} variant="overlay" />
          </div>
        )}

        {/* The vertical action rail is the phone pattern; on desktop these
            actions live in the header, the gift panel and the chat column. */}
        <div className="absolute bottom-4 right-3 z-10 flex flex-col items-center gap-4 lg:hidden">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => spawnReaction(1)}
              aria-label={`Send a heart. ${likeCount} likes`}
              className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading"
            >
              <IconHeart className="h-6 w-6 text-heading" filled />
            </button>
            <span className="tnum ws-text-shadow min-w-11 text-center text-[11px] font-bold text-white">
              {formatCount(likeCount)}
            </span>
          </div>
          {giftsAvailable && (
            <button
              onClick={() => gate(() => setGiftsOpen(true))}
              aria-label="Send a live gift"
              className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-featured text-ink transition-colors hover:brightness-110"
            >
              <IconCoin className="h-5 w-5" />
            </button>
          )}
          {data.status === "live" && me.data?.id !== data.ownerId && (
            <GuestSpeakerControl stream={data} />
          )}
          {data.status === "live" && (
            <button
              onClick={() => setPulseOpen((open) => !open)}
              aria-label="Open Market Pulse"
              aria-pressed={pulseOpen}
              className={cn(
                "ws-press flex h-11 w-11 items-center justify-center rounded-full text-lg font-black",
                pulseOpen ? "bg-accent text-ink" : "bg-black/40 text-heading"
              )}
            >
              ↗
            </button>
          )}
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

        {pulseOpen && data.status === "live" && (
          <div
            className="absolute bottom-20 right-16 z-20 lg:bottom-24 lg:left-5 lg:right-auto"
            style={{ marginBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            <MarketPulse
              counts={pulseCounts}
              selected={pulseVote}
              onSelect={(choice) => gate(() => votePulse(choice))}
            />
          </div>
        )}

        {/* Floating tap reactions. */}
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
          {reactions.map((reaction) => (
            <span
              key={reaction.id}
              className="ws-reaction bottom-24"
              style={{
                right: `${reaction.left}%`,
                color: reaction.color,
                ["--rx" as string]: `${reaction.drift}px`,
                ["--rr" as string]: `${reaction.rotate}deg`,
                ["--rd" as string]: `${reaction.duration}s`,
              }}
            >
              <span style={{ width: reaction.size, height: reaction.size }} className="block">
                <IconHeart className="h-full w-full" filled />
              </span>
            </span>
          ))}
          <div className="absolute inset-x-0 top-[28%] flex flex-col items-center gap-3 px-4">
            {giftBursts.map((burst) => (
              <div
                key={burst.id}
                className="ws-gift-burst flex items-center gap-3 rounded-full border border-white/20 bg-black/65 py-2 pl-3 pr-5 shadow-2xl backdrop-blur-md"
              >
                <span className="text-4xl">{burst.gift.emoji}</span>
                <span>
                  <span className="block text-xs font-semibold text-grey-300">Gift sent</span>
                  <span className="block text-sm font-bold text-white">
                    {burst.gift.name} <span style={{ color: burst.gift.color }}>×{burst.quantity}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Desktop theater: collapsible 340px chat column on raised surface. */}
      <aside
        className={cn(
          "hidden h-dvh shrink-0 flex-col border-l border-white/10 bg-panel text-body transition-[width] duration-200 lg:flex",
          chatOpen ? "w-[360px] 2xl:w-[430px]" : "w-0 overflow-hidden border-l-0"
        )}
      >
        {chatOpen && (
          <div className="flex h-full flex-col">
            <div className="ws-hair flex h-[72px] shrink-0 items-center gap-3 border-b px-4">
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Collapse chat"
                className="ws-press rounded-lg p-2 text-body transition-colors hover:bg-white/10"
              >
                <IconCollapseRight className="h-5 w-5" />
              </button>
              <p className="ws-display flex-1 text-center text-base">LIVE chat</p>
              <span className="flex items-center gap-1.5 text-xs text-meta">
                <IconEye className="h-4 w-4" />
                <span className="tnum">{formatCount(data.viewerCount)}</span>
              </span>
            </div>
            <div className="relative min-h-0 flex-1">
              <ChatPanel stream={data} variant="theater" showTopViewers />
              {data.status === "live" && (
                <button
                  onClick={() => spawnReaction(1)}
                  aria-label={`Send a heart. ${likeCount} likes`}
                  className="ws-press absolute bottom-[92px] right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-heading backdrop-blur-md transition-colors hover:bg-white/15"
                >
                  <IconHeart className="h-7 w-7" filled />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      <TicketSheet stream={data} open={ticketsOpen} onClose={() => setTicketsOpen(false)} />
      {MARKET_FLAGS.liveGifts && (
        <GiftSheet open={giftsOpen} onClose={() => setGiftsOpen(false)} onSend={sendGift} />
      )}
    </div>
  );
}
