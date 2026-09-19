"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/square-path";

/**
 * The Decane publishable key and app id, fetched from `/api/decane/key`.
 *
 * Cached at MODULE scope, not only in state: the kit derives its localStorage
 * identity key from a slice of the API key, so a remount that re-fetched and
 * handed it a different value mid-session would read as "signed out".
 */
export interface DecaneCredentials {
  apiKey: string;
  appId: string;
}

let cached: DecaneCredentials | null = null;
let inFlight: Promise<DecaneCredentials | null> | null = null;

async function load(): Promise<DecaneCredentials | null> {
  try {
    const res = await fetch(api("/api/decane/key"), { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<DecaneCredentials>;
    if (typeof body.apiKey !== "string" || typeof body.appId !== "string") return null;
    cached = { apiKey: body.apiKey, appId: body.appId };
    return cached;
  } catch {
    return null;
  }
}

/** The credentials, or null while the first fetch is in flight — "not yet", never "signed out". */
export function useDecaneCredentials(): DecaneCredentials | null {
  const [creds, setCreds] = useState<DecaneCredentials | null>(cached);

  useEffect(() => {
    if (cached) return;
    let live = true;
    void (async () => {
      inFlight ??= load();
      const loaded = await inFlight;
      // One failed load must not poison every later mount.
      if (!loaded) inFlight = null;
      if (live && loaded) setCreds(loaded);
    })();
    return () => {
      live = false;
    };
  }, []);

  return creds;
}
