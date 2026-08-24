import { z } from "zod";
import { DeepLinkSchema } from "@/lib/api/schemas";

export const DiscoveryResultSchema = z.object({
  id: z.string(),
  type: z.enum(["profile", "stream", "activity", "product", "content"]),
  title: z.string(),
  subtitle: z.string().nullable().optional().default(null),
  status: z.string().nullable().optional().default(null),
  category: z.string().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  href: z.string(),
  actionLabel: z.string().optional().default("View"),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
});

export const DiscoverySchema = z.object({
  items: z.array(DiscoveryResultSchema),
  query: z.string().optional().default(""),
});

export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;
export type DiscoveryType = DiscoveryResult["type"];
