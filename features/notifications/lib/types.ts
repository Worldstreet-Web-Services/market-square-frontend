import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

// The service's notification kinds. `catch` keeps an unknown future kind from
// failing the whole page — it renders with the neutral glyph instead.
export const NotificationKindSchema = z
  .enum([
    "follow",
    "like",
    "comment",
    "repost",
    "bookmark",
    "ticket_purchased",
    "stream_live",
    "verification_resolved",
    "role_resolved",
  ])
  .catch("follow");

export const NotificationSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  // Hydrated on every read, but a deleted account can leave it null.
  actor: ProfileSchema.nullable().optional().default(null),
  postId: z.string().nullable().optional().default(null),
  streamId: z.string().nullable().optional().default(null),
  // Null until the notification has been read.
  readAt: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

export const NotificationPageSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().optional().default(0),
  nextCursor: z.string().nullable().optional().default(null),
});

export const ReadResultSchema = z.object({
  unreadCount: z.number().optional().default(0),
});

export type MarketNotification = z.infer<typeof NotificationSchema>;
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
