import { z } from "zod";

export const NotificationSchema = z.object({
  id: z.string(),
  kind: z.enum(["follow", "activity", "stream_live", "ticket", "product", "account"]),
  title: z.string(),
  body: z.string(),
  href: z.string().nullable().optional().default(null),
  read: z.boolean().optional().default(false),
  createdAt: z.string(),
});

export const NotificationListSchema = z.object({ items: z.array(NotificationSchema) });
export type MarketNotification = z.infer<typeof NotificationSchema>;
