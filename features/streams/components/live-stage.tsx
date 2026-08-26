"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Room } from "livekit-client";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { IconVolume, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useStageSlots } from "@/features/streams/hooks/use-stage-slots";
import {
  buildStageLayout,
  chooseFit,
  cropLoss,
  remoteAudioSlots,
  type StageSlot,
  type TileFit,
  type StageTile,
} from "@/features/streams/lib/stage";

/**
 * The stage: one tile per publisher, plus one hidden <audio> per remote audio
 * track.
 *
 * Read the two `.map(...)` calls in the JSX below as the fix. Nothing here
 * picks "the remote participant" — the tiles are a map over `slots`, and the
 * audio elements are a SEPARATE map over the audio-carrying slots. A guest with
 * a mic and no camera still gets an <audio> element; a guest with a camera and
 * no mic still gets a tile. Audio was previously a byproduct of the video
 * attach path, which is why an approved guest could be inaudible even when the
 * SFU was delivering their mic perfectly.
 */

/** Spec tokens — deliberately literal so the stage cannot drift onto page chrome. */
const TILE =
  "relative min-h-[104px] overflow-hidden rounded-[14px] border border-[#2A2A2E] bg-[#141416] md:rounded-2xl";

function layoutClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1 grid-rows-1";
  // Host + 1: vertical 50/50 on mobile (a conversation, never a PiP thumbnail),
  // horizontal 50/50 on desktop.
  if (count === 2) return "grid grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
  // 3+ is P2 territory; until then keep every tile above the 104px floor.
  if (count === 3) return "grid grid-cols-1 grid-rows-3 md:grid-cols-3 md:grid-rows-1";
  return "grid grid-cols-2 auto-rows-fr";
}

/** Spec caps the stage at 6; beyond that tiles stop being faces. */
const MAX_SLOTS = 6;

/** What a tile decided about fit, reported up so the host can be told. */
export interface TileFitReport {
  key: string;
  identity: string;
  isScreenShare: boolean;
  fit: TileFit;
  /** Fraction of the frame `cover` would discard, 0..1. */
  loss: number;
}

function MediaTile({
  tile,
  localTile,
  onRemove,
  removing,
  compact,
  onFit,
}: {
  tile: StageTile;
  localTile?: ReactNode;
  onRemove?: (identity: string) => void;
  removing?: boolean;
  /** Strip tile: smaller chrome, no moderation control. */
  compact?: boolean;
  onFit?: (report: TileFitReport | null) => void;
}) {
  const slot = tile.slot;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const track = tile.publication?.track as
    | { attach: () => HTMLMediaElement; detach: (el: HTMLMediaElement) => unknown }
    | undefined;
  const isScreen = tile.kind === "screen";
  // The caller's own preview stands in for our CAMERA only — a local screen
  // share has no such preview and must attach normally.
  const useOwnAttach = !(slot.isLocal && localTile && !isScreen);
  const hideVideo = !track || tile.publication?.isMuted === true;

  // Both inputs to the fit decision are measurements, so they live in state and
  // the decision itself stays a pure call into lib/stage.ts.
  const [sourceAspect, setSourceAspect] = useState<number | null>(null);
  const [tileAspect, setTileAspect] = useState<number | null>(null);
  const fit = chooseFit({ isScreenShare: isScreen, sourceAspect, tileAspect });
  const loss = cropLoss(sourceAspect, tileAspect);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setTileAspect(height > 0 ? width / height : null);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!useOwnAttach || !track) return;
    const mount = mountRef.current;
    if (!mount) return;
    const element = track.attach() as HTMLVideoElement;
    element.autoplay = true;
    element.playsInline = true;
    element.muted = true; // Video elements never carry audio here — see the <audio> map.
    element.className = cn(
      "h-full w-full",
      // Mirroring is a self-view convention for FACES. A mirrored screen share
      // is unreadable — the text runs backwards.
      slot.isLocal && !isScreen && "[transform:scaleX(-1)]"
    );
    // Intrinsic size is not known at attach time, and it CHANGES: a screen
    // share renegotiates when the host switches window or resizes it, and a
    // phone camera flips on rotation. `resize` is the event for both.
    const readAspect = () => {
      const { videoWidth, videoHeight } = element;
      setSourceAspect(videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : null);
    };
    element.addEventListener("loadedmetadata", readAspect);
    element.addEventListener("resize", readAspect);
    readAspect();
    mount.replaceChildren(element);
    return () => {
      element.removeEventListener("loadedmetadata", readAspect);
      element.removeEventListener("resize", readAspect);
      setSourceAspect(null);
      // Detach only OUR element: the same track may legitimately be attached
      // elsewhere (the guest's own preview sheet), and a bare detach() would
      // rip that one out too.
      track.detach(element);
      element.remove();
    };
  }, [track, useOwnAttach, slot.isLocal, isScreen]);

  // object-fit is applied to the live element rather than baked into the
  // className above, so a source that changes shape mid-call restyles instead
  // of tearing the track down and re-attaching it (which black-flashes).
  useEffect(() => {
    const video = mountRef.current?.querySelector("video");
    if (video instanceof HTMLVideoElement) video.style.objectFit = fit;
  }, [fit, track]);

  const report = useRef(onFit);
  useEffect(() => {
    report.current = onFit;
  }, [onFit]);
  useEffect(() => {
    report.current?.(
      hideVideo ? null : { key: tile.key, identity: slot.identity, isScreenShare: isScreen, fit, loss }
    );
  }, [hideVideo, fit, loss, tile.key, slot.identity, isScreen]);

  // Letterbox bars are the stage GROUND, never the tile surface: bars have to
  // read as absence, not as a lighter panel drawn around the video.
  const box = cn("absolute inset-0", fit === "contain" && "bg-[#0A0A0B]", hideVideo && "hidden");

  return (
    <div ref={frameRef} className={TILE}>
      {useOwnAttach ? (
        <div ref={mountRef} className={box} />
      ) : (
        <div className={box}>{localTile}</div>
      )}

      {/* Camera off, or approved and still bringing a device up. NEVER a black
          rectangle — a black tile is indistinguishable from a broken one. */}
      {hideVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
          <Avatar name={slot.name} seed={slot.identity} size={compact ? 32 : 56} />
          {!compact && (
            <p className="max-w-full truncate text-xs font-semibold text-[#E8EAED]">{slot.name}</p>
          )}
          {compact ? null : slot.state === "approved-pending" ? (
            <span className="flex items-center gap-1.5 text-[11px] text-[#8B8F96]">
              <Spinner className="h-3 w-3" />
              joining the stage…
            </span>
          ) : (
            <span className="text-[11px] text-[#8B8F96]">Camera off</span>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span className="max-w-[70%] truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-[#E8EAED]">
          {slot.role === "host" && !isScreen ? "Host · " : ""}
          {tile.label}
        </span>
        {slot.isMuted && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[#8B8F96]"
            aria-label={`${slot.name} is muted`}
          >
            <IconVolume className="h-3 w-3" muted />
          </span>
        )}
      </div>

      {onRemove && !compact && !isScreen && slot.role === "guest" && (
        <button
          onClick={() => onRemove(slot.identity)}
          disabled={removing}
          aria-label={`Remove ${slot.name} from stage`}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[#E5484D] transition-colors hover:bg-[#E5484D] hover:text-white disabled:opacity-50"
        >
          <IconX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * One hidden <audio> per remote audio track.
 *
 * Its own component, mounted from its own map, so that audio can never again
 * become conditional on a video element existing.
 */
function RemoteAudio({ slot }: { slot: StageSlot }) {
  const track = slot.audioTrack?.track as
    | { attach: () => HTMLMediaElement; detach: (el: HTMLMediaElement) => unknown }
    | undefined;
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!track) return;
    const mount = mountRef.current;
    if (!mount) return;
    const element = track.attach();
    element.autoplay = true;
    element.muted = false;
    element.volume = 1;
    element.style.display = "none";
    mount.replaceChildren(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track]);

  return <div ref={mountRef} className="hidden" aria-hidden />;
}

export function LiveStage({
  room,
  hostIdentity,
  localTile,
  onRemoveGuest,
  removing,
  className,
  emptyState,
  onStageChange,
  onLocalFit,
}: {
  room: Room | null;
  /** The stream's ownerId — LiveKit identities are user ids here. */
  hostIdentity: string;
  /** Slot content for our own tile when the caller already owns the preview. */
  localTile?: ReactNode;
  /** Host moderation: resolve the speaker request with `remove`. */
  onRemoveGuest?: (identity: string) => void;
  removing?: boolean;
  className?: string;
  /** Rendered when nobody is publishing yet. */
  emptyState?: ReactNode;
  /** Fires whenever the slot list changes — lets a caller narrate the stage. */
  onStageChange?: (slots: StageSlot[]) => void;
  /**
   * How OUR OWN published video is being fitted on this stage. The host has no
   * other way to learn that viewers are seeing bars, or missing the edges.
   */
  onLocalFit?: (reports: TileFitReport[]) => void;
}) {
  const all = useStageSlots(room, hostIdentity);
  const slots = all.slice(0, MAX_SLOTS);
  const audio = remoteAudioSlots(all);
  // Screens take the stage; faces drop to a strip. With nobody sharing this is
  // exactly the previous behaviour — cameras in the grid, no strip.
  const { primary, secondary, screenSharing } = buildStageLayout(slots);

  const notify = useRef(onStageChange);
  useEffect(() => {
    notify.current = onStageChange;
  }, [onStageChange]);
  useEffect(() => {
    notify.current?.(all);
  }, [all]);

  // Fit reports for our own tiles, keyed by tile so a screen and a camera can
  // each report independently.
  const [fits, setFits] = useState<Record<string, TileFitReport>>({});
  const handleFit = useCallback((report: TileFitReport | null, key: string) => {
    setFits((previous) => {
      if (!report) {
        if (!(key in previous)) return previous;
        const next = { ...previous };
        delete next[key];
        return next;
      }
      const existing = previous[key];
      if (
        existing &&
        existing.fit === report.fit &&
        existing.isScreenShare === report.isScreenShare &&
        Math.abs(existing.loss - report.loss) < 0.01
      ) {
        return previous;
      }
      return { ...previous, [key]: report };
    });
  }, []);
  const localFit = useRef(onLocalFit);
  useEffect(() => {
    localFit.current = onLocalFit;
  }, [onLocalFit]);
  useEffect(() => {
    localFit.current?.(Object.values(fits));
  }, [fits]);

  const [audioBlocked, setAudioBlocked] = useState(false);
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let off: (() => void) | undefined;
    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      const sync = () => setAudioBlocked(!room.canPlaybackAudio);
      room.on(RoomEvent.AudioPlaybackStatusChanged, sync);
      off = () => room.off(RoomEvent.AudioPlaybackStatusChanged, sync);
      sync();
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [room]);

  // Must run inside a real click handler: that gesture is what lifts the
  // browser's autoplay block for the rest of the session. Without it a host
  // can have every audio element attached and still hear nothing.
  const startAudio = useCallback(() => {
    void room
      ?.startAudio()
      .then(() => setAudioBlocked(false))
      .catch(() => {});
  }, [room]);

  return (
    <div className={cn("relative h-full w-full bg-[#0A0A0B]", className)}>
      {slots.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center">{emptyState}</div>
      ) : (
        <div
          className={cn(
            "flex h-full w-full gap-0.5 p-0.5",
            // Faces sit under the screen on a portrait phone and beside it once
            // there is width; without a share the strip is absent entirely.
            screenSharing ? "flex-col lg:flex-row" : "flex-col"
          )}
        >
          <div
            className={cn(
              "min-h-0 min-w-0 flex-1 gap-0.5",
              layoutClass(primary.length)
            )}
          >
            {primary.map((tile) => (
              <MediaTile
                key={tile.key}
                tile={tile}
                localTile={localTile}
                onRemove={onRemoveGuest}
                removing={removing}
                onFit={
                  tile.slot.isLocal
                    ? (report) => handleFit(report, tile.key)
                    : undefined
                }
              />
            ))}
          </div>

          {/* The camera strip. Every participant keeps a face here while a
              screen is up — including the person sharing it. */}
          {secondary.length > 0 && (
            <div
              className={cn(
                "flex shrink-0 gap-0.5 overflow-auto",
                "h-[92px] w-full flex-row lg:h-full lg:w-[180px] lg:flex-col"
              )}
            >
              {secondary.map((tile) => (
                <div
                  key={tile.key}
                  className="aspect-video h-full shrink-0 lg:h-auto lg:w-full"
                >
                  <MediaTile tile={tile} localTile={localTile} compact />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Independent of the tiles above, and of whether anyone has video. */}
      {audio.map((slot) => (
        <RemoteAudio key={`audio-${slot.identity}`} slot={slot} />
      ))}

      {audioBlocked && (
        <button
          onClick={startAudio}
          className="ws-glass absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-[#E8EAED]"
        >
          <IconVolume className="h-4 w-4" />
          Tap to turn on sound
        </button>
      )}
    </div>
  );
}
