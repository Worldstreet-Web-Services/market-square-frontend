import { msApi } from "@/lib/api/service";
import { ProfileSchema } from "@/lib/api/schemas";
import {
  AdminAnnouncementPageSchema,
  AdminProfilePageSchema,
  AdminStatsSchema,
  ReportPageSchema,
  RoleApplicationPageSchema,
  VerificationRequestPageSchema,
} from "@/features/admin/lib/types";

// Reads. Each is authed: the dashboard calls as an admin USER, and the service
// rejects anyone whose profile is not flagged.
export async function fetchAdminStats() {
  return AdminStatsSchema.parse(await msApi.authedGet("/admin/stats"));
}

export async function fetchRoleApplications(cursor?: string) {
  return RoleApplicationPageSchema.parse(
    await msApi.authedGet("/admin/role-applications", { status: "pending", limit: 30, cursor })
  );
}

export async function fetchVerificationRequests(cursor?: string) {
  return VerificationRequestPageSchema.parse(
    await msApi.authedGet("/admin/verification-requests", { status: "pending", limit: 30, cursor })
  );
}

export async function fetchAdminReports(cursor?: string) {
  return ReportPageSchema.parse(
    await msApi.authedGet("/admin/reports", { status: "open", limit: 30, cursor })
  );
}

export async function fetchAdminAnnouncements(cursor?: string) {
  return AdminAnnouncementPageSchema.parse(
    await msApi.authedGet("/admin/announcements", { limit: 30, cursor })
  );
}

/**
 * Publish a banner to everybody.
 *
 * The end is REQUIRED by the service and that is the right call: a banner
 * with no end is one somebody has to remember to take down. The start
 * defaults to now, so it is only sent when an operator schedules ahead.
 *
 * A post id BROADCASTS an existing post — referenced, never copied — so the
 * author deleting it empties the announcement in the same moment. The service
 * refuses a post it cannot show with a 404, which the form surfaces rather
 * than publishing a band that would render empty.
 *
 * Empty optional fields are OMITTED, never sent as "": an empty link would be
 * a band that looks tappable and goes nowhere.
 */
export async function createAnnouncement(input: {
  body: string;
  endsAt: string;
  startsAt?: string;
  linkUrl?: string;
  postId?: string;
}) {
  return msApi.post<unknown>("/admin/announcements", {
    body: input.body,
    endsAt: input.endsAt,
    ...(input.startsAt ? { startsAt: input.startsAt } : {}),
    ...(input.linkUrl ? { linkUrl: input.linkUrl } : {}),
    ...(input.postId ? { postId: input.postId } : {}),
  });
}

/** Take a live banner down now, rather than waiting for its own end. */
export async function endAnnouncement(id: string) {
  return msApi.post<unknown>("/admin/announcements/" + id + "/end");
}

export async function fetchAdminProfiles(query: string, cursor?: string) {
  return AdminProfilePageSchema.parse(
    await msApi.authedGet("/admin/profiles", { q: query.trim() || undefined, limit: 30, cursor })
  );
}

// Writes.
export async function resolveRoleApplication(id: string, approve: boolean, note?: string) {
  return msApi.post<unknown>(`/admin/role-applications/${id}/resolve`, {
    approve,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
}

export async function resolveVerificationRequest(
  requestId: string,
  approve: boolean,
  note?: string
) {
  return msApi.post<unknown>(`/admin/verification/${requestId}/resolve`, {
    approve,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
}

/** Direct grant — the platform verifies proactively, so this needs no request. */
export async function setProfileVerification(profileId: string, verified: boolean) {
  return ProfileSchema.parse(
    await msApi.post(`/admin/profiles/${profileId}/verification`, { verified })
  );
}

/**
 * Seat a profile at the head of the people directory, or clear its seat
 * (`rank: null`). The service refuses a rank somebody else holds with a 409
 * naming them — surfaced as-is, because "clear theirs first" is the answer.
 */
export async function setProfileFeaturedRank(profileId: string, rank: number | null) {
  return ProfileSchema.parse(
    await msApi.post(`/admin/profiles/${encodeURIComponent(profileId)}/featured-rank`, { rank })
  );
}

export async function resolveReport(id: string, action: "remove" | "dismiss") {
  return msApi.post<unknown>(`/admin/reports/${id}/resolve`, { action });
}
