"use client";

import { useQuery } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { msApi } from "@/lib/api/service";
import { ConversationSchema } from "@/features/messages/lib/types";
import { z } from "zod";

/**
 * PUBLIC HOUSES A READER COULD JOIN — the "Join a community" grid (node
 * 258:5545).
 *
 * ─── THE ROUTE IS LIVE BUT UNDOCUMENTED ──────────────────────────────────────
 * `GET /conversations/discover` answers 200 with `{ items, nextCursor }` on the
 * running service, but it is ABSENT from `openapi.json`. That matters: the spec
 * is what `check-public-routes` diffs against, and an undocumented route cannot
 * be checked in either direction — nobody would notice it becoming gated, or
 * quietly disappearing. Documenting it is in the backend notes.
 *
 * An empty list is the honest answer today, because every group in the system
 * is `private`. `visibility: public` is what puts a group here, and the group
 * composer offers that choice at creation.
 *
 * ─── HOW IT FAILS ────────────────────────────────────────────────────────────
 * A 404 means "not deployed", not "no houses" — so `unavailable` stays, for the
 * environments where the route has not shipped: the section renders NOTHING,
 * exactly as `useBookmarkPost().unavailable` goes quiet rather than faking a
 * save. A permanent empty "Join a community" panel would be an apology for a
 * feature nobody can use; an absent section is simply the page as it is.
 */
const DiscoverHousesSchema = z.object({
  items: z.array(ConversationSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export function useDiscoverHouses(limit = 6) {
  const query = useQuery({
    queryKey: ["ms", "discover-houses", limit],
    queryFn: async () =>
      DiscoverHousesSchema.parse(await msApi.get("/conversations/discover", { limit })),
    // A directory of communities does not change minute to minute.
    staleTime: 5 * 60_000,
    // A 404 is terminal: retrying a route that does not exist is noise.
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
  return { ...query, unavailable: errorCode(query.error) === "NOT_FOUND" };
}
