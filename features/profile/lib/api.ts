"use client";

import { msApi } from "@/lib/api/service";
import { ProfileSchema } from "@/lib/api/schemas";
import {
  CreatorApplicationSchema,
  FollowResultSchema,
  MaybeCreatorApplicationSchema,
  MyVerificationSchema,
  RenewVerificationSchema,
  ProfileActivitiesSchema,
  ProfilePostsSchema,
  ProfileStreamsSchema,
  SpotlightSchema,
  VerificationRuleSchema,
} from "@/features/profile/lib/types";

export async function fetchProfile(username: string) {
  return ProfileSchema.parse(await msApi.get(`/profiles/${username}`));
}

export async function fetchProfilePosts(username: string, cursor?: string) {
  return ProfilePostsSchema.parse(await msApi.get(`/profiles/${username}/posts`, { cursor }));
}

export async function fetchProfileStreams(username: string) {
  return ProfileStreamsSchema.parse(await msApi.get(`/profiles/${username}/streams`));
}

export async function fetchProfileActivities(username: string) {
  return ProfileActivitiesSchema.parse(await msApi.get(`/profiles/${username}/activities`));
}

export async function setFollow(profileId: string, follow: boolean) {
  const path = `/profiles/${profileId}/follow`;
  return FollowResultSchema.parse(follow ? await msApi.post(path) : await msApi.del(path));
}

export async function setBlocked(profileId: string, blocked: boolean) {
  const path = `/profiles/${profileId}/block`;
  return blocked ? msApi.post<{ blocked: boolean }>(path) : msApi.del<{ blocked: boolean }>(path);
}

/**
 * Send a wink — a one-tap signal of interest, addressed to a PERSON.
 *
 * The path is written out in full rather than assembled from a variable so the
 * public-route check can see it: `POST /profiles/{id}/wink` is not in the
 * service's OpenAPI document yet, and the point of that check is to catch
 * exactly this before it becomes a mystery 404 in production. It is listed in
 * `PENDING_ROUTES` with the condition for deleting the entry.
 *
 * Until it ships, this 404s and `useWink` reads that as "not deployed" and
 * takes the control away — the same contract `useBookmarkPost` and the block
 * action already follow. Nothing about this flow may end in a success toast
 * without a 2xx behind it: a wink that says "sent" and reached nobody is worse
 * than no wink, because the sender stops wondering.
 */
export async function sendWink(profileId: string) {
  return msApi.post<{ winked: boolean; createdAt?: string }>(`/profiles/${profileId}/wink`);
}

/**
 * The reasons `POST /reports` accepts, verbatim from `CreateReportRequest`.
 *
 * Every profile report used to be filed as `other`, which is the bucket a
 * moderator reads last. A report of harassment that arrives indistinguishable
 * from "I don't like this person" is a report that gets triaged like the
 * latter — and this slice adds an unsolicited interest signal, so which of
 * these four a reader picks is now load-bearing.
 */
export const REPORT_REASONS = ["abuse", "spam", "scam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export async function reportProfile(profileId: string, reason: ReportReason = "other") {
  return msApi.post<{ id: string; status: string }>("/reports", {
    targetType: "profile",
    targetId: profileId,
    reason,
  });
}

export async function updateMe(input: {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}) {
  return ProfileSchema.parse(await msApi.patch("/me", input));
}

export async function fetchVerificationRule() {
  return VerificationRuleSchema.parse(await msApi.get("/verification/rule"));
}

export async function fetchMyVerification() {
  return MyVerificationSchema.parse(await msApi.authedGet("/me/verification"));
}

/**
 * Extend the paid period. Early renewal stacks days rather than resetting the
 * clock, so it is safe to offer at any point in the cycle — including while
 * lapsed, which is how a paused badge comes back with no re-approval.
 */
export async function renewVerification() {
  return RenewVerificationSchema.parse(await msApi.post("/me/verification/renew"));
}

// Backend supports window=weekly only; the param is fixed here so the UI can
// never emit an invalid value.
export async function fetchSpotlight() {
  return SpotlightSchema.parse(await msApi.get("/spotlight", { window: "weekly" }));
}

export async function fetchCreatorApplication() {
  return MaybeCreatorApplicationSchema.parse(await msApi.authedGet("/me/creator-application"));
}

export async function applyForCreator(note?: string) {
  return CreatorApplicationSchema.parse(
    await msApi.post("/me/creator-application", note ? { note } : {})
  );
}
