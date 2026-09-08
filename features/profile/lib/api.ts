"use client";

import { z } from "zod";
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
  /**
   * The self-declared place and gender.
   *
   * ABSENT leaves the field alone; explicit `null` clears it — the same
   * semantics `PATCH /conversations/:id` uses, so an editor that only touches
   * a bio can never wipe somebody's city. The service also reads a blank or
   * whitespace-only string as a clear rather than storing it, which is what
   * stops `""` and `null` becoming two ways to say the same thing where only
   * one of them matches a filter.
   *
   * FREE TEXT, all three. `gender` is not an enum, deliberately: an enum is a
   * decision about which identities exist, and it is not ours to take in a
   * migration. The service folds case so self-declared answers stay comparable
   * without anybody owning a gazetteer.
   *
   * There is no coordinate here and there must never be one — see
   * `lib/people-filters.ts`.
   */
  city?: string | null;
  region?: string | null;
  gender?: string | null;
  /**
   * Marks onboarding complete. `true` ONLY.
   *
   * The service answers 400 to `false` on purpose: finishing onboarding cannot
   * become less true, and a form that serialised its whole state would
   * otherwise re-onboard somebody on every device they own. Nothing here should
   * ever send it as anything but `true`.
   */
  hasOnboarded?: true;
}) {
  return ProfileSchema.parse(await msApi.patch("/me", input));
}

/** `{ city, region }`, both nullable — a miss is an ANSWER, not an error. */
const ReverseGeocodeSchema = z.object({
  city: z.string().nullable().optional().default(null),
  region: z.string().nullable().optional().default(null),
});

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

/**
 * A device reading turned into a place NAME — `POST /geo/reverse`.
 *
 * The endpoint answers exactly `{ city, region }` and nothing else: no country,
 * no street, no formatted address, and never the coordinates echoed back. That
 * narrowness is the privacy property — a caller cannot store what the route
 * will not return — so this parser is deliberately as narrow as the contract
 * and drops anything else that arrives.
 *
 * The COORDINATES ARE NEVER STORED. They exist for the duration of this one
 * request, on the server, to ask a provider a question; what comes back is a
 * place a person can read, edit and delete. There is no `distanceKm` here and
 * there must never be one — see `lib/people-filters.ts`.
 *
 * LIVE, and GATED — a POST, so `needsAuth` in the BFF covers it and
 * `isPublicGet` never sees it.
 *
 * A 404 FROM HERE IS AN ANSWER, NOT AN OUTAGE: the provider was asked and
 * recognised no place at that point — mid-ocean, a spot with no locality. 502
 * is "we could not ask" (or no provider configured on this deployment), which
 * is the one that should quiet the control; 400 is not-a-coordinate, refused
 * here rather than forwarded to somebody else's service; 429 is the per-user
 * budget, because one tap is one request to a third party we neither pay for
 * nor control.
 *
 * ─── THE 404 IS NO LONGER AMBIGUOUS: BRANCH ON THE CODE, NOT THE STATUS ────
 * The paragraph above is true wherever the route exists, and WRONG where it
 * does not: an absent route is also a 404, so the domain answer ("no place
 * there") and the transport answer ("no such endpoint") arrive wearing one
 * signal. It is live today — `POST /geo/reverse` is on the service at :8094
 * and absent from the deployed spec, because the PR that added it merged to
 * staging while production deploys from main. So in production this reports
 * "we could not name that spot" about a route nobody ever called.
 *
 * FIXED SERVER-SIDE, WHICH IS WHERE IT BELONGED. The no-place answer now
 * carries its own code — 404 `NO_PLACE_FOUND` — and only a provider that
 * actually answered can produce it. So the caller switches on the CODE and
 * the status stops mattering, which is correct on a deployment that is behind
 * rather than only once the deploy catches up. No client-side probe for the
 * route's existence was added, and none is needed.
 *
 *   404 NO_PLACE_FOUND       the provider knew no place there — a fact about
 *                            the spot; the control still works
 *   404 NOT_FOUND            the route is absent, renamed or misproxied — a
 *                            fault, and never a claim about where somebody is
 *   502 SERVICE_UNAVAILABLE  we could not ask; a retry, not a location
 *
 * `components/layout/location-sheet.tsx` branches on exactly those.
 *
 * NOT ON :8094 YET — committed on the backend and deliberately not deployed,
 * so the running service still answers the old bare NOT_FOUND. That falls into
 * the route-fault branch, which quiets the control rather than lying about a
 * location, so the behaviour is safe in the meantime.
 *
 * IT WRITES NOTHING. The place comes back, the person reads it, and the form
 * saves it with `PATCH /me` — which keeps this a convenience button rather
 * than the app recording where somebody is.
 */
export async function reverseGeocode(input: { latitude: number; longitude: number }) {
  return ReverseGeocodeSchema.parse(await msApi.post("/geo/reverse", input));
}