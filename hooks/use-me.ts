"use client";

import { useQuery } from "@tanstack/react-query";
import { msApi } from "@/lib/api/service";
import { ProfileSchema, type Profile } from "@/lib/api/schemas";
import { useAuth } from "@/hooks/use-auth";

// The signed-in profile. Shared because the shell, the composer, the profile
// page and every gated action all need to know who "me" is.
export function useMe() {
  const { ready, authenticated } = useAuth();
  return useQuery<Profile>({
    queryKey: ["ms", "me"],
    enabled: ready && authenticated,
    queryFn: async () => ProfileSchema.parse(await msApi.authedGet("/me")),
  });
}
