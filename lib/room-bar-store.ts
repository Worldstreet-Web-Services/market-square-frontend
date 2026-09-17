"use client";

import { useSyncExternalStore } from "react";

/**
 * Is a ROOM'S OWN BOTTOM BAR on screen right now — one answer for the shell.
 *
 * A live gist room pins its control bar to the phone's bottom edge (node
 * 1285:93076: microphone, reaction, chat, raised hand) exactly where the
 * shell's dock sits, and two bars stacked at the foot of a 390px window is
 * what mounting both would be. So the dock steps aside while that bar is up.
 *
 * A DOORBELL, NOT A ROUTE RULE — the same module-level `useSyncExternalStore`
 * shape as `lib/chat-open-store.ts`, and for the same reason: whether the bar
 * exists is the ROOM's state, not the URL's. `/gist-rooms/:id` also renders a
 * room that has not opened yet, and one that has closed, and neither draws a
 * bar or a Back control — a route rule took the dock away there too, leaving
 * a phone with no navigation at all. The bar rings this on mount and clears
 * it on unmount, so the dock is gone precisely while something stands in its
 * place and never otherwise.
 *
 * Phones only: the shell hides the dock `max-md:hidden` on this, and
 * `app/globals.css` zeroes `--ws-nav-h` under the same breakpoint so nothing
 * goes on padding its foot for a dock that is not drawn. Desktop keeps
 * whatever standing the rail gives it — `railOn` alone decides that.
 */
let up = false;
const listeners = new Set<() => void>();

export function setRoomBar(next: boolean) {
  if (up === next) return;
  up = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRoomBar(): boolean {
  return useSyncExternalStore(subscribe, () => up, () => false);
}

/**
 * Is the MINIMISED ROOM'S bar on screen right now?
 *
 * The same doorbell, for the other bar that can sit at the foot of a phone:
 * the mini-player (components/layout/room-mini-player.tsx) rides ABOVE the
 * dock, and the shell stamps `data-mini-player` from this so the stylesheet
 * lifts `--ws-nav-h` and the floating `+` offsets by the bar's height. Rung by
 * the mini-player itself, on show and off on hide or unmount, so nothing pads
 * for a bar that is not drawn.
 */
let miniUp = false;
const miniListeners = new Set<() => void>();

export function setMiniPlayer(next: boolean) {
  if (miniUp === next) return;
  miniUp = next;
  for (const listener of miniListeners) listener();
}

function subscribeMini(listener: () => void) {
  miniListeners.add(listener);
  return () => {
    miniListeners.delete(listener);
  };
}

export function useMiniPlayer(): boolean {
  return useSyncExternalStore(subscribeMini, () => miniUp, () => false);
}

/**
 * Where the minimised room's DESKTOP CARD is, if anywhere
 * (lib/room-session/visibility.ts `miniPlayerCardPlacement`). The shell stamps
 * it as `data-mini-card`, and the stylesheet reserves the card's height at the
 * foot of every page (`foot`) or at the top of an open thread (`thread`) — a
 * floating card over the last row of a page is a row nobody can reach.
 */
export type MiniCardMode = "off" | "foot" | "thread" | "above-room-bar";
let miniCard: MiniCardMode = "off";
const miniCardListeners = new Set<() => void>();

export function setMiniCard(next: MiniCardMode) {
  if (miniCard === next) return;
  miniCard = next;
  for (const listener of miniCardListeners) listener();
}

function subscribeMiniCard(listener: () => void) {
  miniCardListeners.add(listener);
  return () => {
    miniCardListeners.delete(listener);
  };
}

export function useMiniCard(): MiniCardMode {
  return useSyncExternalStore(subscribeMiniCard, () => miniCard, () => "off");
}
