"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api/client";
import { readUtm, type UtmParams } from "@/lib/utm";

export type MarketEventName =
  | "feed_viewed"
  | "content_opened"
  | "profile_viewed"
  | "follow_created"
  | "activity_scheduled"
  | "stream_started"
  | "qualified_watch_time_reached"
  | "stream_completed"
  | "ticket_checkout_started"
  | "ticket_purchased"
  | "kash_access_used"
  | "store_item_viewed"
  | "download_started"
  | "purchase_completed"
  | "entitlement_issued"
  | "replay_started"
  | "content_reported"
  | "notification_opened";

interface MarketEventInput {
  entityType?: string;
  entityId?: string;
  surface: string;
  source?: string;
  accessType?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const UTM_KEY = "ms.analytics.utm";

/**
 * The FIRST UTM tags this visit arrived with, kept for the rest of it.
 *
 * Captured as soon as the shell mounts (`captureVisitUtm`), because a visit's
 * first page does not always record an event, and one client navigation later
 * the query string — and the tags — are gone.
 */
export function captureVisitUtm(): UtmParams | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(UTM_KEY);
    if (stored) return JSON.parse(stored) as UtmParams;
    const found = readUtm(window.location.search);
    if (found) sessionStorage.setItem(UTM_KEY, JSON.stringify(found));
    return found;
  } catch {
    return null;
  }
}

function sessionId() {
  const key = "ms.analytics.session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

/**
 * Has the collector answered 404 yet?
 *
 * `POST /analytics/events` is not deployed on every environment the app runs
 * against — the fixture BFF implements it, the live service does not (yet).
 * Without this guard every feed view, profile view and store view fires
 * another request at a route we have already been told is not there: a
 * console full of red on a working app, which trains everyone to ignore the
 * console.
 *
 * A 404 is the ONLY thing that stops us. A 500, a timeout or an offline tab
 * are transient and the next event should still try — giving up on those
 * would silently kill analytics for the rest of the session over one blip.
 *
 * Scoped to the page load, so a deploy that adds the route is picked up on
 * the next visit without anyone clearing anything.
 */
let collectorMissing = false;

export function trackMarketEvent(name: MarketEventName, input: MarketEventInput) {
  if (typeof window === "undefined") return;
  if (collectorMissing) return;
  const utm = captureVisitUtm();
  const metadata = utm || input.metadata ? { ...utm, ...input.metadata } : undefined;
  const payload = {
    version: 1,
    name,
    sessionId: sessionId(),
    timestamp: new Date().toISOString(),
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    ...input,
    // The visit's UTM tags ride along as metadata — a shape the collector
    // already takes — so a view can be traced back to the share that brought it.
    ...(metadata ? { metadata } : {}),
  };
  void apiFetch("/api/market-square/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((response) => {
      if (response.status === 404) collectorMissing = true;
    })
    // Analytics never gets to be the reason something breaks: a failed
    // measurement is not a failed action, and the reader must never learn
    // that we tried to count them.
    .catch(() => {});
}

export function useMarketView(name: MarketEventName, input: MarketEventInput, ready = true) {
  const { entityType, entityId, surface, source, accessType } = input;
  useEffect(() => {
    if (!ready) return;
    trackMarketEvent(name, { entityType, entityId, surface, source, accessType });
  }, [name, entityType, entityId, surface, source, accessType, ready]);
}
