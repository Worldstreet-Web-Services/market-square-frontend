import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

/**
 * Admin console contracts.
 *
 * Every /admin route is enforced server-side against `profiles.is_admin`; the
 * dashboard authenticates as an admin USER with a normal Privy token. No
 * internal admin key ever reaches the browser — the gateway strips it anyway.
 *
 * Queues hydrate their subject profile where the service provides one. Where
 * it only sends an id, the row renders the id rather than inventing a name.
 */

/** Tiles on the landing view. Every field is optional: only what the service actually sends is rendered. */
export const AdminStatsSchema = z
  .object({
    profiles: z.number(),
    posts: z.number(),
    streams: z.number(),
    liveStreams: z.number(),
    storeItems: z.number(),
    verifiedProfiles: z.number(),
    openReports: z.number(),
    pendingVerification: z.number(),
    pendingRoleApplications: z.number(),
  })
  .partial();

export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const RoleApplicationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  requestedRole: z.string().optional().default("creator"),
  note: z.string().nullable().optional().default(null),
  status: z.enum(["pending", "approved", "rejected"]).catch("pending"),
  createdAt: z.string().optional().default(""),
  resolvedAt: z.string().nullable().optional().default(null),
  // Hydrated by the service where available; null leaves the row on the id.
  applicant: ProfileSchema.nullable().optional().default(null),
});

export const RoleApplicationPageSchema = z.object({
  items: z.array(RoleApplicationSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const VerificationRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string().optional().default(""),
  status: z.enum(["pending", "approved", "rejected"]).catch("pending"),
  note: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
  resolvedAt: z.string().nullable().optional().default(null),
  applicant: ProfileSchema.nullable().optional().default(null),
});

export const VerificationRequestPageSchema = z.object({
  items: z.array(VerificationRequestSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

// The reported object, hydrated so a moderator can judge without leaving the
// queue. Absent when the content has already been removed.
export const ReportTargetSchema = z.object({
  text: z.string().nullable().optional().default(null),
  mediaUrl: z.string().nullable().optional().default(null),
  author: ProfileSchema.nullable().optional().default(null),
  createdAt: z.string().nullable().optional().default(null),
});

export const ReportSchema = z.object({
  id: z.string(),
  reporterId: z.string().optional().default(""),
  targetType: z.string().optional().default(""),
  targetId: z.string().optional().default(""),
  reason: z.string().optional().default(""),
  note: z.string().nullable().optional().default(null),
  status: z.enum(["open", "actioned", "dismissed"]).catch("open"),
  createdAt: z.string().optional().default(""),
  reporter: ProfileSchema.nullable().optional().default(null),
  target: ReportTargetSchema.nullable().optional().default(null),
});

export const ReportPageSchema = z.object({
  items: z.array(ReportSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

// The people table. Rows are PublicProfile plus the operator-only admin flag.
export const AdminProfilePageSchema = z.object({
  items: z.array(ProfileSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export type RoleApplication = z.infer<typeof RoleApplicationSchema>;
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;
export type AdminReport = z.infer<typeof ReportSchema>;
