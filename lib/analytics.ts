"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api/client";

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

function sessionId() {
  const key = "ms.analytics.session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export function trackMarketEvent(name: MarketEventName, input: MarketEventInput) {
  if (typeof window === "undefined") return;
  const payload = {
    version: 1,
    name,
    sessionId: sessionId(),
    timestamp: new Date().toISOString(),
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    ...input,
  };
  void apiFetch("/api/market-square/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}

export function useMarketView(name: MarketEventName, input: MarketEventInput, ready = true) {
  const { entityType, entityId, surface, source, accessType } = input;
  useEffect(() => {
    if (!ready) return;
    trackMarketEvent(name, { entityType, entityId, surface, source, accessType });
  }, [name, entityType, entityId, surface, source, accessType, ready]);
}
