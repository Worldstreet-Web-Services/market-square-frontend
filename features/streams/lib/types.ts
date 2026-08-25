import { z } from "zod";
import { DeepLinkSchema, ProfileSchema } from "@/lib/api/schemas";

// Mirrors the backend contract (openapi.json). Streams carry no owner object
// and no live viewer count in lists; StreamDetail adds viewerCount + myTicket.

export const STREAM_CATEGORIES = ["worldstreet", "music", "podcast", "gaming", "other"] as const;
export type StreamCategory = (typeof STREAM_CATEGORIES)[number];

export const TicketSchema = z.object({
  id: z.string(),
  streamId: z.string().optional().default(""),
  buyerId: z.string().optional().default(""),
  railRef: z.string().nullable().optional().default(null),
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
  refundPolicy: z.string().optional().default("Refunds are available when the host cancels before the stream begins."),
  replayPolicy: z.string().optional().default("Replay access follows the entitlement shown on your ticket."),
  peakViewers: z.number().optional().default(0),
  totalViewSeconds: z.number().optional().default(0),
  createdAt: z.string().optional().default(""),
  // StreamDetail additions; absent on list rows.
  viewerCount: z.number().optional().default(0),
  // Aggregate live reactions. Optional until all gateway deployments expose it.
  likeCount: z.number().optional().default(0),
  pulse: z.object({
    bullish: z.number().optional().default(0),
    neutral: z.number().optional().default(0),
    bearish: z.number().optional().default(0),
  }).optional().default({ bullish: 0, neutral: 0, bearish: 0 }),
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
  captionUrl: z.string().nullable().optional().default(null),
});

export const HeartbeatSchema = z.object({
  sessionId: z.string(),
  watchSeconds: z.number().optional().default(0),
});

// RTMP fields are null on deployments without an RTMP gateway; roomToken +
// url always allow browser publishing via LiveKit.
// Every one of the four is nullable in the spec, `url` and `roomToken`
// included — declaring those two as plain strings meant an explicit null threw
// instead of degrading, which is exactly the case the comment above describes.
export const IngestSchema = z.object({
  rtmpUrl: z.string().nullable().optional().default(null),
  streamKey: z.string().nullable().optional().default(null),
  // Collapsed to "" rather than left nullable so callers keep a plain string
  // and an absent gateway reads as "no ingest", which is what they already test.
  roomToken: z.preprocess((v) => v ?? "", z.string()),
  url: z.preprocess((v) => v ?? "", z.string()),
});

export const GoLiveSchema = z.object({
  stream: StreamSchema,
  ingest: IngestSchema.nullable().optional().default(null),
});

// `StreamMessage` in the spec, which does hydrate `author` and also carries
// `streamId` and a moderation `status` we were dropping — the same removed-
// message field the DM slice was missing.
export const ChatMessageSchema = z.object({
  id: z.string(),
  streamId: z.string().optional().default(""),
  authorId: z.string().optional().default(""),
  text: z.string(),
  status: z.string().optional().default("active"),
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

// `HostStreamEvent` in the spec. The hydrated profile is `profile`, not
// `actor` — the cockpit's activity feed said "Someone" for every event because
// of it. The spec's kinds are ticket_purchased and follow only.
export const StreamEventSchema = z.object({
  id: z.string(),
  kind: z.enum(["ticket_purchased", "follow"]).catch("follow"),
  profile: ProfileSchema.nullable().optional().default(null),
  amountKash: z.string().nullable().optional().default(null),
  occurredAt: z.string(),
});

export const StreamEventsSchema = z.object({
  items: z.array(StreamEventSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

/**
 * `SpeakerRequest` in the served spec.
 *
 * Three fields were wrong at once and each broke something different:
 * `requestedAt` does not exist (it is `createdAt`), so every request-to-join
 * threw; the status enum was missing `denied`/`withdrawn` with no `.catch()`,
 * so those two states threw as well; and the hydrated profile arrives as
 * `profile`, not `user`, so the host's queue rendered "Viewer" for everyone.
 *
 * `joinUrl` / `joinToken` / `expiresAt` ARE in the spec, but only while the
 * request is approved — the service omits them in every other state, which is
 * what makes the publish gate in guest-speaker-control safe. They stay
 * optional here for exactly that reason, not because they are absent.
 * `POST /streams/:id/speaker-token` re-mints the pair when it expires;
 * `playback-token` is subscribe-only and cannot be used to broadcast.
 */
export const SpeakerRequestSchema = z.object({
  id: z.string(),
  streamId: z.string().optional().default(""),
  userId: z.string(),
  // The list endpoint hydrates this as `profile` on top of the base schema.
  profile: ProfileSchema.nullable().optional().default(null),
  status: z
    .enum(["pending", "approved", "denied", "withdrawn", "removed"])
    .catch("pending"),
  createdAt: z.string().optional().default(""),
  resolvedAt: z.string().nullable().optional().default(null),
  resolvedBy: z.string().nullable().optional().default(null),
  joinUrl: z.string().nullable().optional().default(null),
  joinToken: z.string().nullable().optional().default(null),
});

export const SpeakerRequestListSchema = z.object({
  items: z.array(SpeakerRequestSchema),
});

export type StreamStats = z.infer<typeof StreamStatsSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type SpeakerRequest = z.infer<typeof SpeakerRequestSchema>;

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
