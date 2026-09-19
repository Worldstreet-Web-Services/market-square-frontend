"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ChecklistRow, MicMeter } from "@/components/ui/mic-meter";
import { CopyRow } from "@/features/houses/components/copy-row";
import { useDeviceCheck } from "@/features/streams/hooks/use-device-check";
import { useGoLive, useUpdateStream } from "@/features/streams/hooks/use-streams";
import type { Ingest, Stream } from "@/features/streams/lib/types";
import {
  NOTE_MAX,
  TOPIC_MAX,
  TOPIC_WARN,
  clampNote,
  clampTopic,
  houseShareUrl,
  isValidTopic,
} from "@/features/houses/lib/house";
import { cn } from "@/lib/cn";
import { useRoomSession } from "@/lib/room-session-store";
import { backstageOpenStep } from "@/lib/room-session/backstage";
import { sq } from "@/lib/square-path";

const inputClass =
  "ws-inset w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-grey-600";

/**
 * Backstage: the host's soundcheck, before anybody can hear them.
 *
 * A full column rather than a sheet, and it happens on `/gist-rooms/[id]` rather
 * than in the studio. A house never routes to `/studio/[id]`: that screen is a
 * video cockpit — camera picker, self-view, stage tiles — and sending a host
 * there to open an audio room would put a camera preview in front of somebody
 * the product has just promised there is no camera for.
 *
 * `useDeviceCheck({ audioOnly: true })` calls getUserMedia with no `video` key
 * at all, so the browser never raises a camera permission prompt on this
 * screen. That matters more than it looks: a permission dialog naming a device
 * contradicts "no camera, ever" louder than any copy can repair.
 */
export function Backstage({
  stream,
  onOpened,
}: {
  stream: Stream;
  onOpened: (ingest: Ingest, micId: string) => void;
}) {
  const [topic, setTopic] = useState(stream.title);
  const [note, setNote] = useState(stream.description ?? "");
  const devices = useDeviceCheck(null, { audioOnly: true });
  const goLive = useGoLive();
  const update = useUpdateStream(stream.id);
  const router = useRouter();
  const session = useRoomSession();
  /** The tab still holds another room: asked BEFORE this one goes live. */
  const [askSwitch, setAskSwitch] = useState(false);
  const [vacating, setVacating] = useState(false);
  const hostingOther = session.state.target?.role === "host";

  const micReady = devices.status === "ready";
  const topicOk = isValidTopic(topic);
  const shareUrl =
    typeof window === "undefined" ? "" : houseShareUrl(window.location.origin, stream.id);

  const openNow = () => {
    const trimmed = topic.trim();
    // Save the topic first when it changed: the room is ABOUT something, and
    // opening with a stale title is opening the wrong house.
    if (trimmed !== stream.title) update.mutate({ title: trimmed });
    if (note.trim() !== (stream.description ?? "")) update.mutate({ description: note.trim() });
    /*
      THE FRESH OPEN GOES STRAIGHT TO THE SESSION. go-live's own cache write
      flips this room to "live", and HouseRoom re-renders into the top-level
      room view — unmounting this Backstage and HostScheduled with it. The
      ingest used to reach the session only through HostScheduled's state, so
      on some timings it was dropped: the host entered with no token, go-live
      ran a second time, and the mic came up MUTED. A per-call `mutate`
      onSuccess is dropped too once its observer unmounts; the promise is not,
      and it settles before the cache notification renders anything.
    */
    goLive
      .mutateAsync(stream.id)
      .then((result) => {
        // The contract types `ingest` as nullable. It is never null for a
        // browser publish — but asserting that here is how a null reaches
        // the publisher and the room opens with nobody able to hear the host.
        if (!result.ingest?.url || !result.ingest.roomToken) return;
        const micId = devices.micId;
        // Let go BEFORE the publisher opens its own capture: two live captures
        // of one microphone let the second inherit constraints negotiated for
        // the first, which is how a soundcheck can sound different from the
        // broadcast.
        devices.release();
        session.enter(stream.id, "host", {
          token: { url: result.ingest.url, token: result.ingest.roomToken },
          fresh: true,
          preferredMic: micId || undefined,
        });
        onOpened(result.ingest, micId);
      })
      .catch(() => {
        // useGoLive has already said why.
      });
  };

  /*
    GO-LIVE WAITS FOR THE ANSWER. It used to run first and let the session ask
    "leave your other room?" afterwards — by which point this room was already
    live, and "Stay there" left it live with no host (lib/room-session/backstage.ts).
  */
  const open = () => {
    if (backstageOpenStep(session.state, stream.id) === "ask") {
      setAskSwitch(true);
      return;
    }
    openNow();
  };

  /** Leave (or, for its host, CLOSE) the room the tab holds — then open this one. */
  const leaveAndOpen = async () => {
    setVacating(true);
    try {
      await session.vacate();
    } catch {
      // The close failed and was toasted; the host is still in their room,
      // and this one has not gone live.
      setVacating(false);
      return;
    }
    setVacating(false);
    setAskSwitch(false);
    openNow();
  };

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-4">
      <h1 className="ws-meta">Backstage</h1>

      <label className="mt-4 block">
        <span className="sr-only">Topic</span>
        <input
          value={topic}
          onChange={(event) => setTopic(clampTopic(event.target.value))}
          maxLength={TOPIC_MAX}
          placeholder="What is this gist room about?"
          className={inputClass}
          aria-label="Topic"
        />
      </label>
      <p
        className={cn(
          "tnum mt-1 text-right text-[11px]",
          // Brightens rather than reddening. --color-down means "this value
          // went down" and nothing else; a character count approaching a cap
          // is not a value delta, and the monochrome answer to emphasis is the
          // silver ramp.
          topic.length > TOPIC_WARN ? "font-semibold text-heading" : "text-meta"
        )}
      >
        {topic.length}/{TOPIC_MAX}
      </p>

      <div className="mt-5">
        <p className="ws-meta mb-2">Microphone</p>
        <MicMeter level={devices.micLevel} />
        {devices.status !== "ready" && (
          <div className="mt-2 flex items-center gap-3">
            <p className="min-w-0 flex-1 text-[12px] leading-4 text-meta">
              {devices.status === "denied"
                ? "Microphone access is blocked. Allow it in your browser settings, then try again."
                : devices.status === "unavailable"
                  ? "No microphone found. Connect one and try again."
                  : devices.status === "requesting"
                    ? "Waiting for your microphone…"
                    : "Nobody can hear a gist room you opened without checking this first."}
            </p>
            {devices.status !== "requesting" && (
              <Button size="sm" variant="secondary" onClick={devices.request}>
                {devices.status === "idle" ? "Check my mic" : "Try again"}
              </Button>
            )}
          </div>
        )}
        {devices.mics.length > 0 && (
          <select
            value={devices.micId}
            onChange={(event) => devices.setMicId(event.target.value)}
            aria-label="Microphone"
            className={cn(inputClass, "mt-2")}
          >
            {devices.mics.map((mic) => (
              <option key={mic.deviceId} value={mic.deviceId} className="bg-sheet">
                {mic.label}
              </option>
            ))}
          </select>
        )}
        {/* No camera select. No video element. There is nothing on this screen
            that could acquire a camera even if somebody wanted one. */}
      </div>

      <label className="mt-5 block">
        <span className="ws-meta mb-2 block">Pinned note (optional)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(clampNote(event.target.value))}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="A link or a line people should see. This is what a gist room has instead of a shared screen."
          className={inputClass}
        />
      </label>

      <div className="mt-5">
        <CopyRow label="Share this house" url={shareUrl} />
      </div>

      <ul className="mt-5 space-y-1.5">
        <ChecklistRow ok={micReady} label="Microphone ready" />
        <ChecklistRow ok={topicOk} label="Topic set" />
      </ul>

      <Button
        size="lg"
        className="mt-5 w-full"
        loading={goLive.isPending}
        disabled={!micReady || !topicOk}
        onClick={open}
      >
        {/* A disabled button names its own reason: a control that will not fire
            and will not say why is the thing people file bugs about. */}
        {!micReady ? "Waiting for your microphone" : !topicOk ? "Add a topic first" : "Open the gist room"}
      </Button>

      <p className="mt-3 text-center text-[12px] leading-5 text-meta">
        <span className="font-semibold text-body">No camera, ever.</span> Houses are voice only —
        for you and for everyone who joins.
      </p>

      {/* One room per tab. Nothing has gone live yet: staying leaves this room
          exactly as it was. */}
      <Sheet
        open={askSwitch}
        onClose={() => {
          if (!vacating) setAskSwitch(false);
        }}
        title={hostingOther ? "Close your gist room?" : "Leave your gist room?"}
      >
        <p className="text-[13px] leading-5 text-body">
          {hostingOther
            ? "You're hosting another gist room. Opening this one will close it for everyone."
            : "You're in another gist room. Opening this one will leave it."}
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            disabled={vacating}
            onClick={() => {
              const current = session.state.target?.streamId;
              setAskSwitch(false);
              if (current) router.push(sq(`/gist-rooms/${current}`));
            }}
          >
            Stay there
          </Button>
          <Button className="flex-1" loading={vacating} onClick={() => void leaveAndOpen()}>
            {hostingOther ? "Close and open" : "Leave and open"}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
