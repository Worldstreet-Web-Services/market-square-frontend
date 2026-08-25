"use client";

import type { Room } from "livekit-client";

/**
 * One LiveKit Room per stream, per page. Ever.
 *
 * The playback token and the speaker token are minted with the SAME LiveKit
 * identity (the user's id). LiveKit evicts an existing participant when a new
 * one joins with that identity, so a second Room object does not "add a
 * publisher" — it kicks the viewer. The viewer's reconnect then kicks the
 * publisher, and the two fight until the mobile renderer dies.
 *
 * The correct upgrade path is server-side: the approve action grants publish
 * permission on the participant that is ALREADY connected, and the client
 * simply turns its mic and camera on over that same connection. No second
 * token, no second Room, no identity collision.
 *
 * This registry is the structural guard that keeps it that way. Anything
 * opening a Room registers it here; a second registration for the same stream
 * is a bug, and `registerRoom` says so loudly rather than letting the eviction
 * loop reappear silently months from now.
 */
const rooms = new Map<string, Room>();
const listeners = new Map<string, Set<() => void>>();

function notify(streamId: string) {
  listeners.get(streamId)?.forEach((listener) => listener());
}

export class DuplicateRoomError extends Error {
  constructor(streamId: string) {
    super(
      `A LiveKit Room is already open for stream ${streamId}. Opening a second ` +
        `one connects twice with the same identity, which evicts the first and ` +
        `starts a reconnect loop. Upgrade the existing connection instead.`
    );
    this.name = "DuplicateRoomError";
  }
}

/**
 * Claim the single Room slot for a stream.
 *
 * Throws when the slot is taken by a DIFFERENT room. Re-registering the same
 * instance is a no-op, so React's strict-mode double-invoke and ordinary
 * re-renders stay harmless.
 */
export function registerRoom(streamId: string, room: Room): void {
  const existing = rooms.get(streamId);
  if (existing && existing !== room) throw new DuplicateRoomError(streamId);
  rooms.set(streamId, room);
  notify(streamId);
}

/** Release the slot. Ignores a stale room that has already been replaced. */
export function unregisterRoom(streamId: string, room: Room): void {
  if (rooms.get(streamId) !== room) return;
  rooms.delete(streamId);
  notify(streamId);
}

export function getRoom(streamId: string): Room | null {
  return rooms.get(streamId) ?? null;
}

/** For `useSyncExternalStore` — fires whenever the stream's room appears or goes. */
export function subscribeRoom(streamId: string, listener: () => void): () => void {
  let set = listeners.get(streamId);
  if (!set) {
    set = new Set();
    listeners.set(streamId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(streamId);
  };
}

/** Tests only — the registry is module state that would otherwise leak between cases. */
export function __resetRooms(): void {
  rooms.clear();
  listeners.clear();
}
