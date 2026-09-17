"use client";

import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { unwrap } from "@/lib/api/envelope";
import { msApi } from "@/lib/api/service";

const UnsubscribeResultSchema = z.object({ unsubscribed: z.boolean() });

/**
 * Turn off the daily email summary from the link in the email —
 * `POST /email/unsubscribe?token=…`, PUBLIC: the person may not be signed in on
 * this device, and the signed token already says whose setting it is. So this
 * goes through `apiFetch` without `requireAuth` rather than `msApi.post`,
 * which demands a session. The token is passed on exactly as it arrived.
 */
export async function unsubscribeEmailDigest(token: string) {
  const res = await apiFetch(
    api(`/api/market-square/email/unsubscribe?token=${encodeURIComponent(token)}`),
    { method: "POST" },
    { breaker: false }
  );
  return UnsubscribeResultSchema.parse(await unwrap(res, "Couldn't turn off email summaries."));
}
import { ProfileSettingsSchema } from "@/features/settings/lib/types";
import type { SettingsPatch } from "@/features/settings/lib/merge";
import { api } from "../../../lib/square-path.ts";

/** The reader's settings, defaults filled in by the service for anyone who never saved. */
export async function fetchSettings() {
  return ProfileSettingsSchema.parse(await msApi.authedGet("/me/settings"));
}

/**
 * Save part of the settings. Partial and nested; the service answers the WHOLE
 * object, which replaces the cached one.
 */
export async function updateSettings(patch: SettingsPatch) {
  return ProfileSettingsSchema.parse(await msApi.patch("/me/settings", patch));
}
