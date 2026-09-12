import { z } from "zod";
import { DeepLinkSchema, ProfileSchema } from "@/lib/api/schemas";

// Mirrors the backend contract (openapi.json). Streams carry no owner object
// and no live viewer count in lists; StreamDetail adds viewerCount + myTicket.

/**
 * Every category a stream object can carry, "house" included.
 *
 * A house IS a stream — same room, same tokens, same speaker requests — told
 * apart only by this field (features/houses/lib/house.ts). It is in the union
 * so a house parses, is compared and is filtered like anything else.
 *
 * It is NOT in `BROADCAST_CATEGORIES`, which is what every picker renders. A
 * house is opened from "Open a gist room", never chosen from the Go Live sheet's
 * dropdown: picking "house" there would create a room whose whole surface —
 * the ring, the audience band, the audio-only publisher — lives on a different
 * route, and the creator would land in a video cockpit for a room with no
 * video. Two lists, because they answer two different questions: what can
 * arrive, and what can be chosen.
 */
export const STREAM_CATEGORIES = [
  "worldstreet",
  "music",
  "podcast",
  "gaming",
  "other",
  "house",
] as const;
export type StreamCategory = (typeof STREAM_CATEGORIES)[number];

/**
 * What kind of live thing, as opposed to what it is about.
 *
 * `broadcast` is every stream except a house; `room` is a gist room. The
 * distinction exists because a room IS a stream — same table, same chat — and
 * `category` can name one but cannot exclude one. See `useStreamList`.
 */
export type StreamKind = "broadcast" | "room";

/** The categories a BROADCAST picker offers. See above for why "house" is absent. */
export const BROADCAST_CATEGORIES = STREAM_CATEGORIES.filter(
  (category) => category !== "house"
) as readonly Exclude<StreamCategory, "house">[];

import { StreamSchema, TicketSchema } from "@/lib/api/schemas";
export { StreamSchema, TicketSchema };
export type { Stream, Ticket } from "@/lib/api/schemas";


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
/**
 * The stream's running heart tally, after the burst just recorded.
 *
 * The SERVICE's total, not a local sum: hearts arrive from every viewer in the
 * room, so the only number that can be right is the one the service kept.
 */
export const StreamReactionSchema = z.object({
  likeCount: z.number(),
});

export const IngestSchema = z.object({
  rtmpUrl: z.string().nullable().optional().default(null),
  streamKey: z.string().nullable().optional().default(null),
  // Collapsed to "" rather than left nullable so callers keep a plain string
  // and an absent gateway reads as "no ingest", which is what they already test.
  roomToken: z.preprocess((v) => v ?? "", z.string()),
  url: z.preprocess((v) => v ?? "", z.string()),
});

/** `POST|DELETE /streams/:id/remind` — both answer the resulting state. */
export const RemindSchema = z.object({ reminded: z.boolean() });

/**
 * `GET /streams/by-code/:code` — what a spoken code resolves to.
 *
 * `access` is the SERVER's answer to "may this person go in", and it has to be:
 * it depends on house membership, which is exactly the fact a non-member must
 * not receive. A client cannot compute it from the payload without being handed
 * the roster it is not allowed to see.
 *
 *   · `open`         — go in.
 *   · `members_only` — a private room they are not in. The payload is the
 *                      DOORPLATE: title, picture, owner, status. `viewerCount`
 *                      and `houseConversationId` come back null on purpose;
 *                      the refusal itself lives at the join.
 *   · `over`         — ended or cancelled. It resolves rather than 404ing so
 *                      somebody holding a written-down code is told the room is
 *                      over instead of being left unable to tell that from a
 *                      typo. Codes are never reused, so an old note can never
 *                      open a different room.
 */
export const StreamByCodeSchema = z.object({
  stream: StreamSchema,
  access: z.enum(["open", "members_only", "over"]).catch("open"),
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

export type TicketQuote = z.infer<typeof QuoteSchema>;
export type Playback = z.infer<typeof PlaybackSchema>;
export type Ingest = z.infer<typeof IngestSchema>;
export type GoLiveResult = z.infer<typeof GoLiveSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type MyTicket = z.infer<typeof MyTicketSchema>;
export type TicketTier = "standard" | "vip";
