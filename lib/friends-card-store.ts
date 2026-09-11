"use client";

import { useSyncExternalStore } from "react";
import type { FriendsMoment } from "@/lib/friends-popup";

/**
 * Which friends card to open ON DEMAND — one answer for the whole app.
 *
 * The card normally opens by itself on entering, from unread notifications.
 * A tap on a wink or a follow-back in the notifications list has to open the
 * SAME card, read or not ("when they click on the notification that is about
 * wink they should see the card"). The popup lives in the shell and the list
 * lives in the notifications slice, which may not import it, so this is the
 * doorbell — the `lib/ticker-store.ts` shape: a module-level value behind
 * `useSyncExternalStore`, no context and no store library.
 *
 * The epoch makes a second tap on the same row count as a new opening.
 */
export interface FriendsCardRequest {
  moment: FriendsMoment | null;
  /** Increments on every opening, including a repeat of the same row. */
  epoch: number;
}

const NONE: FriendsCardRequest = { moment: null, epoch: 0 };

let snapshot: FriendsCardRequest = NONE;
const listeners = new Set<() => void>();

/** Open this moment's card over whatever page the reader is on. */
export function openFriendsCard(moment: FriendsMoment) {
  snapshot = { moment, epoch: snapshot.epoch + 1 };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The latest request, for the popup to act on once per epoch. */
export function useFriendsCardRequest(): FriendsCardRequest {
  return useSyncExternalStore(subscribe, () => snapshot, () => NONE);
}
