"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { msApi } from "@/lib/api/service";
import { ConversationSchema } from "@/features/messages/lib/types";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";

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

/**
 * WAIT UNTIL WE KNOW WHO IS ASKING — the difference between "join a house" and
 * "join a house you are already in".
 *
 * The service excludes the reader's own houses from this directory, and its
 * own comment says why: *"a Join House button on a house you are in is the
 * surest way to make the control look broken."* But that exclusion is done
 * against `viewerId`, and `viewerId` MAY BE NULL — deliberately, because Home
 * shows this rail to signed-out readers too.
 *
 * `msApi.get` attaches a token "when one exists". On Home this query fires at
 * first paint, BEFORE the session has resolved, so no token exists yet and the
 * service answers as if nobody is asking — every public house, including the
 * ones the reader is a member of. The houses PAGE is navigated to later, by
 * which time the session is up, so it gets the filtered list. One route, two
 * answers, and they look like different features:
 *
 *   Home     "Square Talk · 216 members · [Join House]"
 *   /houses  "No houses to explore yet"
 *
 * ogazboiz: *"i am already in a house because all this house i have join them,
 * that is why if click on view more you wont see it"*.
 *
 * So both reads wait for `ready`, which is NOT the same as `authenticated`: a
 * signed-out reader reaches `ready: true` and still gets the directory. What
 * is being waited for is the ANSWER to "is there a session", not a session.
 */
export function useDiscoverHouses(limit = 6) {
  const { ready } = useAuth();
  const query = useQuery({
    queryKey: ["ms", "discover-houses", limit],
    queryFn: async () =>
      DiscoverHousesSchema.parse(await msApi.get("/conversations/discover", { limit })),
    enabled: ready,
    // A directory of communities does not change minute to minute.
    staleTime: 5 * 60_000,
    // A 404 is terminal: retrying a route that does not exist is noise.
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
  return { ...query, unavailable: errorCode(query.error) === "NOT_FOUND" };
}

/**
 * THE WHOLE DIRECTORY, PAGED — the houses page (node 1368:2270), where
 * Popular Houses' "View more" lands. Same route, same order (member count
 * descending, the reader's own houses excluded), followed through
 * `nextCursor` by the shared infinite-scroll sentinel. The route takes
 * `cursor` and `limit` and nothing else, which is why the page's filter pill
 * is inert: there is no dimension to filter on yet.
 */
export function useDiscoverHousesPages(limit = 18) {
  const { ready } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["ms", "discover-houses", "pages", limit],
    queryFn: async ({ pageParam }) =>
      DiscoverHousesSchema.parse(
        await msApi.get("/conversations/discover", pageParam ? { limit, cursor: pageParam } : { limit })
      ),
    initialPageParam: null as string | null,
    enabled: ready,
    getNextPageParam: (last) => last.nextCursor ?? null,
    staleTime: 5 * 60_000,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
  return { ...query, unavailable: errorCode(query.error) === "NOT_FOUND" };
}
