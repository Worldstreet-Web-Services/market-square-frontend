import { z } from "zod";
import { DeepLinkSchema, ProfileSchema } from "@/lib/api/schemas";

// Mirrors the backend contract (openapi.json). Streams carry no owner object
// and no live viewer count in lists; StreamDetail adds viewerCount + myTicket.

export const STREAM_CATEGORIES = ["worldstreet", "music", "podcast", "gaming", "other"] as const;
export type StreamCategory = (typeof STREAM_CATEGORIES)[number];

export const TicketSchema = z.object({
  id: z.string(),
  streamId: z.string().optional().default(""),
  tier: z.enum(["standard", "vip"]).catch("standard"),
  priceKash: z.string(),
  currency: z.string().optional().default("KASH"),
  status: z.enum(["pending", "confirmed", "failed", "refunded"]).catch("confirmed"),
  createdAt: z.string().optional().default(""),
  confirmedAt: z.string().nullable().optional().default(null),
});

export const StreamSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  owner: ProfileSchema.nullable().optional().default(null),
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  category: z.string().optional().default("other"),
  status: z.enum(["scheduled", "live", "ended", "cancelled"]).catch("scheduled"),
  visibility: z.enum(["public", "ticketed"]).catch("public"),
  ticketPriceKash: z.string().nullable().optional().default(null),
  vipPriceKash: z.string().nullable().optional().default(null),
  vipEarlyAccessMinutes: z.number().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  scheduledAt: z.string().nullable().optional().default(null),
  startedAt: z.string().nullable().optional().default(null),
  endedAt: z.string().nullable().optional().default(null),
  replayUrl: z.string().nullable().optional().default(null),
  peakViewers: z.number().optional().default(0),
  totalViewSeconds: z.number().optional().default(0),
  createdAt: z.string().optional().default(""),
  // StreamDetail additions; absent on list rows.
  viewerCount: z.number().optional().default(0),
  myTicket: TicketSchema.nullable().optional().default(null),
});

export const StreamListSchema = z.object({
  items: z.array(StreamSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const QuoteSchema = z.object({
  streamId: z.string().optional().default(""),
  tier: z.string().optional().default("standard"),
  priceKash: z.string(),
  expiresAt: z.string(),
});

export const PlaybackSchema = z.object({
  url: z.string(),
  token: z.string(),
  expiresAt: z.string(),
});

export const HeartbeatSchema = z.object({
  sessionId: z.string(),
  watchSeconds: z.number().optional().default(0),
});

// RTMP fields are null on deployments without an RTMP gateway; roomToken +
// url always allow browser publishing via LiveKit.
export const IngestSchema = z.object({
  rtmpUrl: z.string().nullable().optional().default(null),
  streamKey: z.string().nullable().optional().default(null),
  roomToken: z.string().optional().default(""),
  url: z.string().optional().default(""),
});

export const GoLiveSchema = z.object({
  stream: StreamSchema,
  ingest: IngestSchema.nullable().optional().default(null),
});

// StreamMessage carries only authorId; no hydrated author.
export const ChatMessageSchema = z.object({
  id: z.string(),
  authorId: z.string().optional().default(""),
  text: z.string(),
  createdAt: z.string(),
  author: ProfileSchema.nullable().optional().default(null),
});

export const ChatSchema = z.object({
  items: z.array(ChatMessageSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const ActivitySchema = z.object({
  id: z.string(),
  hostId: z.string().optional().default(""),
  type: z.enum(["game", "stream", "event"]).catch("event"),
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  startsAt: z.string(),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).catch("scheduled"),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
  owner: ProfileSchema.nullable().optional().default(null),
});

export const ActivityListSchema = z.object({
  items: z.array(ActivitySchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const MyTicketSchema = TicketSchema.extend({
  stream: StreamSchema.nullable().optional().default(null),
});

// GET /me/tickets returns a BARE ARRAY; the preprocess also accepts a
// wrapped { tickets: [...] } so older payloads keep parsing.
export const MyTicketsSchema = z.preprocess(
  (value) =>
    Array.isArray(value) ? { tickets: value } : (value ?? { tickets: [] }),
  z.object({ tickets: z.array(MyTicketSchema) })
);

// Owner-only telemetry (backend in progress — UI degrades gracefully).
export const StreamStatsSchema = z.object({
  peakViewers: z.number().optional().default(0),
  uniqueViewers: z.number().optional().default(0),
  totalViewSeconds: z.number().optional().default(0),
  messages: z.number().optional().default(0),
  ticketsSold: z.number().optional().default(0),
  kashEarned: z.string().nullable().optional().default(null),
});

export const StreamEventSchema = z.object({
  id: z.string(),
  kind: z.enum(["ticket_purchased", "follow", "viewer_joined"]).catch("viewer_joined"),
  actor: ProfileSchema.nullable().optional().default(null),
  amountKash: z.string().nullable().optional().default(null),
  occurredAt: z.string(),
});

export const StreamEventsSchema = z.object({
  items: z.array(StreamEventSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export type StreamStats = z.infer<typeof StreamStatsSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export type Stream = z.infer<typeof StreamSchema>;
export type Ticket = z.infer<typeof TicketSchema>;
export type TicketQuote = z.infer<typeof QuoteSchema>;
export type Playback = z.infer<typeof PlaybackSchema>;
export type Ingest = z.infer<typeof IngestSchema>;
export type GoLiveResult = z.infer<typeof GoLiveSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type MyTicket = z.infer<typeof MyTicketSchema>;
export type TicketTier = "standard" | "vip";
