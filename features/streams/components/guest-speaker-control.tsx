"use client";

import { useCallback, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { IconCamera, IconDots, IconUser, IconVolume } from "@/components/ui/icons";
import { useGate } from "@/hooks/use-gate";
import { useStage } from "@/features/streams/hooks/use-stage";
import { guestStagePanel, type SpeakerRequestStatus } from "@/lib/stage-recovery";
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
  // killed the page on mobile. The playback token the player already refetches
  // is what carries the publish grant.
  /*
    THE GUEST'S OWN ASK, recorded where they make it and consumed once. A
    stream guest who asks and is approved while watching goes on with mic and
    camera, as before; one who arrives already approved — a reload, a remount
    — does not have their devices opened for them (lib/mic-consent.ts).
  */
  const asked = useRef(false);
  const consumeIntent = useCallback(() => {
    const intent = asked.current;
    asked.current = false;
    return intent;
  }, []);
  const publisher = useStage({ streamId: stream.id, approved, previewRef, consumeIntent });

  /**
   * On stage means PUBLISHING, not "the host said yes".
   *
   * This one line is the bug. It used to be `approved` alone, so a guest whose
   * camera was busy, whose grant never landed, or whose connection had come
   * back on a subscribe-only token was shown the on-stage panel — mic toggle,
   * camera toggle, and a "Leave stage" button — while the stage did not
   * contain them. The only route back to "Request to join" was to leave a
   * stage they were never on. See lib/stage-recovery.ts.
   */
  const onStage = approved && publisher.state === "live";

  const status: SpeakerRequestStatus | null =
    (mine.data?.status as SpeakerRequestStatus | undefined) ?? null;
  const panel = guestStagePanel({ status, state: publisher.state, error: publisher.error });
  const statusLabel =
    panel.kind === "live" ? "On stage" : status === "pending" ? "Requested" : "Join live";

  /**
   * Start over, in one tap.
   *
   * This is the sequence the reporter was performing by hand — withdraw the
   * approval that is no longer doing anything, then ask again — and doing it
   * by hand is what made the state feel stuck, because the only button that
   * began it was labelled "Leave stage" and they were not on one. `leave` is
   * still the correct call: it is the guest's own self-service resolution, and
   * it is what frees the backend to accept a new request (an open row is
   * returned rather than duplicated).
   */
  const requestId = mine.data?.id;
  const requestAgain = useCallback(() => {
    if (!requestId) return;
    resolve.mutate(
      { requestId, action: "leave" },
      {
        onSuccess: () => {
          asked.current = true;
          request.mutate();
        },
      }
    );
  }, [requestId, resolve, request]);

  const busy = resolve.isPending || request.isPending;

  return (
    <>
      {onStage ? (
        <>
          <button
            onClick={() => void publisher.toggleMic()}
            aria-label={publisher.micOn ? "Mute your microphone" : "Unmute your microphone"}
            aria-pressed={!publisher.micOn}
            className={cn(
              "ws-press flex h-11 w-11 flex-col items-center justify-center rounded-full transition-colors",
              publisher.micOn ? "bg-black/50 text-heading" : "bg-down/80 text-ink"
            )}
          >
            <IconVolume className="h-4 w-4" muted={!publisher.micOn} />
            <span className="mt-0.5 text-[8px] font-bold">
              {publisher.micOn ? "MIC" : "MUTED"}
            </span>
          </button>
          <button
            onClick={() => void publisher.toggleCam()}
            aria-label={publisher.camOn ? "Turn your camera off" : "Turn your camera on"}
            aria-pressed={!publisher.camOn}
            className={cn(
              "ws-press flex h-11 w-11 flex-col items-center justify-center rounded-full transition-colors",
              publisher.camOn ? "bg-black/50 text-heading" : "bg-down/80 text-ink"
            )}
          >
            <IconCamera className="h-4 w-4" />
            <span className="mt-0.5 text-[8px] font-bold">
              {publisher.camOn ? "CAM" : "OFF"}
            </span>
          </button>
          {/* Everything that is not mic or camera — preview, errors, and the
              way off the stage — is still one tap away. */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Stage options"
            className="ws-press flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-heading"
          >
            <IconDots className="h-5 w-5" />
          </button>
        </>
      ) : (
        /* Not publishing, whatever the row says — so this is still the JOIN
           button, and a guest whose stage attempt died lands back where they
           expect rather than on a mute toggle that controls nothing. The dot
           marks a state that needs them: approved, and not on stage. */
        <button
          onClick={() => gate(() => setOpen(true))}
          aria-label={panel.kind === "recover" ? "Rejoin the stage" : "Request to join this live"}
          className="ws-press relative flex h-11 w-11 flex-col items-center justify-center rounded-full bg-black/50 text-heading"
        >
          {panel.kind === "recover" && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-down" />
          )}
          <IconUser className="h-5 w-5" />
          <span className="mt-0.5 text-[8px] font-bold">JOIN</span>
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Join this LIVE">
        {/* The panel is decided in lib/stage-recovery.ts from two separate
            facts — what the host decided, and what this connection is actually
            doing — because conflating them is what produced the stuck state.
            The spec's terminal statuses are denied/withdrawn/removed; an
            earlier version read "declined"/"left", names the backend never
            sends, so a viewer who had been turned down could never ask again. */}
        {panel.kind === "request" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
              <IconCamera className="h-7 w-7 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-heading">Ask to speak with the host</p>
              <p className="mt-1 text-xs leading-5 text-grey-400">{panel.message}</p>
            </div>
            <Button className="w-full" loading={request.isPending} onClick={() => {
                asked.current = true;
                request.mutate();
              }}>
              Request to join
            </Button>
          </div>
        ) : panel.kind === "waiting" ? (
          <div className="space-y-4 py-4 text-center">
            <span className="mx-auto block h-3 w-3 animate-pulse rounded-full bg-accent" />
            <p className="text-sm font-semibold text-heading">Waiting for the host</p>
            <p className="text-xs text-grey-400">{panel.message}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div ref={previewRef} className="aspect-video overflow-hidden rounded-2xl bg-black">
              {panel.kind !== "live" && (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-grey-400">
                  <p>{panel.message}</p>
                </div>
              )}
            </div>
            {/* Audio-only is a SUCCESS, not a failure — say what happened and
                leave the camera toggle live so it can come up later. */}
            {publisher.audioOnly && panel.kind === "live" && (
              <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-xs text-grey-300">
                Joined with microphone only — camera unavailable.
                {publisher.error ? ` ${publisher.error}` : ""} You can turn the
                camera on once it is free.
              </p>
            )}
            <p className="text-center text-sm font-semibold text-heading">{statusLabel}</p>
            {panel.kind === "live" && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant={publisher.micOn ? "secondary" : "danger"} onClick={() => void publisher.toggleMic()}>
                  {publisher.micOn ? "Mute" : "Unmute"}
                </Button>
                <Button variant={publisher.camOn ? "secondary" : "danger"} onClick={() => void publisher.toggleCam()}>
                  {publisher.camOn ? "Camera off" : "Camera on"}
                </Button>
              </div>
            )}
            {/* Every action the panel decided on, in its order — the first is
                the one that matches the cause. Nothing here is a dead end, and
                "leave" is never the only thing on offer. */}
            {panel.actions.map((action) =>
              action === "retry" ? (
                <Button key={action} className="w-full" onClick={publisher.retry}>
                  Try camera and mic again
                </Button>
              ) : action === "rejoin" ? (
                <Button key={action} className="w-full" onClick={publisher.rejoin}>
                  Rejoin stage
                </Button>
              ) : action === "request-again" ? (
                <Button
                  key={action}
                  variant="secondary"
                  className="w-full"
                  loading={busy}
                  onClick={requestAgain}
                >
                  Ask to join again
                </Button>
              ) : action === "leave" ? (
                <Button
                  key={action}
                  variant="ghost"
                  className="w-full"
                  loading={resolve.isPending}
                  onClick={() => requestId && resolve.mutate({ requestId, action: "leave" })}
                >
                  {/* Truthful in both cases. Calling it "Leave stage" while the
                      guest is not on one is the sentence that made this bug
                      feel inescapable — you cannot leave somewhere you have
                      never been, and being told to is what made it read as
                      stuck. */}
                  {panel.kind === "live" ? "Leave stage" : "Give up my spot"}
                </Button>
              ) : null
            )}
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
          their camera or microphone may be blocked or in use by another app —
          they can rejoin from their own Join panel without you re-approving.
        </p>
      )}
      {!requests.isPending && pending.length === 0 && active.length === 0 && (
        <p className="py-2 text-center text-xs text-grey-600">No guest requests yet.</p>
      )}
    </div>
  );
}
