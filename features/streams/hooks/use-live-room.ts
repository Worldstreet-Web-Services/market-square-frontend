"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Room } from "livekit-client";
import { getRoom, subscribeRoom } from "@/features/streams/lib/live-room";

/**
 * The one Room this stream is allowed to have, as React state.
 *
 * Whoever opened it — the viewer player or the host publisher — registered it
 * in lib/live-room.ts. Everything else reads it from there rather than opening
 * a second one, which is the identity collision that registry exists to stop.
 */
export function useLiveRoom(streamId: string): Room | null {
  return useSyncExternalStore(
    useCallback((listener) => subscribeRoom(streamId, listener), [streamId]),
    useCallback(() => getRoom(streamId), [streamId]),
    () => null
  );
}
