"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Participant, Room } from "livekit-client";
import { LEVEL_INTERVAL_MS, smooth } from "@/features/houses/lib/audio-levels";

/**
 * Who is talking, and how loudly — at 10Hz, without repainting the room.
 *
 * The naive version is a `useState<Record<identity, number>>` in the room
 * component. It works, and it re-renders the header, the eight seats, the
 * talking line, the pinned row and every face in the audience ten times a
 * second for a number that four of those elements do not read. On a phone with
 * two hundred people in the band that is the difference between a room and a
 * space heater.
 *
 * So levels live in a store outside React and each `<SeatMeter identity>`
 * subscribes to its OWN identity through `useSyncExternalStore`. A seat
 * re-renders when its own level moves; nothing else re-renders at all.
 *
 * `loudest` is separate and changes on human timescales (a turn in a
 * conversation), so it is ordinary state.
 */

interface LevelStore {
  get: (identity: string) => number;
  subscribe: (identity: string, listener: () => void) => () => void;
  set: (levels: Map<string, number>) => void;
}

function createLevelStore(): LevelStore {
  const levels = new Map<string, number>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    get: (identity) => levels.get(identity) ?? 0,
    subscribe: (identity, listener) => {
      let set = listeners.get(identity);
      if (!set) {
        set = new Set();
        listeners.set(identity, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(identity);
      };
    },
    set: (next) => {
      // Notify only the identities whose value actually MOVED. A tick where
      // nobody is talking touches nothing, which is the common case in a room
      // where one person holds the floor and eleven listen.
      for (const [identity, value] of next) {
        if (levels.get(identity) === value) continue;
        levels.set(identity, value);
        listeners.get(identity)?.forEach((listener) => listener());
      }
      for (const identity of levels.keys()) {
        if (next.has(identity)) continue;
        levels.delete(identity);
        listeners.get(identity)?.forEach((listener) => listener());
      }
    },
  };
}

export interface HouseAudio {
  /** Subscribe one seat to one identity. See `useSeatLevel` below. */
  store: LevelStore;
  /** The loudest voice right now, or null in silence. LiveKit's own ordering. */
  loudest: string | null;
  /** Identities heard within RECENT_SPEAKER_MS — the audience's SPOKE RECENTLY band. */
  recentSpeakers: ReadonlySet<string>;
}

/** How long "spoke recently" lasts. Two minutes: long enough to still be why you looked. */
export const RECENT_SPEAKER_MS = 120_000;

export function useHouseAudio(room: Room | null): HouseAudio {
  // A useState initialiser rather than a lazily-filled ref: the store is
  // created once and never replaced, which is exactly what state with no
  // setter is for, and reading a ref during render is not allowed.
  const [store] = useState(createLevelStore);

  const [loudest, setLoudest] = useState<string | null>(null);
  const [recentSpeakers, setRecentSpeakers] = useState<ReadonlySet<string>>(() => new Set());
  const heardAt = useRef(new Map<string, number>());

  // The level pump. Deliberately setInterval, not requestAnimationFrame — see
  // LEVEL_INTERVAL_MS in lib/audio-levels.ts for why a long-lived room must not
  // hold the compositor awake.
  useEffect(() => {
    if (!room) return;
    const previous = new Map<string, number>();
    const tick = () => {
      const next = new Map<string, number>();
      const everyone: Participant[] = [
        room.localParticipant,
        ...room.remoteParticipants.values(),
      ];
      for (const participant of everyone) {
        // Only publishers have a level worth reading; a listener's audioLevel
        // is 0 forever and keeping it in the map costs a notification per tick.
        if (participant.permissions?.canPublish !== true) continue;
        const raw = typeof participant.audioLevel === "number" ? participant.audioLevel : 0;
        const level = smooth(previous.get(participant.identity) ?? 0, raw, participant.isSpeaking);
        previous.set(participant.identity, level);
        next.set(participant.identity, level);
      }
      for (const identity of previous.keys()) {
        if (!next.has(identity)) previous.delete(identity);
      }
      store.set(next);
    };
    const timer = setInterval(tick, LEVEL_INTERVAL_MS);
    tick();
    return () => {
      clearInterval(timer);
      store.set(new Map());
    };
  }, [room, store]);

  // `loudest` comes from the SFU, which already orders ActiveSpeakersChanged
  // loudest-first — so it is `[0]`, not a sort of our own smoothed numbers. The
  // server's ordering is authoritative, free, and computed from the actual
  // audio rather than from a 10Hz sample of it.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let off: (() => void) | undefined;
    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      const onSpeakers = (speakers: Participant[]) => {
        setLoudest(speakers[0]?.identity ?? null);
        if (speakers.length === 0) return;
        const now = Date.now();
        for (const speaker of speakers) heardAt.current.set(speaker.identity, now);
      };
      room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      off = () => room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    });
    return () => {
      cancelled = true;
      off?.();
      setLoudest(null);
    };
  }, [room]);

  // The recency band is recomputed on a slow clock rather than on every
  // speaker change: it decides which HEADER a face sits under, and a face that
  // hops between bands mid-scroll is worse than one that is a few seconds
  // stale.
  useEffect(() => {
    if (!room) return;
    const sweep = () => {
      const now = Date.now();
      const fresh = new Set<string>();
      for (const [identity, at] of heardAt.current) {
        if (now - at <= RECENT_SPEAKER_MS) fresh.add(identity);
        else heardAt.current.delete(identity);
      }
      setRecentSpeakers((current) =>
        current.size === fresh.size && [...fresh].every((id) => current.has(id)) ? current : fresh
      );
    };
    const timer = setInterval(sweep, 5_000);
    return () => clearInterval(timer);
  }, [room]);

  return { store, loudest, recentSpeakers };
}

/** One seat, one identity, one subscription. Nothing else re-renders on a tick. */
export function useSeatLevel(audio: HouseAudio, identity: string | null): number {
  const subscribe = useCallback(
    (listener: () => void) => (identity ? audio.store.subscribe(identity, listener) : () => {}),
    [audio, identity]
  );
  const snapshot = useCallback(
    () => (identity ? audio.store.get(identity) : 0),
    [audio, identity]
  );
  // Server snapshot is a constant 0: there is no audio during a server render,
  // and returning anything else would make the first client paint disagree.
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}
