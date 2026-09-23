"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { errorCode } from "@/lib/api/envelope";
import { msApi } from "@/lib/api/service";

/**
 * ONE HOUSE, READ BY ANYBODY — `GET /conversations/:id`.
 *
 * The route is OPTIONAL-AUTH, which is what makes a house profile possible at
 * all: a signed-out reader gets a public house back with 200, and the page
 * they land on is the same page a member sees with a different button on it.
 * Verified against the running service rather than the spec — it answers
 * `{ title, description, imageUrl, memberCount, visibility, viewerIsMember,
 * canJoin }` to a request with no token.
 *
 * `viewerIsMember` is what decides Join House from View House, and `canJoin`
 * is the service's own answer about THIS viewer — false when signed out, false
 * for a private house. Neither is re-derived here: a client that decides who
 * may join is a client that will eventually disagree with the service.
 *
 * WHAT IT DOES NOT CARRY, and what the design draws: no members roster (the
 * face pile on `/conversations/discover` items is not on this read), no
 * website, no location, no rooms-per-week. Those sections are left OUT of the
 * page rather than stubbed — the gaps are with the backend, and an empty shelf
 * is worse than a shorter page.
 */
export const HouseSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
  imageUrl: z.string().nullable().optional().default(null),
  memberCount: z.number().nullable().optional().default(null),
  visibility: z.enum(["public", "private"]).optional().default("private").catch("private"),
  viewerIsMember: z.boolean().optional().default(false),
  canJoin: z.boolean().optional().default(false),
});

export type House = z.infer<typeof HouseSchema>;

export function useHouse(id: string) {
  const query = useQuery({
    queryKey: ["ms", "house", id],
    queryFn: async () => HouseSchema.parse(await msApi.get(`/conversations/${id}`)),
    enabled: id.length > 0,
    // A 404 here is a house that does not exist, or one a private reader may
    // not see. Retrying either is noise.
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
  return { ...query, missing: errorCode(query.error) === "NOT_FOUND" };
}
