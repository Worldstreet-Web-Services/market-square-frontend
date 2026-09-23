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

/**
 * A HOUSE'S MEMBERS — `GET /conversations/:id/members`.
 *
 * `ConversationMember` is `{ profile, role, joinedAt }`. Unlike the house read
 * this one is bearerAuth, so it answers for a signed-in reader and not for a
 * signed-out one, and a house you are not in may refuse it outright. Either
 * way the section simply does not render: `unavailable` covers both, because
 * "we cannot read the roster" and "there is no roster" must not look the same
 * on screen.
 *
 * The design draws this row in the NON-MEMBER state, which this cannot serve
 * — that needs the capped roster on the house read itself, the way
 * `/conversations/discover` items already carry one. It is with the backend.
 */
const MemberSchema = z.object({
  profile: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string().nullable().optional().default(null),
    avatarUrl: z.string().nullable().optional().default(null),
  }),
  role: z.string().nullable().optional().default(null),
});

export type HouseMember = z.infer<typeof MemberSchema>;

export function useHouseMembers(id: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ["ms", "house", id, "members"],
    queryFn: async () => z.array(MemberSchema).parse(await msApi.authedGet(`/conversations/${id}/members`)),
    enabled: enabled && id.length > 0,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 1,
  });
  return { ...query, unavailable: query.isError };
}
