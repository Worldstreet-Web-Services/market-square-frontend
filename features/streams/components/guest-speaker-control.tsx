"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { IconCamera, IconUser } from "@/components/ui/icons";
import { useGate } from "@/hooks/use-gate";
import { STAGE_FAILURES, useStage } from "@/features/streams/hooks/use-stage";
import {
  useMySpeakerRequest,
  useRequestToSpeak,
  useResolveSpeakerRequest,
  useSpeakerRequests,
} from "@/features/streams/hooks/use-streams";
import type { Stream } from "@/features/streams/lib/types";

export function GuestSpeakerControl({ stream }: { stream: Stream }) {
  const gate = useGate();
  const [open, setOpen] = useState(false);
  const request = useRequestToSpeak(stream.id);
  const mine = useMySpeakerRequest(stream.id, stream.status === "live");
  const resolve = useResolveSpeakerRequest(stream.id);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const approved = mine.data?.status === "approved";
  // No second connection: an approved guest is upgraded on the room they are
  // already watching from. `joinUrl`/`joinToken` are deliberately unused — a
  // speaker token carries the same LiveKit identity as the playback token, so
  // connecting with it evicts the viewer and starts the reconnect loop that
  // killed the page on mobile.
  const publisher = useStage({ streamId: stream.id, approved, previewRef });

  const statusLabel = approved ? "On stage" : mine.data?.status === "pending" ? "Requested" : "Join live";

  // One message and one remedy per failure class. These used to be a single
  // "Allow camera and microphone access", which was actively misleading for
  // every case except a real permission refusal — the reported bug was a busy
  // device, where no permission prompt will ever appear.
  const failed = STAGE_FAILURES.includes(publisher.state);
  const stageMessage =
    publisher.state === "not-permitted"
      ? (publisher.error ?? "The host hasn't finished bringing you on stage yet.")
      : publisher.state === "waiting-for-room"
        ? "Connecting to the stream…"
        : publisher.state === "denied"
      ? "Allow camera and microphone access to join."
        : publisher.state === "device-busy"
          ? "Your camera or microphone is in use by another app or browser tab. Close it and try again."
          : publisher.state === "device-missing"
            ? "No camera or microphone found. Connect one, or check another app is not holding it, then try again."
            : publisher.state === "failed"
              ? (publisher.error ?? "Couldn't put you on stage.")
              : "Putting you on stage…";

  return (
    <>
      <button
        onClick={() => gate(() => setOpen(true))}
        aria-label="Request to join this live"
        className="ws-press flex h-11 w-11 flex-col items-center justify-center rounded-full bg-black/50 text-heading"
      >
        <IconUser className="h-5 w-5" />
        <span className="mt-0.5 text-[8px] font-bold">JOIN</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Join this LIVE">
        {/* The spec's terminal states are denied/withdrawn/removed. This read
            "declined"/"left" — names the backend never sends — so a viewer who
            had been denied or had stepped down could never ask again. */}
        {!mine.data || ["denied", "withdrawn", "removed"].includes(mine.data.status) ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
              <IconCamera className="h-7 w-7 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-heading">Ask to speak with the host</p>
              <p className="mt-1 text-xs leading-5 text-grey-400">The host can bring you on stage. Your camera and microphone only start after approval.</p>
            </div>
            <Button className="w-full" loading={request.isPending} onClick={() => request.mutate()}>
              Request to join
            </Button>
          </div>
        ) : mine.data.status === "pending" ? (
          <div className="space-y-4 py-4 text-center">
            <span className="mx-auto block h-3 w-3 animate-pulse rounded-full bg-accent" />
            <p className="text-sm font-semibold text-heading">Waiting for the host</p>
            <p className="text-xs text-grey-400">You can keep watching. This panel updates automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div ref={previewRef} className="aspect-video overflow-hidden rounded-2xl bg-black">
              {publisher.state !== "live" && (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-grey-400">
                  <p>{stageMessage}</p>
                  {/* Every terminal state gets a way out. Without this the panel
                      was a dead end: no failure, no retry, just a spinner. */}
                  {failed && (
                    <Button size="sm" variant="secondary" onClick={publisher.retry}>
                      Retry
                    </Button>
                  )}
                </div>
              )}
            </div>
            {/* Audio-only is a SUCCESS, not a failure — say what happened and
                leave the camera toggle live so it can come up later. */}
            {publisher.audioOnly && publisher.state === "live" && (
              <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-xs text-grey-300">
                Joined with microphone only — camera unavailable.
                {publisher.error ? ` ${publisher.error}` : ""} You can turn the
                camera on once it is free.
              </p>
            )}
            <p className="text-center text-sm font-semibold text-heading">{statusLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={publisher.micOn ? "secondary" : "danger"} onClick={() => void publisher.toggleMic()}>
                {publisher.micOn ? "Mute" : "Unmute"}
              </Button>
              <Button variant={publisher.camOn ? "secondary" : "danger"} onClick={() => void publisher.toggleCam()}>
                {publisher.camOn ? "Camera off" : "Camera on"}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              loading={resolve.isPending}
              onClick={() => resolve.mutate({ requestId: mine.data!.id, action: "leave" })}
            >
              Leave stage
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}

export function SpeakerRequestQueue({ stream }: { stream: Stream }) {
  const requests = useSpeakerRequests(stream.id, stream.status === "live");
  const resolve = useResolveSpeakerRequest(stream.id);
  const pending = requests.data?.items.filter((item) => item.status === "pending") ?? [];
  const active = requests.data?.items.filter((item) => item.status === "approved") ?? [];

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-grey-300">Guest speakers</p>
        {pending.length > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-ink">{pending.length} waiting</span>}
      </div>
      {pending.map((item) => (
        <div key={item.id} className="ws-inset flex items-center gap-2 p-2">
          <Avatar name={item.profile?.displayName ?? "Viewer"} seed={item.userId} src={item.profile?.avatarUrl} size={32} />
          <span className="min-w-0 flex-1 truncate text-xs text-heading">{item.profile?.displayName ?? "Viewer"}</span>
          <Button size="sm" onClick={() => resolve.mutate({ requestId: item.id, action: "approve" })}>Accept</Button>
          <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ requestId: item.id, action: "decline" })}>Decline</Button>
        </div>
      ))}
      {/* "is on stage" asserted something we cannot observe. `approved` is a
          decision the host made; whether the guest's browser actually got its
          camera and connected is not in this payload, and a guest whose device
          is busy can sit at "approved" forever while the host sees a confident
          green dot. Until real presence is wired (see note below), say only
          what is true — and warn the host that silence may be the guest's end. */}
      {active.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="min-w-0 flex-1 truncate text-xs text-grey-300">
            {item.profile?.displayName ?? "Guest"} · approved
          </span>
          <button className="text-[11px] text-down" onClick={() => resolve.mutate({ requestId: item.id, action: "remove" })}>Remove</button>
        </div>
      ))}
      {active.length > 0 && (
        <p className="text-[11px] leading-4 text-grey-600">
          Approved guests may still be connecting. If you cannot hear someone,
          their camera or microphone may be blocked or in use by another app.
        </p>
      )}
      {!requests.isPending && pending.length === 0 && active.length === 0 && (
        <p className="py-2 text-center text-xs text-grey-600">No guest requests yet.</p>
      )}
    </div>
  );
}
