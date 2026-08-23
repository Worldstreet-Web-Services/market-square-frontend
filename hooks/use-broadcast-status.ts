"use client";

import { useSyncExternalStore } from "react";

// Tiny module-level signal (not a store library): the studio's browser
// broadcaster flips it while publishing so the shell can show a persistent
// "You're live" indicator and navigation guards know a camera is on air.

interface BroadcastStatus {
  live: boolean;
  streamId: string | null;
}

let status: BroadcastStatus = { live: false, streamId: null };
const listeners = new Set<() => void>();

export function setBroadcastLive(streamId: string | null): void {
  status = streamId ? { live: true, streamId } : { live: false, streamId: null };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => status;
const serverSnapshot: BroadcastStatus = { live: false, streamId: null };
const getServerSnapshot = () => serverSnapshot;

export function useBroadcastStatus(): BroadcastStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
