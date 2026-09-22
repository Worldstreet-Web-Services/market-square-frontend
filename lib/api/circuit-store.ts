"use client";

import { useSyncExternalStore } from "react";
import {
  CLOSED,
  type CircuitSnapshot,
  allowsRequest,
  isCircuitFailure,
  onFailure,
  onProbe,
  onSuccess,
} from "@/lib/api/circuit";

/**
 * The live breaker: one per tab, shared by every request the app makes.
 *
 * Held outside React because the fetch layer is not a component and must be
 * able to ask "is the backend up?" without one. The UI subscribes to the same
 * value, which is what lets a single banner speak for every query at once
 * instead of forty rows each announcing the same outage.
 */
let snapshot: CircuitSnapshot = CLOSED;
const listeners = new Set<() => void>();

function publish(next: CircuitSnapshot) {
  if (next.state === snapshot.state && next.retryAt === snapshot.retryAt) {
    snapshot = next;
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

export function circuitSnapshot(): CircuitSnapshot {
  return snapshot;
}

/** True when a request may go out. A probe flips the state so the UI can say so. */
export function circuitAllows(now = Date.now()): boolean {
  if (allowsRequest(snapshot, now)) {
    // The probe shuts the door behind it — see `onProbe`. A half-open circuit
    // whose cooldown has lapsed again gets another single probe, which is why
    // this runs for "half-open" too and not only for "open".
    if (snapshot.state !== "closed") publish(onProbe({ ...snapshot, state: "open" }, now));
    return true;
  }
  return false;
}

export function recordCircuitFailure(status?: number, now = Date.now()): void {
  if (!isCircuitFailure(status)) return;
  publish(onFailure({ ...snapshot, state: snapshot.state === "half-open" ? "open" : snapshot.state }, now));
}

export function recordCircuitSuccess(): void {
  if (snapshot.state === "closed" && snapshot.failures === 0) return;
  publish(onSuccess());
}

/** Manual "try again": drops the cooldown so the next request goes out now. */
export function retryCircuitNow(): void {
  if (snapshot.state === "closed") return;
  publish({ ...snapshot, state: "half-open", retryAt: 0 });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function serverSnapshot(): CircuitSnapshot {
  return CLOSED;
}

export function useCircuit(): CircuitSnapshot {
  return useSyncExternalStore(subscribe, circuitSnapshot, serverSnapshot);
}
