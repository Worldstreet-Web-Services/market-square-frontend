"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Room } from "livekit-client";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { IconVolume, IconX } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  MAX_STAGE_SLOTS,
  stageLayoutClass,
  stageTileSpanClass,
} from "@/lib/stage-layout";
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


/** What a tile decided about fit, reported up so the host can be told. */
export interface TileFitReport {
  key: string;
  identity: string;
  isScreenShare: boolean;
  /** Ours, so the cockpit's framing hint can still speak only about us. */
  isLocal: boolean;
  fit: TileFit;
  /** Fraction of the frame `cover` would discard, 0..1. */
  loss: number;
  /**
   * The source's intrinsic width/height, null until metadata lands. Reported
   * because the STAGE, not just the tile, needs it: a watch page that knows a
   * solo publisher is landscape can shape its frame to them instead of posting
   * them into a portrait hole.
   */
  sourceAspect: number | null;
}

/**
 * The letterbox fill: the same video, blown up, blurred, sunk behind the tile.
 *
 * Bars are unavoidable somewhere — a phone's full-bleed stage is 9:16 and a
 * landscape camera is not, and cropping to fit would throw away two thirds of
 * the picture. What IS avoidable is the bars being dead black, which is what
 * made the reported stage read as broken rather than as letterboxed. Filling
 * them with a defocused blow-up of the frame is what TikTok and Instagram do
 * with an off-shape source, and it costs no extra stream: LiveKit attaches one
 * track to as many elements as you like, so this is the frames we already have,
 * painted twice.
 *
 * Cameras only. A shared screen keeps black bars: blurring code and slides out
 * into the margins reads as a rendering fault, and every other product
 * (Meet, Zoom, Twitch) letterboxes a screen onto black.
 *
 * Mounted AFTER the video in DOM order and pushed behind it with z-index,
 * because the watch page reaches into the stage with `querySelector("video")`
 * for its transport controls and must keep finding the real one.
 */
function TileBackdrop({
  track,
}: {
  track: { attach: () => HTMLMediaElement; detach: (el: HTMLMediaElement) => unknown };
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const element = track.attach() as HTMLVideoElement;
    element.autoplay = true;
    element.playsInline = true;
    element.muted = true;
    element.className = "h-full w-full";
    // Always fills, whatever the shape — this element IS the fill, so it is not
    // a fit decision and never goes through `chooseFit`. Set in JS for the same
    // reason the tile's own fit is: no re-attach when the source changes shape.
    element.style.objectFit = "cover";
    mount.replaceChildren(element);
    return () => {
      track.detach(element);
      element.remove();
    };
  }, [track]);

  return (
    <div
      ref={mountRef}
      aria-hidden
      // scale-110 hides the blur's soft edge; the dim keeps the backdrop
      // subordinate to the picture it sits behind.
      className="pointer-events-none absolute inset-0 z-0 scale-110 opacity-60 blur-2xl"
    />
  );
}

function MediaTile({
  tile,
  localTile,
  onRemove,
  removing,
  compact,
  onFit,
  className,
}: {
  tile: StageTile;
  localTile?: ReactNode;
  onRemove?: (identity: string) => void;
  removing?: boolean;
  /** Strip tile: smaller chrome, no moderation control. */
  compact?: boolean;
  onFit?: (report: TileFitReport | null) => void;
  /** Grid placement from the caller — the odd tile out at three. */
  className?: string;
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
      hideVideo
        ? null
        : {
            key: tile.key,
            identity: slot.identity,
            isScreenShare: isScreen,
            isLocal: slot.isLocal,
            fit,
            loss,
            sourceAspect,
          }
    );
  }, [hideVideo, fit, loss, tile.key, slot.identity, isScreen, slot.isLocal, sourceAspect]);
  // Leaving takes the report with it. A guest who drops off the stage must stop
  // voting on its shape, and the stage's record must not grow for the length of
  // a long session.
  useEffect(() => () => report.current?.(null), []);

  // Letterbox bars are the stage GROUND, never the tile surface: bars have to
  // read as absence, not as a lighter panel drawn around the video. It stays
  // the ground under the backdrop too — the blur is translucent, and it is what
  // is showing for the frame or two before the second element paints.
  const box = cn("absolute inset-0", fit === "contain" && "bg-[#0A0A0B]", hideVideo && "hidden");
  // Only when there are bars TO fill, and never behind a screen share.
  const backdrop = fit === "contain" && !hideVideo && !isScreen && track ? track : null;

  return (
    <div ref={frameRef} className={cn(TILE, className)}>
      {useOwnAttach ? (
        <div className={box}>
          <div ref={mountRef} className="relative z-10 h-full w-full" />
          {backdrop && <TileBackdrop track={backdrop} />}
        </div>
      ) : (
        <div className={box}>
          <div className="relative z-10 h-full w-full">{localTile}</div>
          {backdrop && <TileBackdrop track={backdrop} />}
        </div>
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
        {/* Its OWN chip, not "Host · " glued to the front of the name.
            Inside one pill the role was just more of the same sentence, so it
            truncated away first on a narrow tile — the label is capped at 70%
            and the name is what the truncation ate into. A separate `shrink-0`
            pill is the thing that survives a small tile, which is correct:
            on a stage of strangers, who is running the room outranks the
            fourth character of their handle. Silver on ink, matching every
            other Host marker in the room (chat rows use the same pair). */}
        {slot.role === "host" && !isScreen && (
          <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-ink">
            Host
          </span>
        )}
        <span className="max-w-[70%] truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-[#E8EAED]">
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
        // Explicit control, NOT long-press. Long-press has no affordance —
        // nothing tells a host it exists — and on a video tile it collides with
        // the browser's own long-press menu. This button was already always
        // rendered (hover only intensifies it), so it worked on touch; what it
        // lacked was a usable target. The hit area is 44px on touch and the
        // design's 28px from `lg` up, with the visual circle unchanged.
        <button
          onClick={() => onRemove(slot.identity)}
          disabled={removing}
          aria-label={`Remove ${slot.name} from stage`}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center disabled:opacity-50 lg:right-2 lg:top-2 lg:h-7 lg:w-7"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[#E5484D] transition-colors hover:bg-[#E5484D] hover:text-white">
            <IconX className="h-3.5 w-3.5" />
          </span>
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
  onSourceAspect,
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
  /**
   * The shape of a SOLO publisher's source, so the page around the stage can
   * take that shape instead of guessing one. Null while the stage is empty, is
   * a grid of several people, or has not measured anything yet — in all three
   * cases the caller's default frame is the right one.
   */
  onSourceAspect?: (aspect: number | null) => void;
}) {
  const all = useStageSlots(room, hostIdentity);
  const slots = all.slice(0, MAX_STAGE_SLOTS);
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
        Math.abs(existing.loss - report.loss) < 0.01 &&
        // Without this the frame would never hear about a phone rotating: the
        // fit stays `contain` either side of the turn while the aspect flips.
        Math.abs((existing.sourceAspect ?? 0) - (report.sourceAspect ?? 0)) < 0.01
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
    localFit.current?.(Object.values(fits).filter((report) => report.isLocal));
  }, [fits]);

  // One person on the main stage — a solo camera, or a single shared screen —
  // is the case where the stage can honestly take the source's shape. Put two
  // people up and the shape belongs to the GRID again (lib/stage-layout), so
  // nothing is reported and the caller keeps its portrait column.
  const soloKey = primary.length === 1 ? primary[0].key : null;
  const soloAspect = soloKey ? fits[soloKey]?.sourceAspect ?? null : null;
  const announceAspect = useRef(onSourceAspect);
  useEffect(() => {
    announceAspect.current = onSourceAspect;
  }, [onSourceAspect]);
  useEffect(() => {
    announceAspect.current?.(soloAspect);
  }, [soloAspect]);
  // Leaving the stage hands the frame back, so a page that outlives this
  // component does not stay shaped to a stream that ended.
  useEffect(() => () => announceAspect.current?.(null), []);

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
              stageLayoutClass(primary.length)
            )}
          >
            {primary.map((tile, index) => (
              <MediaTile
                key={tile.key}
                tile={tile}
                className={stageTileSpanClass(primary.length, index)}
                localTile={localTile}
                onRemove={onRemoveGuest}
                removing={removing}
                // Every tile on the main stage reports, not just our own: the
                // shape a VIEWER's frame should take is the shape of whoever
                // is on it, and on the watch page that is never us.
                onFit={(report) => handleFit(report, tile.key)}
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
