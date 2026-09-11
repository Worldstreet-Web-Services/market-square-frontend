"use client";

import { msApi } from "@/lib/api/service";
import { ProfileSettingsSchema } from "@/features/settings/lib/types";
import type { SettingsPatch } from "@/features/settings/lib/merge";

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
