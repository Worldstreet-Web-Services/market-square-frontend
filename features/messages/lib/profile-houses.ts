"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { errorCode } from "@/lib/api/envelope";
import { msApi } from "@/lib/api/service";
import { useAuth } from "@/hooks/use-auth";
import { ConversationSchema } from "@/features/messages/lib/types";

/**
 * THE HOUSES SOMEBODY ELSE BELONGS TO — `GET /profiles/:username/houses`,
 * LIVE on :8080 (ogazboiz → 1 public house; prince → 0, his only house being
 * private and rightly hidden from an anonymous reader).
 *
 * It answers with the SAME object `GET /conversations/discover` does — a
 * `ConversationSummary`, biggest first, same cursor shape — so it parses
 * through the same `ConversationSchema` rather than a second schema of the
 * same thing. That is also why this read lives in the messages slice: a
 * house IS a group conversation, and the profile slice does not own the
 * conversation shape.
 *
 * ─── `viewerIsMember` IS OPTIONAL, WITHOUT A DEFAULT ────────────────────────
 * The service OMITS it for an anonymous reader. Omitted means UNKNOWN — a
 * reader who belongs to nothing yet, not a reader checked and found outside —
 * and it becomes a real answer the moment they sign in. So it is never
 * defaulted to `false`: the same rule as `isFollowing`, where a missing field
 * hardening into a fabricated negative was a live bug.
 *
 * The viewer's session is in the KEY for the same reason: an anonymous
 * answer must not be reused after sign-in, or Join House stands where View
 * House should.
 *
 * Private houses appear only when the viewer shares them, enforced by the
 * service; nothing here filters by visibility.
 *
 * A 404 is "not deployed", not "no houses": `unavailable` keeps the rail
 * absent rather than empty in an environment where the route has not shipped.
 */
const ProfileHouseSchema = ConversationSchema.extend({
  viewerIsMember: z.boolean().optional(),
});
export type ProfileHouse = z.infer<typeof ProfileHouseSchema>;

const ProfileHousesSchema = z.object({
  items: z.array(ProfileHouseSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export function useProfileHouses(username: string, enabled = true) {
  const { authenticated } = useAuth();
  const query = useQuery({
    queryKey: ["ms", "profile-houses", username, authenticated ? "viewer" : "anonymous"],
    queryFn: async () =>
      ProfileHousesSchema.parse(await msApi.get(`/profiles/${username}/houses`)),
    enabled,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
  return { ...query, unavailable: errorCode(query.error) === "NOT_FOUND" };
}
