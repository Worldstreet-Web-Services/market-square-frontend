"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconCamera, IconCopy, IconLink } from "@/components/ui/icons";
// Both lifted into components/ui when Houses' backstage needed the same two
// controls. One meter, one checklist row — a second copy drifts.
import { ChecklistRow, MicMeter } from "@/components/ui/mic-meter";
import { InlineError } from "@/components/ui/states";
import { UploadField } from "@/components/ui/upload-field";
import { useDeviceCheck } from "@/features/streams/hooks/use-device-check";
import { useGoLive, useUpdateStream } from "@/features/streams/hooks/use-streams";
import { streamPriceLabel } from "@/features/streams/components/stream-card";
import {
  BROADCAST_CATEGORIES,
  type Ingest,
  type Stream,
  type StreamCategory,
} from "@/features/streams/lib/types";
import { MARKET_FLAGS } from "@/lib/market-config";
import { sq } from "@/lib/square-path";

const inputClass =
  "ws-inset w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-grey-600";

function StreamInfoCard({
  stream,
  deviceIssue,
  titleOk,
}: {
  stream: Stream;
  deviceIssue: boolean;
  titleOk: boolean;
}) {
  const update = useUpdateStream(stream.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(stream.title);
  const [category, setCategory] = useState<StreamCategory>(
    (BROADCAST_CATEGORIES as readonly string[]).includes(stream.category)
      ? (stream.category as StreamCategory)
      : "other"
  );
  const [ticket, setTicket] = useState(stream.ticketPriceKash ?? "");
  const [vip, setVip] = useState(stream.vipPriceKash ?? "");
  const [cover, setCover] = useState<string | null>(stream.thumbnailUrl);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${sq(`/live/${stream.id}`)}` : sq(`/live/${stream.id}`);

  return (
    <div className="ws-card space-y-4 p-4">
      <GradientThumb seed={stream.id} className="h-24 w-full rounded-xl" />
      {!editing ? (
        <div>
          <p className="ws-display text-base">{stream.title}</p>
          <p className="mt-1 text-xs capitalize text-meta">
            {stream.category} · {streamPriceLabel(stream)}
          </p>
          <button onClick={() => setEditing(true)} className="mt-2 text-xs font-semibold text-accent hover:underline">
            Edit details
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} aria-label="Title" />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as StreamCategory)} className={inputClass} aria-label="Category">
              {BROADCAST_CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-sheet capitalize">
                  {c}
                </option>
              ))}
            </select>
            <input value={ticket} onChange={(e) => setTicket(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Ticket KASH" inputMode="decimal" className={inputClass} aria-label="Ticket price" />
            {MARKET_FLAGS.vipAccess && <input value={vip} onChange={(e) => setVip(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="VIP KASH" inputMode="decimal" className={inputClass} aria-label="VIP price" />}
          </div>
          <UploadField value={cover} onChange={setCover} label="Cover" />
          {update.isError && <InlineError error={update.error} fallback="Couldn't save changes." />}
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    title: title.trim() || undefined,
                    category,
                    ticketPriceKash: ticket,
                    // VIP pricing stays behind its governance flag.
                    vipPriceKash: MARKET_FLAGS.vipAccess ? vip : undefined,
                    thumbnailUrl: cover ?? undefined,
                  },
                  { onSuccess: () => setEditing(false) }
                )
              }
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied"))}
        className="ws-inset flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <IconLink className="h-4 w-4 shrink-0 text-grey-500" />
        <span className="min-w-0 flex-1 truncate text-xs text-grey-300">{shareUrl}</span>
        <IconCopy className="h-4 w-4 shrink-0 text-grey-500" />
      </button>

      <ul className="space-y-1.5">
        <ChecklistRow ok={!deviceIssue} label="Camera & mic ready" />
        <ChecklistRow ok={titleOk} label="Title set" />
      </ul>
    </div>
  );
}

// State 1: never go live blind — a real device check gates the button in
// browser mode; OBS mode explains that credentials appear at go-live.
export function GreenRoom({
  stream,
  onWentLive,
}: {
  stream: Stream;
  onWentLive: (ingest: Ingest | null, devices: { cameraId: string; micId: string }) => void;
}) {
  const [tab, setTab] = useState<"camera" | "obs">("camera");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const devices = useDeviceCheck(videoRef);
  const live = useGoLive();

  const browserReady = devices.status === "ready";
  const goLiveDisabled = tab === "camera" ? !browserReady : false;

  const goLive = () =>
    live.mutate(stream.id, {
      onSuccess: (result) => {
        const chosen = { cameraId: devices.cameraId, micId: devices.micId };
        devices.release();
        onWentLive(result.ingest, chosen);
      },
    });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <p className="ws-meta mb-2">Green room</p>
      <div className="grid gap-5 lg:grid-cols-[65fr_35fr]">
        {/* Left: preview + device controls */}
        <div className="space-y-3">
          <div className="ws-inset flex gap-1 p-1">
            {(["camera", "obs"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 rounded-full py-2 text-sm font-semibold transition-colors",
                  tab === value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
                )}
              >
                {value === "camera" ? "Camera" : "OBS"}
              </button>
            ))}
          </div>

          {tab === "camera" ? (
            <>
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-full w-full object-cover [transform:scaleX(-1)]"
                />
                {devices.status !== "ready" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center">
                    <IconCamera className="h-7 w-7 text-grey-400" />
                    {devices.status === "denied" ? (
                      <>
                        <p className="text-sm text-down">Camera and microphone access was denied.</p>
                        <p className="text-xs text-grey-500">Allow access in your browser&apos;s site settings, then try again.</p>
                        <Button size="sm" variant="secondary" onClick={devices.request}>Try again</Button>
                      </>
                    ) : devices.status === "unavailable" ? (
                      <p className="text-sm text-grey-400">This browser can&apos;t access a camera — use the OBS tab.</p>
                    ) : devices.status === "requesting" ? (
                      <p className="text-sm text-grey-400">Waiting for camera permission…</p>
                    ) : (
                      <>
                        <p className="text-sm text-body">Check your camera before anyone sees you.</p>
                        <Button size="sm" onClick={devices.request}>Enable camera & mic</Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {browserReady && (
                <div className="space-y-3">
                  <MicMeter level={devices.micLevel} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={devices.cameraId}
                      onChange={(e) => devices.setCameraId(e.target.value)}
                      className={inputClass}
                      aria-label="Camera"
                    >
                      {devices.cameras.map((d) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-sheet">
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={devices.micId}
                      onChange={(e) => devices.setMicId(e.target.value)}
                      className={inputClass}
                      aria-label="Microphone"
                    >
                      {devices.mics.map((d) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-sheet">
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ws-inset space-y-2 px-4 py-6">
              <p className="text-sm font-semibold text-heading">Stream with OBS</p>
              <p className="text-sm text-grey-400">
                Your RTMP URL and stream key are issued the moment you go live — they&apos;ll appear
                here, masked and copyable. Until your encoder connects, viewers see a
                &quot;waiting for signal&quot; state.
              </p>
              <p className="text-xs text-meta">No RTMP on this deployment? Use the Camera tab instead.</p>
            </div>
          )}

          {live.isError && <InlineError error={live.error} fallback="Couldn't go live." />}
          <Button size="lg" className="w-full" disabled={goLiveDisabled} loading={live.isPending} onClick={goLive}>
            {goLiveDisabled ? "Enable your camera to go live" : "Go Live"}
          </Button>
        </div>

        {/* Right: stream card, share link, readiness */}
        <StreamInfoCard stream={stream} deviceIssue={tab === "camera" && !browserReady} titleOk={Boolean(stream.title.trim())} />
      </div>
    </div>
  );
}
