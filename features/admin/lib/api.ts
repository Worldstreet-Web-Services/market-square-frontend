import { msApi } from "@/lib/api/service";
import { ProfileSchema, type OrgBadge } from "@/lib/api/schemas";
import {
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

/** `null` clears the badge. */
export async function setProfileOrgBadge(profileId: string, badge: OrgBadge) {
  return ProfileSchema.parse(await msApi.post(`/admin/profiles/${profileId}/org-badge`, { badge }));
}

export async function resolveReport(id: string, action: "remove" | "dismiss") {
  return msApi.post<unknown>(`/admin/reports/${id}/resolve`, { action });
}
