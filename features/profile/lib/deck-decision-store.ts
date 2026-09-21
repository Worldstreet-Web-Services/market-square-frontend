"use client";

import { useSyncExternalStore } from "react";
import {
  recordDecision,
  type DeckDecision,
  type DecisionRecord,
} from "@/lib/deck-decisions";

/**
 * Every card this device has answered — passed, winked or followed.
 *
 * The same shape as the wink store next door and for a related reason, but
 * this one is not a budget: it is the deck's memory. A pass has nowhere else
 * to live until the service carries one, and a follow or a wink recorded here
 * closes the card the INSTANT it is answered rather than one refetch later.
 *
 * KEYED PER VIEWER, so two people signing into one browser never inherit each
 * other's "already decided" — which on this surface would mean one of them
 * silently losing people they had never seen.
 *
 * Every storage access is try/caught: Safari in private mode throws, and a
 * browser setting must never take the deck down. A failed read degrades to
 * "nothing decided", which fails OPEN — the reader sees a card again, which is
 * the mild failure, rather than the deck emptying itself.
 */

const EMPTY: DecisionRecord[] = [];

const cache = new Map<string, DecisionRecord[]>();
const listeners = new Set<() => void>();

function storageKey(viewerId: string): string {
  return `ms.deck.decisions.${viewerId}`;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function parse(raw: string | null): DecisionRecord[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (entry): entry is DecisionRecord =>
        typeof (entry as DecisionRecord)?.targetId === "string" &&
        typeof (entry as DecisionRecord)?.at === "number" &&
        ["passed", "winked", "followed"].includes((entry as DecisionRecord)?.decision)
    );
  } catch {
    return EMPTY;
  }
}

/**
 * The rows for a viewer, memoised.
 *
 * `useSyncExternalStore` compares snapshots by reference and re-renders in a
 * loop if a fresh array comes back every call, so the parsed list is cached
 * and only replaced when something actually writes.
 */
export function deckDecisions(viewerId: string | null | undefined): DecisionRecord[] {
  if (!viewerId) return EMPTY;
  const cached = cache.get(viewerId);
  if (cached) return cached;
  let rows = EMPTY;
  try {
    rows = parse(window.localStorage.getItem(storageKey(viewerId)));
  } catch {
    rows = EMPTY;
  }
  cache.set(viewerId, rows);
  return rows;
}

/**
 * Record an answer. Called when the reader acts, not when a request returns.
 *
 * A pass has no request to wait for, and a follow or a wink that only closed
 * the card once the service answered would leave it sitting there through the
 * round trip — which is exactly the moment the next swipe lands on it.
 */
export function rememberDecision(
  viewerId: string | null | undefined,
  targetId: string,
  decision: DeckDecision
) {
  if (!viewerId || !targetId) return;
  const next = recordDecision(deckDecisions(viewerId), targetId, decision, Date.now());
  cache.set(viewerId, next);
  try {
    window.localStorage.setItem(storageKey(viewerId), JSON.stringify(next));
  } catch {
    // Unwritable storage still gets the in-memory update, so the deck behaves
    // for the rest of this page view.
  }
  emit();
}

// Server render has nothing stored and no viewer resolved yet, so the first
// client render matches the HTML we served.
function serverSnapshot(): DecisionRecord[] {
  return EMPTY;
}

/** The decisions this viewer has made, re-rendering the deck on a change. */
export function useDeckDecisions(viewerId: string | null | undefined): DecisionRecord[] {
  return useSyncExternalStore(subscribe, () => deckDecisions(viewerId), serverSnapshot);
}
