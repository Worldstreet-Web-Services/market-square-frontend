"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  RAIL_DEFAULT,
  RAIL_STORAGE_KEY,
  type RailState,
  parseRail,
} from "@/lib/sidebar-rail";

/**
 * The rail's live state, held outside React.
 *
 * An external store rather than `useState` + an effect that reads storage:
 * the stored width is not React state arriving late, it is state that already
 * existed before this render. Reading it in an effect means a first paint at
 * the default and a second at the truth — the layout visibly jumps — and it is
 * the cascading-render pattern the lint rule exists to stop.
 *
 * `getServerSnapshot` returns the default because the server has no storage.
 * React uses it for the hydration render and re-reads the client snapshot
 * immediately after, which is exactly the handoff this needs.
 */
let state: RailState | null = null;
const listeners = new Set<() => void>();

function initial(): RailState {
  const stored = parseRail(window.localStorage.getItem(RAIL_STORAGE_KEY));
  if (stored) return stored;
  // No choice recorded yet: the old breakpoint rule stands in, so an existing
  // reader's layout does not move until they move it.
  return window.matchMedia("(min-width: 1280px)").matches
    ? RAIL_DEFAULT
    : { ...RAIL_DEFAULT, mode: "icon" };
}

function getSnapshot(): RailState {
  state ??= initial();
  return state;
}

function getServerSnapshot(): RailState {
  return RAIL_DEFAULT;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function publish(next: RailState) {
  state = next;
  for (const listener of listeners) listener();
}

export function useRailState() {
  const rail = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** Mid-drag: the rail follows the pointer, nothing is written down. */
  const preview = useCallback((next: RailState) => publish(next), []);

  /** A decision — drag end, toggle, key press — so it is remembered. */
  const commit = useCallback((next: RailState) => {
    publish(next);
    try {
      window.localStorage.setItem(RAIL_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage denied still leaves a working rail for this session; only the
      // memory of it is lost.
    }
  }, []);

  return { rail, preview, commit };
}
