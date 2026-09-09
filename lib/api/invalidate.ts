"use client";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Every cache that renders somebody's identity.
 *
 * A display name, avatar, verified check, org badge or role chip is COPIED
 * into feed items, story groups, comment rows, search results, conversation
 * previews and spotlight boards — none of those read the profile query. So
 * changing any of them and invalidating only `["ms","profile"]` leaves the old
 * identity on every one of those surfaces until each happens to refetch.
 *
 * This lives in `lib/` rather than in a feature slice because both the profile
 * slice (a rename, a new avatar) and the admin console (granting a badge or a
 * verification) have to invalidate the exact same set, and slices never import
 * each other. Keeping one list is the point: two copies drift apart silently,
 * and the symptom — a stale badge somewhere unrelated — is nearly invisible in
 * review.
 *
 * Add a key here whenever a new surface starts embedding profile identity.
 */
const IDENTITY_SURFACES: string[][] = [
  ["ms", "profile"],
  ["ms", "profile-posts"],
  ["ms", "feed"],
  ["ms", "bookmarks"],
  ["ms", "stories"],
  ["ms", "spotlight"],
  ["ms", "conversations"],
  ["ms", "discovery"],
];

export function invalidateIdentitySurfaces(queryClient: QueryClient) {
  for (const queryKey of IDENTITY_SURFACES) {
    queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Caches holding a copy of a piece of CONTENT, for when a post is removed.
 *
 * Removing content has to empty it out of the timeline, anyone's Arkmarks, the
 * author's Posts tab, the permalink and search results, or the post lingers in
 * whichever list already cached it.
 *
 * The feed slice's `invalidatePostLists` delegates here so there is one list
 * rather than two that drift.
 */
const CONTENT_SURFACES: string[][] = [
  ["ms", "feed"],
  ["ms", "bookmarks"],
  ["ms", "profile-posts"],
  ["ms", "post"],
  ["ms", "discovery"],
];

export function invalidateContentSurfaces(queryClient: QueryClient) {
  for (const queryKey of CONTENT_SURFACES) {
    queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Caches that change when the viewer follows or unfollows somebody.
 *
 * The follow edge is copied into more places than it looks: the followed
 * profile owns follower counts, MY profile owns the following count, the
 * spotlight and who-to-follow rails both render from `["ms","spotlight"]`,
 * search results carry `isFollowing`, and the Following lane plus the stories
 * rail change membership outright rather than just changing a number.
 *
 * This list used to be written out inline in `useFollow`. It lives here for
 * the same reason as the other two: any surface that grows a follow control
 * needs the identical set, and a second copy drifts from this one silently —
 * the symptom being a "Follow" button that stays wrong until something else
 * happens to refetch.
 */
const FOLLOW_SURFACES: string[][] = [
  ["ms", "me"],
  // Explore's People tab pages `GET /profiles`, whose rows carry the follow
  // edge. Left out of this list, the tab kept serving its pre-click answer.
  ["ms", "people"],
  ["ms", "feed", "following"],
  ["ms", "stories"],
  ["ms", "spotlight"],
  ["ms", "discovery"],
];

/**
 * `username` is the followed profile's own query, which is keyed by username
 * rather than id — it is passed in rather than listed above because it is the
 * one key that varies per call.
 */
export function invalidateFollowSurfaces(queryClient: QueryClient, username: string) {
  queryClient.invalidateQueries({ queryKey: ["ms", "profile", username] });
  for (const queryKey of FOLLOW_SURFACES) {
    queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Stamp a follow the viewer just made onto the profiles already sitting in
 * list caches.
 *
 * A list payload that CARRIES `isFollowing` beats the session intent by
 * design — the server is the truth whenever it has an opinion. That is right
 * on a refetch and wrong the instant a click lands: the cached page still
 * holds the pre-click answer, so the button would keep saying "Follow" until
 * the invalidated query came back. Rewriting the cached rows keeps the server
 * authoritative while making its recorded answer current.
 *
 * Recursive because the same profile appears at different depths per surface —
 * bare in `/profiles`, nested under `result.profile` in `/search`, under
 * `stream.owner` and `post.author` elsewhere. Matching on id plus the presence
 * of the field patches every one of them without a shape list to maintain.
 */
export function patchFollowInCaches(
  queryClient: QueryClient,
  profileId: string,
  following: boolean
) {
  for (const queryKey of FOLLOW_LIST_CACHES) {
    queryClient.setQueriesData({ queryKey }, (data: unknown) =>
      patchFollowInData(data, profileId, following)
    );
  }
}

/** List caches that render follow controls from an embedded profile. */
const FOLLOW_LIST_CACHES: string[][] = [
  ["ms", "people"],
  ["ms", "discovery"],
  ["ms", "spotlight"],
];

/** Pure cache rewrite, exported for test. Returns `node` itself when nothing matched. */
export function patchFollowInData(node: unknown, profileId: string, following: boolean): unknown {
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((item) => {
      const patched = patchFollowInData(item, profileId, following);
      if (patched !== item) changed = true;
      return patched;
    });
    return changed ? next : node;
  }
  if (!node || typeof node !== "object") return node;

  const record = node as Record<string, unknown>;
  if (record.id === profileId && "isFollowing" in record) {
    if (record.isFollowing === following) return node;
    const followerCount = record.followerCount;
    return {
      ...record,
      isFollowing: following,
      ...(typeof followerCount === "number"
        ? { followerCount: Math.max(0, followerCount + (following ? 1 : -1)) }
        : {}),
    };
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const patched = patchFollowInData(value, profileId, following);
    if (patched !== value) changed = true;
    next[key] = patched;
  }
  return changed ? next : node;
}
