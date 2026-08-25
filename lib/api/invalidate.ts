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
