"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { msApi } from "@/lib/api/service";
import type { ApiErrorLike } from "@/lib/speaker-invite";

/**
 * THE ROOM'S MODERATORS — up to three people who may act for the host.
 *
 * Appointed on the STREAM and not on the house, so the role ends when the room
 * does. A house admin outlives the conversation by months; a moderator is for
 * tonight, and the two must not be the same record.
 *
 * WHAT ONE MAY DO: answer speaker requests, invite to speak, mute for
 * everyone, remove a chat message. What one may NOT: appoint another, change
 * the room's settings, or read the host's stats. Ending the room is the host's
 * alone unless `canEndRoom` was granted to that person — ogazboiz's ruling:
 * "let say the host have something to do he can give the moderator to help him
 * end it".
 *
 * APPOINTING DOES NOT SEAT THEM, which he corrected us on: "a moderator can
 * still be in audience too and you can bring someone to speak or appoint
 * them". Two separate acts in either order. That also keeps the rule that a
 * host cannot put somebody's microphone live without being asked — auto-
 * seating would have made an appointment into consent.
 */
const ModeratorSchema = z.object({
  streamId: z.string().optional().default(""),
  profileId: z.string(),
  /** Granted per person, default off. The host's own power, lent deliberately. */
  canEndRoom: z.boolean().optional().default(false),
  appointedBy: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

export type RoomModerator = z.infer<typeof ModeratorSchema>;

const ModeratorListSchema = z.object({
  moderators: z.array(ModeratorSchema).optional().default([]),
});

export const MODERATOR_LIMIT = 3;

/**
 * The cap is the SERVICE's and this is only what the sheet counts with. A
 * client-side limit is a suggestion: the service answers 409
 * `MODERATOR_LIMIT_REACHED` with its own `details.limit`, and that refusal is
 * what actually holds. This exists so the sheet can say "2/3 selected" before
 * anybody taps, not so it can decide.
 */
export function moderatorLimitFrom(error: unknown): number | null {
  if (errorCode(error) !== "MODERATOR_LIMIT_REACHED") return null;
  const details = (error as ApiErrorLike | null)?.details as { limit?: unknown } | undefined;
  return typeof details?.limit === "number" ? details.limit : MODERATOR_LIMIT;
}

export function useRoomModerators(streamId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ["ms", "stream", streamId, "moderators"],
    queryFn: async () =>
      ModeratorListSchema.parse(await msApi.authedGet(`/streams/${streamId}/moderators`)).moderators,
    enabled: enabled && streamId.length > 0,
    retry: false,
  });
  return { ...query, items: query.data ?? [] };
}

/**
 * Appoint and remove, sharing one invalidation.
 *
 * Both invalidate the room read as well as the list, because `moderatorIds`
 * rides on the room and is what every OTHER surface reads — the pills under a
 * speaker's name, and whether the dock draws its button at all. Invalidating
 * only the list would leave the room disagreeing with the sheet that just
 * changed it.
 *
 * APPOINTING IS IDEMPOTENT on the service, so a double tap costs nothing and
 * does not spend one of the three. The sheet therefore does not need to guard
 * against its own second press, which is the kind of guard that goes wrong.
 */
export function useAppointModerator(streamId: string) {
  const client = useQueryClient();
  const settle = () => {
    client.invalidateQueries({ queryKey: ["ms", "stream", streamId, "moderators"] });
    client.invalidateQueries({ queryKey: ["ms", "stream", streamId] });
  };

  const appoint = useMutation({
    mutationFn: ({ userId, canEndRoom }: { userId: string; canEndRoom?: boolean }) =>
      msApi.post(`/streams/${streamId}/moderators`, { userId, ...(canEndRoom ? { canEndRoom } : {}) }),
    onSuccess: settle,
    onError: (error) => {
      const limit = moderatorLimitFrom(error);
      // The service's own refusal, worded so it says WHY rather than refusing
      // blankly — the limit comes off `details` rather than being assumed.
      if (limit !== null) {
        toast.error(`A room can have ${limit} moderators. Remove one first.`);
        return;
      }
      toast.error(errorMessage(error, "Couldn't make them a moderator."));
    },
  });

  const remove = useMutation({
    mutationFn: (profileId: string) => msApi.del(`/streams/${streamId}/moderators/${profileId}`),
    onSuccess: settle,
    onError: (error) => toast.error(errorMessage(error, "Couldn't remove that moderator.")),
  });

  return { appoint, remove };
}

/**
 * HAND THE CLOSING OVER, on the way out.
 *
 * `PATCH /streams/{id}/moderators/{profileId} { canEndRoom }` — a SEPARATE
 * route from appointing, deliberately. Appointing is `ON CONFLICT DO NOTHING`,
 * so re-posting somebody never touches this flag: a client re-adding a
 * moderator cannot escalate them by accident, and the call named "appoint" is
 * never the one that changes a permission.
 *
 * ─── WHY IT FIRES ON LEAVING AND NOT ON APPOINTMENT ──────────────────────────
 * Granted at appointment, somebody brought in to triage speaker requests could
 * close everybody's room while the host sat there watching. Tied to the host
 * stepping away, the power exists exactly when it is needed and not before
 * (ogazboiz: "let say the host have something to do he can give the moderator
 * to help him end it").
 *
 * BEST EFFORT, AND THE HOST LEAVES EITHER WAY. Trapping somebody in a room
 * because a permission write failed is the worse trade, and the room still
 * closes on its own once everybody stops talking. `allSettled` rather than
 * `all`: one moderator whose row has gone must not cost the others their
 * grant.
 */
export function useGrantEndRoom(streamId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (profileIds: readonly string[]) => {
      const results = await Promise.allSettled(
        profileIds.map((id) =>
          msApi.patch(`/streams/${streamId}/moderators/${id}`, { canEndRoom: true })
        )
      );
      return results.filter((r) => r.status === "fulfilled").length;
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "stream", streamId, "moderators"] });
    },
  });
}
