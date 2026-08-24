"use client";

import { msApi } from "@/lib/api/service";
import { ProfileSchema } from "@/lib/api/schemas";
import {
  CreatorApplicationSchema,
  FollowResultSchema,
  MaybeCreatorApplicationSchema,
  MyVerificationSchema,
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

export async function reportProfile(profileId: string) {
  return msApi.post<{ id: string; status: string }>("/reports", {
    targetType: "profile",
    targetId: profileId,
    reason: "other",
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

export async function requestVerification() {
  return msApi.post<{ id: string; status: string }>("/verification/requests", { type: "earned" });
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
