"use client";

import { useEffect, useRef, useState } from "react";
import type { Participant, RemoteTrack, Room } from "livekit-client";
import { fetchPreviewToken } from "@/features/streams/lib/api";
import { registerRoom, unregisterRoom } from "@/features/streams/lib/live-room";
import { errorCode } from "@/lib/api/envelope";

/**
 * LISTEN TO A GIST ROOM FROM ITS CARD — the `unmute` on 415:12704.
 *
 * `POST /streams/:id/preview-token` mints a subscribe-only grant on a
 * `preview-<uuid>` identity that the roster never sees, so this is the ONE
 * place a second LiveKit Room for a stream is legitimate: it cannot collide
 * with the reader's real connection. It is still registered, under its own
 * key, so two cards for one room on one page cannot open two previews.
 *
 * ─── NEVER A HEARTBEAT ───────────────────────────────────────────────────────
 * `sendHeartbeat` is deliberately not imported. Heartbeats feed viewerCount,
 * participants and watch time; a card previewing a room would count itself as
 * audience, and every number on the page would drift up by one per hover.
 *
 * ─── AUDIO ONLY, SUBSCRIBE ONLY, GONE ON LEAVE ───────────────────────────────
 * The connect path is the player's (`livekit-player.tsx`), subscribe side
 * only: no publishing, no video — a video track that arrives is left
 * unattached — and every audio track is attached to a detached `<audio>`
 * that is torn down with the room. `active` false (mouse leave, unmount,
 * mute) disconnects at once.
 *
 * The grant lives 120s. If the pointer lingers past it, a new one is minted
 * and the room reconnected — the card never holds a lapsed token.
 *
 * ─── WHAT A REFUSAL MEANS ────────────────────────────────────────────────────
 *   404 — unknown, or private and the reader is not a member: quiet, with
 *         the reason. 409 — not a gist room, not live, or no media room yet:
 *         quiet, with the reason. 429 — throttled: back off for a while rather
 *         than hammering. Anything else — failed, named.
 */
export type RoomPreview = {
  state: "idle" | "connecting" | "listening" | "quiet" | "backoff" | "failed";
  /** Why the control is quiet or failed — shown on it, never swallowed. */
  reason: string | null;
  /** The SFU's loudest active speaker, resolved through `nameOf`; null in silence. */
  speaker: string | null;
};

/** How long a 429 keeps the control off before another press may try. */
export const PREVIEW_BACKOFF_MS = 30_000;
/** Re-mint this far before `expiresAt`, so a lingering pointer never hears the grant lapse. */
const RENEW_EARLY_MS = 10_000;

const REASONS: Record<string, string> = {
  NOT_FOUND: "This room can't be previewed",
  CONFLICT: "No audio to preview yet",
  RATE_LIMITED: "Too many previews — try again shortly",
};

/** What the connection has settled to. "connecting" is derived: active with nothing settled yet. */
type Settled = "idle" | "listening" | "quiet" | "backoff" | "failed";

export function useRoomPreview(
  streamId: string,
  active: boolean,
  /** Resolves a participant to a display name — the house room's own rule, handed in so this slice need not read another's. */
  nameOf: (participant: Participant) => string | null
): RoomPreview {
  // Every transition below happens in a callback (a resolved fetch, an SDK
  // event, a timer, the cleanup) — never synchronously inside the effect.
  const [settled, setSettled] = useState<Settled>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const backoffUntil = useRef(0);
  const nameRef = useRef(nameOf);
  useEffect(() => {
    nameRef.current = nameOf;
  }, [nameOf]);

  useEffect(() => {
    if (!active) return;
    if (Date.now() < backoffUntil.current) {
      // Inside the 429 window: `settled` is still "backoff" from the refusal.
      // Try again once it closes, if the pointer is still here.
      const retry = setTimeout(() => {
        setSettled("idle");
        setAttempt((n) => n + 1);
      }, backoffUntil.current - Date.now());
      return () => clearTimeout(retry);
    }

    let cancelled = false;
    let room: Room | null = null;
    let renew: ReturnType<typeof setTimeout> | undefined;
    const elements = new Set<HTMLMediaElement>();
    const key = `${streamId}#preview`;

    void (async () => {
      let grant: Awaited<ReturnType<typeof fetchPreviewToken>>;
      try {
        grant = await fetchPreviewToken(streamId);
      } catch (error) {
        if (cancelled) return;
        const code = errorCode(error);
        if (code === "RATE_LIMITED") {
          backoffUntil.current = Date.now() + PREVIEW_BACKOFF_MS;
          setSettled("backoff");
        } else {
          setSettled(code === "NOT_FOUND" || code === "CONFLICT" ? "quiet" : "failed");
        }
        setReason(REASONS[code ?? ""] ?? "Couldn't start the preview");
        return;
      }
      if (cancelled) return;

      const { Room, RoomEvent, Track } = await import("livekit-client");
      if (cancelled) return;
      const instance = new Room({ adaptiveStream: false });
      try {
        registerRoom(key, instance);
      } catch {
        setSettled("failed");
        setReason("This room is already being previewed");
        return;
      }
      room = instance;

      const onTrack = (track: RemoteTrack) => {
        // Subscribe side only, and only what can be heard.
        if (track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        elements.add(element);
      };
      const onSpeakers = (speakers: Participant[]) => {
        setSpeaker(speakers[0] ? nameRef.current(speakers[0]) : null);
      };
      instance
        .on(RoomEvent.TrackSubscribed, onTrack)
        .on(RoomEvent.ActiveSpeakersChanged, onSpeakers)
        .on(RoomEvent.Disconnected, () => {
          if (!cancelled) {
            setSettled("failed");
            setReason("The preview dropped");
          }
        });

      try {
        await instance.connect(grant.url, grant.token, { autoSubscribe: true });
        if (cancelled) return;
        // The press on `unmute` is the gesture the autoplay policy wants.
        await instance.startAudio().catch(() => undefined);
        setReason(null);
        setSettled("listening");
        // A fresh grant before this one lapses: tear down and re-run.
        const msLeft = Date.parse(grant.expiresAt) - Date.now() - RENEW_EARLY_MS;
        renew = setTimeout(() => setAttempt((n) => n + 1), Math.max(msLeft, 5_000));
      } catch {
        if (!cancelled) {
          setSettled("failed");
          setReason("Couldn't reach the room");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renew) clearTimeout(renew);
      for (const element of elements) {
        element.pause();
        element.remove();
      }
      elements.clear();
      if (room) {
        unregisterRoom(key, room);
        void room.disconnect();
      }
      setSpeaker(null);
      // A refusal is remembered only through its backoff window; everything
      // else starts over on the next press.
      setSettled((current) => (current === "backoff" ? current : "idle"));
    };
  }, [streamId, active, attempt]);

  const state: RoomPreview["state"] = !active ? "idle" : settled === "idle" ? "connecting" : settled;
  return { state, reason, speaker };
}
