"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { fetchSettings, updateSettings } from "@/features/settings/lib/api";
import { applySettingsPatch, type SettingsPatch } from "@/features/settings/lib/merge";
import type { ProfileSettings } from "@/features/settings/lib/types";

const KEY = ["ms", "settings"] as const;

/**
 * The reader's settings. A 404 means the route is not deployed on this
 * server — the screen reads that as "coming", never as an error to retry.
 */
export function useSettings() {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: KEY,
    queryFn: fetchSettings,
    enabled: ready && authenticated,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
}

/**
 * Save a setting. OPTIMISTIC: the control moves the moment it is tapped, and a
 * refused save puts it back and says so — a switch that stays where you left
 * it after the service said no would be showing a setting you do not have.
 */
export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => updateSettings(patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: KEY });
      const previous = client.getQueryData<ProfileSettings>(KEY);
      if (previous) client.setQueryData<ProfileSettings>(KEY, applySettingsPatch(previous, patch));
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) client.setQueryData(KEY, context.previous);
      toast.error(errorMessage(error, "Couldn't save that setting."));
    },
    onSuccess: (saved) => client.setQueryData(KEY, saved),
  });
}
