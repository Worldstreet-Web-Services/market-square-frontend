"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { formatCount, formatCountdown, formatKash, relativeTime } from "@/lib/format";
import { LiveBadge } from "@/components/ui/badge";
import { Button, Spinner } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/states";
import {
  IconCamera,
  IconCopy,
  IconEye,
  IconLink,
  IconTicket,
  IconUser,
  IconX,
} from "@/components/ui/icons";
import { usePublisher } from "@/features/streams/hooks/use-publisher";
import { useLiveRoom } from "@/features/streams/hooks/use-live-room";
import { LiveStage, type TileFitReport } from "@/features/streams/components/live-stage";
import {
  useBanFromChat,
  useDeleteChatMessage,
  useEndStream,
  useResolveSpeakerRequest,
  useSpeakerRequests,
  useStreamEvents,
  useUpdateStream,
} from "@/features/streams/hooks/use-streams";
import { ChatPanel } from "@/features/streams/components/chat-panel";
import { SpeakerRequestQueue } from "@/features/streams/components/guest-speaker-control";
import {
  STREAM_CATEGORIES,
  type Ingest,
  type Stream,
  type StreamCategory,
} from "@/features/streams/lib/types";

const inputClass =
  "ws-inset w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-grey-600";

function SessionTimer({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  if (!startedAt) return null;
  return <span className="tnum text-sm text-body">{formatCountdown(now - Date.parse(startedAt))}</span>;
}

// Quiet when fine, loud only on degradation.
function QualityDot({ quality, state }: { quality: string; state: string }) {
  const degraded = quality === "poor" || state === "reconnecting" || state === "failed";
  return (
    <span
      title={degraded ? "Connection degraded" : "Connection healthy"}
      aria-label={degraded ? "Connection degraded" : "Connection healthy"}
      className={cn("h-2 w-2 rounded-full", degraded ? "bg-down" : "bg-accent")}
    />
  );
}

function MaskedKey({ value }: { value: string }) {
  const masked = value.length > 6 ? `${value.slice(0, 4)}••••••${value.slice(-2)}` : "••••••";
  return <code className="tnum rounded bg-black/50 px-2 py-1 text-xs text-grey-200">{masked}</code>;
}

function ObsSignalPanel({ ingest }: { ingest: Ingest }) {
  const copy = (value: string, label: string) => {
    void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`));
  };
  if (!ingest.rtmpUrl || !ingest.streamKey) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-grey-300">RTMP ingest unavailable on this deployment</p>
        <p className="text-xs text-grey-500">Stream from your browser instead.</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <p className="text-sm text-body">Waiting for your encoder&apos;s signal…</p>
      <div className="ws-inset w-full max-w-md space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-grey-500">RTMP URL</span>
          <code className="tnum min-w-0 flex-1 truncate rounded bg-black/50 px-2 py-1 text-xs text-grey-200">
            {ingest.rtmpUrl}
          </code>
          <button onClick={() => copy(ingest.rtmpUrl!, "RTMP URL")} aria-label="Copy RTMP URL" className="rounded-full p-1.5 text-grey-400 hover:bg-white/10 hover:text-white">
            <IconCopy className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] text-grey-500">Stream key</span>
          <MaskedKey value={ingest.streamKey} />
          <button onClick={() => copy(ingest.streamKey!, "Stream key")} aria-label="Copy stream key" className="rounded-full p-1.5 text-grey-400 hover:bg-white/10 hover:text-white">
            <IconCopy className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Activity feed: real events only; absence is stated, never papered over.
function ActivityPanel({ streamId }: { streamId: string }) {
  const events = useStreamEvents(streamId, true);
  if (events.isPending) {
    return (
      <div className="space-y-3 p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (events.isError) {
    return (
      <p className="p-4 text-center text-xs text-grey-500">
        Activity isn&apos;t available yet — it&apos;s coming soon.
      </p>
    );
  }
  if (events.data.items.length === 0) {
    return <p className="p-4 text-center text-xs text-grey-500">No activity yet — share your link.</p>;
  }
  return (
    <ul className="space-y-2 overflow-y-auto p-3">
      {events.data.items.map((event) => (
        <li key={event.id} className="ws-inset flex items-center gap-3 px-3 py-2">
          <span className="ws-raised flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-grey-300">
            {event.kind === "ticket_purchased" ? (
              <IconTicket className="h-4 w-4" />
            ) : event.kind === "follow" ? (
              <IconUser className="h-4 w-4" />
            ) : (
              <IconEye className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-body">
              <span className="font-semibold text-heading">{event.profile?.displayName ?? "Someone"}</span>{" "}
              {event.kind === "ticket_purchased"
                ? "bought a ticket"
                : event.kind === "follow"
                  ? "followed you"
                  : "joined"}
              {event.amountKash && (
                <span className="text-accent"> · {formatKash(event.amountKash)}</span>
              )}
            </p>
            <p className="text-[11px] text-meta">{relativeTime(event.occurredAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function InfoDrawer({ stream }: { stream: Stream }) {
  const update = useUpdateStream(stream.id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(stream.title);
  const [category, setCategory] = useState<StreamCategory>(
    (STREAM_CATEGORIES as readonly string[]).includes(stream.category)
      ? (stream.category as StreamCategory)
      : "other"
  );
  return (
    <div className="ws-inset">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-grey-300"
      >
        Stream info
        <span className="text-meta">{open ? "Hide" : "Edit"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} aria-label="Title" />
          <select value={category} onChange={(e) => setCategory(e.target.value as StreamCategory)} className={inputClass} aria-label="Category">
            {STREAM_CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-sheet capitalize">
                {c}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            loading={update.isPending}
            onClick={() =>
              update.mutate({ title: title.trim() || undefined, category }, { onSuccess: () => setOpen(false) })
            }
          >
            Save without ending
          </Button>
        </div>
      )}
    </div>
  );
}

// Five bars driven by the level of the track we are actually publishing, so a
// host can see at a glance that their voice is leaving the machine — the
// failure this replaces is a live mic that looks fine and sends silence.
function LiveMicLevel({ level, muted }: { level: number; muted: boolean }) {
  const lit = muted ? 0 : Math.round(Math.min(1, level) * 5);
  return (
    <div
      className="flex h-4 items-end gap-0.5"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={lit}
      aria-label={muted ? "Microphone muted" : "Microphone level"}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <span
          key={index}
          style={{ height: `${(index + 1) * 20}%` }}
          className={cn(
            "w-1 rounded-full transition-colors duration-75 motion-reduce:transition-none",
            index < lit ? "bg-up" : "bg-white/15"
          )}
        />
      ))}
    </div>
  );
}

/**
 * How our own video is reaching viewers, in one quiet line.
 *
 * Only says something when there IS something to say: a letterboxed source, or
 * a crop deep enough to matter. Silence means the framing viewers see is the
 * framing the host is looking at.
 */
function describeFraming(reports: readonly TileFitReport[]): string | null {
  const screen = reports.find((report) => report.isScreenShare);
  if (screen && screen.fit === "contain") {
    return "Your screen is being shown letterboxed — viewers see all of it.";
  }
  const camera = reports.find((report) => !report.isScreenShare);
  if (camera?.fit === "contain") {
    return "Your camera is wider than the stage — viewers see it letterboxed.";
  }
  // `cover` inside the crop budget is deliberate framing, not a problem worth a
  // line of chrome. Only name a crop once it is visibly eating the frame.
  if (camera && camera.loss >= 0.1) {
    return `Viewers see a cropped view — about ${Math.round(camera.loss * 100)}% of your frame is off-screen.`;
  }
  return null;
}

// State 2 — the live cockpit.
export function LiveCockpit({
  stream,
  ingest,
  devices,
  onRejoin,
  rejoining,
}: {
  stream: Stream;
  ingest: Ingest | null;
  devices: { cameraId: string; micId: string } | null;
  /** Idempotent go-live re-POST to mint fresh ingest after a deep link. */
  onRejoin: () => void;
  rejoining: boolean;
}) {
  const [mode, setMode] = useState<"browser" | "obs">("browser");
  const publisher = usePublisher({
    ingest,
    enabled: mode === "browser" && ingest !== null,
    streamId: stream.id,
    preferredCamera: devices?.cameraId || undefined,
    preferredMic: devices?.micId || undefined,
  });
  // The host's own Room, read from the single-room registry that usePublisher
  // registered it in. This is the whole reason the host could not see or hear an
  // approved guest: usePublisher wires LocalTrackPublished and nothing else, so
  // the cockpit rendered exactly one video element — its own preview — and never
  // attached a single remote track, video or audio.
  const room = useLiveRoom(stream.id);
  const requests = useSpeakerRequests(stream.id, stream.status === "live");
  const resolve = useResolveSpeakerRequest(stream.id);
  // Remove-from-stage is the backend's resolve action; LiveKit drops the grant
  // and unpublishes their tracks, and the stage loses the slot on the next
  // ParticipantPermissionsChanged.
  const removeGuest = (identity: string) => {
    const request = requests.data?.items.find(
      (item) => item.userId === identity && item.status === "approved"
    );
    if (!request) {
      toast.error("Couldn't find that guest's request.");
      return;
    }
    resolve.mutate({ requestId: request.id, action: "remove" });
  };

  // What viewers are actually seeing of OUR video. A host framing a shot has no
  // other way to learn that the stage is letterboxing their screen share, or
  // that the edges of a wide camera are being cut off for everyone else.
  const [fits, setFits] = useState<TileFitReport[]>([]);
  const framingHint = describeFraming(fits);

  const end = useEndStream();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [rightTab, setRightTab] = useState<"chat" | "activity">("chat");
  const [mobileChat, setMobileChat] = useState(true);
  const removeMessage = useDeleteChatMessage(stream.id);
  const ban = useBanFromChat(stream.id);
  const moderation = {
    onRemove: (messageId: string) => removeMessage.mutate(messageId),
    onBan: (userId: string) => ban.mutate(userId),
  };

  const degraded =
    mode === "browser" &&
    (publisher.quality === "poor" || publisher.state === "reconnecting" || publisher.state === "failed");

  const share = () => {
    const url = `${window.location.origin}/live/${stream.id}`;
    if (navigator.share) void navigator.share({ title: stream.title, url }).catch(() => {});
    else void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
  };

  const preview = (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {mode === "obs" ? (
        ingest ? (
          <ObsSignalPanel ingest={ingest} />
        ) : (
          <RejoinPanel onRejoin={onRejoin} rejoining={rejoining} />
        )
      ) : ingest === null ? (
        <RejoinPanel onRejoin={onRejoin} rejoining={rejoining} />
      ) : (
        <>
          {/* The stage renders EVERY publisher, host included — the host's own
              camera is slot 0 of the same list, not a separate preview element
              on a separate code path. */}
          <LiveStage
            className="absolute inset-0"
            room={room}
            hostIdentity={stream.ownerId}
            onRemoveGuest={removeGuest}
            removing={resolve.isPending}
            emptyState={<Spinner className="h-6 w-6 text-grey-500" />}
            onLocalFit={setFits}
          />
          {/* Information, not an error: no icon, no colour, no action. */}
          {framingHint && (
            <p className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto w-fit max-w-[90%] truncate rounded-full bg-black/55 px-3 py-1 text-[11px] text-[#8B8F96]">
              {framingHint}
            </p>
          )}
          {publisher.state === "denied" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center">
              <IconCamera className="h-6 w-6 text-grey-400" />
              <p className="text-sm text-down">Camera and microphone access was denied.</p>
              <p className="text-xs text-grey-500">Allow access in site settings, then reload.</p>
            </div>
          )}
          {(publisher.state === "connecting" || publisher.state === "reconnecting") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
              <Spinner className="h-6 w-6 text-grey-500" />
              <p className="text-xs text-grey-400">
                {publisher.state === "reconnecting" ? "Reconnecting…" : "Connecting…"}
              </p>
            </div>
          )}
          {publisher.state === "failed" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center">
              <p className="text-sm text-down">Lost the studio connection.</p>
              <Button size="sm" variant="secondary" onClick={onRejoin} loading={rejoining}>
                Reconnect
              </Button>
            </div>
          )}
          {!publisher.camOn && publisher.state === "publishing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85">
              <p className="text-sm text-grey-400">Camera is off</p>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col">
      {/* Sticky status bar (desktop & mobile chips share it). */}
      <div className="ws-raised sticky top-0 z-30 flex items-center gap-3 px-3 py-2">
        <LiveBadge />
        <SessionTimer startedAt={stream.startedAt} />
        <span className="flex items-center gap-1 text-sm text-body">
          <IconEye className="h-4 w-4" />
          <span className="tnum">{formatCount((stream.viewerCount ?? 0))}</span>
        </span>
        <QualityDot quality={publisher.quality} state={mode === "browser" ? publisher.state : "publishing"} />
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/live/${stream.id}`}
            target="_blank"
            rel="noopener"
            className="hidden text-xs font-semibold text-accent hover:underline sm:block"
          >
            View as audience ↗
          </a>
          {/* End: spatially isolated, always confirmed. */}
          <button
            onClick={() => setConfirmEnd(true)}
            className="ws-press hidden rounded-full border border-down/50 px-4 py-1.5 text-xs font-bold text-down transition-colors hover:bg-down/10 md:block"
          >
            End stream
          </button>
          <button
            onClick={() => setConfirmEnd(true)}
            aria-label="End stream"
            className="ws-press rounded-full border border-down/50 p-2 text-down md:hidden"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {degraded && (
        <div className="bg-down/15 px-4 py-1.5 text-center text-xs font-semibold text-down">
          Connection degraded — viewers may see stutter.
        </div>
      )}

      {/* Body */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[65fr_35fr]">
        {/* Left: preview + controls */}
        <div className="relative flex min-h-0 flex-col">
          <div className="relative min-h-0 flex-1">{preview}</div>

          {/* Mobile overlays: chat lower-third + right-edge actions. */}
          <div className="pointer-events-none absolute inset-0 lg:hidden">
            {mobileChat && (
              <div className="pointer-events-auto absolute bottom-16 left-0 h-[36dvh] w-[min(320px,80vw)] px-3">
                <ChatPanel stream={stream} variant="overlay" moderation={moderation} />
              </div>
            )}
            <div className="pointer-events-auto absolute bottom-16 right-3 flex flex-col items-center gap-3">
              {mode === "browser" && (
                <>
                  <button
                    onClick={() => void publisher.toggleMic()}
                    aria-label={publisher.micOn ? "Mute mic" : "Unmute mic"}
                    className={cn("ws-press flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full", publisher.micOn ? "bg-black/40 text-heading" : "bg-down/80 text-ink")}
                  >
                    <span className="text-[10px] font-bold">{publisher.micOn ? "MIC" : "MUTED"}</span>
                    {publisher.micOn && <LiveMicLevel level={publisher.micLevel} muted={false} />}
                  </button>
                  <button
                    onClick={() => void publisher.toggleCam()}
                    aria-label={publisher.camOn ? "Camera off" : "Camera on"}
                    className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading"
                  >
                    <IconCamera className="h-5 w-5" />
                  </button>
                </>
              )}
              <button onClick={share} aria-label="Share" className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading">
                <IconLink className="h-5 w-5" />
              </button>
              <button
                onClick={() => setMobileChat((v) => !v)}
                aria-pressed={mobileChat}
                aria-label={mobileChat ? "Hide chat" : "Show chat"}
                className={cn("ws-press flex h-11 w-11 items-center justify-center rounded-full text-[10px] font-bold", mobileChat ? "bg-accent text-ink" : "bg-black/40 text-heading")}
              >
                CHAT
              </button>
            </div>
          </div>

          {/* Desktop control strip */}
          <div className="hidden items-center gap-2 border-t border-white/8 p-3 lg:flex">
            {mode === "browser" ? (
              <>
                <Button variant={publisher.micOn ? "secondary" : "danger"} size="sm" onClick={() => void publisher.toggleMic()}>
                  {publisher.micOn ? "Mute mic" : "Unmute mic"}
                </Button>
                <LiveMicLevel level={publisher.micLevel} muted={!publisher.micOn} />
                <Button variant={publisher.camOn ? "secondary" : "danger"} size="sm" onClick={() => void publisher.toggleCam()}>
                  {publisher.camOn ? "Camera off" : "Camera on"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMode("obs")}>
                  Use OBS
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setMode("browser")}>
                Stream from browser
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={share}>
              Copy link
            </Button>
            <div className="ml-auto w-64">
              <InfoDrawer stream={stream} />
            </div>
          </div>
        </div>

        {/* Right column: chat always visible; Activity expands above it. */}
        <div className="hidden min-h-0 flex-col border-l border-white/8 bg-panel lg:flex">
          <div className="flex gap-1 p-2">
            {(["chat", "activity"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setRightTab(value)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-xs font-semibold capitalize transition-colors",
                  rightTab === value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="max-h-[34%] overflow-y-auto border-b border-white/8">
            <SpeakerRequestQueue stream={stream} />
          </div>
          {rightTab === "activity" && (
            <div className="max-h-[40%] min-h-0 overflow-y-auto border-b border-white/8">
              <ActivityPanel streamId={stream.id} />
            </div>
          )}
          {/* Chat never hidden behind the tab: it stays below Activity. */}
          <div className="min-h-0 flex-1 p-2">
            <ChatPanel stream={stream} moderation={moderation} />
          </div>
        </div>
      </div>

      {/* End confirm */}
      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End stream?">
        <div className="space-y-4">
          <p className="text-sm text-grey-400">
            Viewers will be disconnected. If a replay is available it will appear on your stream page.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              loading={end.isPending}
              onClick={() =>
                end.mutate(stream.id, {
                  onSuccess: () => setConfirmEnd(false),
                })
              }
            >
              End stream
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmEnd(false)}>
              Keep going
            </Button>
          </div>
          {end.isError && <InlineError error={end.error} fallback="Couldn't end the stream." />}
        </div>
      </Sheet>
    </div>
  );
}

function RejoinPanel({ onRejoin, rejoining }: { onRejoin: () => void; rejoining: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-body">You&apos;re live — reconnect this device to broadcast.</p>
      <Button onClick={onRejoin} loading={rejoining}>
        Open broadcast
      </Button>
    </div>
  );
}
