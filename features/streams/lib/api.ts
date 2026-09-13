"use client";

import { msApi } from "@/lib/api/service";
import { errorCode } from "@/lib/api/envelope";
import type { DeepLink } from "@/lib/api/schemas";
import {
  ActivityListSchema,
  ActivitySchema,
  ChatMessageSchema,
  ChatSchema,
  GoLiveSchema,
  HeartbeatSchema,
  MyTicketsSchema,
  PlaybackSchema,
  QuoteSchema,
  RemindSchema,
  StreamEventsSchema,
  SpeakerRequestListSchema,
  SpeakerRequestSchema,
  StreamByCodeSchema,
  FollowingRoomsSchema,
  StreamListSchema,
  StreamSchema,
  StreamReactionSchema,
  StreamStatsSchema,
  TicketSchema,
  type StreamCategory,
  type StreamKind,
  type TicketTier,
} from "@/features/streams/lib/types";

// Backend status enum is live | scheduled | ended — "replay" is a UI concept
// (ended + non-null replayUrl), filtered by the caller.
/**
 * Has this deployment refused `sort=listeners` yet?
 *
 * The busiest-first order ships with the service; a deployment that predates it
 * answers 400 VALIDATION_ERROR on `sort`. The FIRST such refusal is remembered
 * for the page load and every later call asks for the default order, so a
 * carousel is never empty on an older server and never pays for a second
 * request once we know. It is only ever set by that exact refusal.
 */
let listenerSortRefused = false;

function refusedListenerSort(error: unknown): boolean {
  const details = (error as { code?: string; details?: unknown } | null)?.details;
  return (
    errorCode(error) === "VALIDATION_ERROR" &&
    Array.isArray(details) &&
    details.some((detail) => (detail as { path?: string } | null)?.path === "sort")
  );
}

export async function fetchStreams(params: {
  status?: "live" | "scheduled" | "ended";
  /**
   * `listeners` — busiest first, ranked within the newest 200 live rooms, ties
   * to the most recently started. The service accepts it only with
   * `status: "live"`; anything else is a 400 by design.
   */
  sort?: "listeners";
  category?: StreamCategory;
  /** Broadcasts or gist rooms — see StreamKind. */
  kind?: StreamKind;
  /** Topic keys from the viewer's picker; omitted when nothing is chosen. */
  topics?: string[];
  cursor?: string;
  limit?: number;
}) {
  const { topics, sort, ...rest } = params;
  const query = {
    ...rest,
    // Comma-joined, and omitted entirely when nothing is chosen — an empty
    // `topics=` would read as "match no topics" rather than "no filter".
    ...(topics && topics.length > 0 ? { topics: topics.join(",") } : {}),
  };
  if (sort && !listenerSortRefused) {
    try {
      return StreamListSchema.parse(await msApi.get("/streams", { ...query, sort }));
    } catch (error) {
      if (!refusedListenerSort(error)) throw error;
      listenerSortRefused = true;
    }
  }
  return StreamListSchema.parse(await msApi.get("/streams", query));
}

export async function fetchStream(id: string) {
  return StreamSchema.parse(await msApi.get(`/streams/${id}`));
}

/**
 * Record a burst of hearts against the stream, and read back the real tally.
 *
 * The floating hearts still travel over the room's data channel — that is what
 * makes them instant and what lets a dropped one simply not appear. This is
 * the other half: the COUNT, which has to survive the moment the animation is
 * about. Without it the header read 0 for the whole broadcast however hard the
 * room tapped, because nothing had ever been asked to count.
 *
 * A burst, not a tap, because callers coalesce: holding the button is one
 * request a second rather than one per heart.
 */
export async function reactToStream(streamId: string, burst: number) {
  return StreamReactionSchema.parse(
    await msApi.post(`/streams/${streamId}/reactions`, { burst })
  );
}

export async function quoteTicket(streamId: string, tier: TicketTier) {
  return QuoteSchema.parse(await msApi.post(`/streams/${streamId}/tickets/quote`, { tier }));
}

export async function purchaseTicket(streamId: string, tier: TicketTier) {
  return TicketSchema.parse(await msApi.post(`/streams/${streamId}/tickets`, { tier }));
}

/**
 * Report the transfer the buyer signed for a ticket.
 *
 * The service RECORDS this and grants nothing: a hash from a client is a
 * claim, not proof, so the ticket stays pending until the watcher observes
 * that transfer paying the treasury the exact price from the buyer's own
 * wallet. Nothing here may tell the buyer they are in.
 */
export async function reportTicketTransfer(streamId: string, ticketId: string, txHash: string) {
  return TicketSchema.parse(
    await msApi.post(`/streams/${streamId}/tickets/${ticketId}/transfer`, { txHash })
  );
}

/**
 * Ask to be told when a scheduled room opens, or take the ask back.
 *
 * Idempotent both ways, and fired by go-live rather than by the clock — so the
 * notification says the room IS open, never that it ought to be. A room that
 * has already ended answers 409: a promise to announce something that is over
 * is one the service cannot keep.
 */
export async function remindStream(streamId: string, remind: boolean) {
  const path = `/streams/${streamId}/remind`;
  return RemindSchema.parse(remind ? await msApi.post(path) : await msApi.del(path));
}

/**
 * Resolve a spoken room code.
 *
 * The input is sent AS TYPED — any case, spacing or dashes — because the
 * service matches leniently and normalising here would give the client and the
 * service two different opinions about what a code is. Encoded, not rewritten.
 *
 * A 404 is the same answer for an unknown code and a malformed one, by design:
 * a refusal that tells them apart tells somebody probing which guesses are
 * worth repeating.
 */
export async function fetchStreamByCode(code: string) {
  return StreamByCodeSchema.parse(
    await msApi.authedGet(`/streams/by-code/${encodeURIComponent(code)}`)
  );
}

export async function fetchPlaybackToken(streamId: string) {
  return PlaybackSchema.parse(await msApi.post(`/streams/${streamId}/playback-token`));
}

/**
 * A LISTEN-ONLY grant for the room card's hover preview — `POST
 * /streams/:id/preview-token`, the same `{ url, token, expiresAt }` shape as
 * the playback grant. Subscribe-only, hidden from the roster, minted on a
 * `preview-<uuid>` identity so previewing a room you are already in cannot
 * evict your real connection. 120s TTL; 404 unknown or private, 409 not a
 * live gist room yet, 429 throttled. Auth optional (the BFF opens it).
 *
 * IT MUST NEVER BE PAIRED WITH A HEARTBEAT: heartbeats feed viewerCount,
 * participants and watch time, and a previewing card would count itself as
 * audience. `use-room-preview.ts` does not import `sendHeartbeat`, and
 * `lib/shell-invariants.test.ts` pins that.
 */
export async function fetchPreviewToken(streamId: string) {
  return PlaybackSchema.parse(await msApi.post(`/streams/${streamId}/preview-token`));
}

export async function sendHeartbeat(streamId: string, sessionId: string | null, mode: "live" | "replay") {
  return HeartbeatSchema.parse(
    await msApi.post(`/streams/${streamId}/heartbeat`, { sessionId: sessionId ?? undefined, mode })
  );
}

export async function fetchChat(streamId: string) {
  return ChatSchema.parse(await msApi.get(`/streams/${streamId}/chat`));
}

export async function sendChat(streamId: string, text: string) {
  return ChatMessageSchema.parse(await msApi.post(`/streams/${streamId}/chat`, { text }));
}

export async function createStream(input: {
  title: string;
  description?: string;
  category: StreamCategory;
  /**
   * Keys from the shared vocabulary (`GET /topics`) — never a hard-coded list.
   * The service validates them against the topics table and rejects an unknown
   * key BY NAME, so a client that invents a chip gets a 400 on submit rather
   * than a silently untagged room.
   */
  topics?: string[];
  /**
   * WHO may find the room. `public` is listed everywhere; `private` is
   * reachable only by members of `houseConversationId`, which the service
   * enforces in its listing queries. Distinct from `visibility`, which is a
   * door charge.
   */
  audience?: "public" | "private";
  /** Required when `audience` is `private`; the caller must be a member. */
  houseConversationId?: string;
  /**
   * WHO MAY TYPE in the room's chat (migration 041). `followers` admits the
   * host, the host's followers, and anyone the host has approved as a speaker;
   * everyone else is refused on SEND. It gates writing only — reading a room's
   * chat is never restricted by this. Defaults to `open`, the historic
   * behaviour, so omitting it changes nothing.
   */
  chatAccess?: "open" | "followers";
  thumbnailUrl?: string;
  scheduledAt?: string;
  visibility: "public" | "ticketed";
  ticketPriceKash?: string;
  vipPriceKash?: string;
}) {
  return StreamSchema.parse(await msApi.post("/streams", input));
}

// POST /streams/:id/go-live answers { stream, ingest } — ingest carries the
// RTMP url/key (and room token) shown once in the studio.
export async function goLive(streamId: string) {
  return GoLiveSchema.parse(await msApi.post(`/streams/${streamId}/go-live`));
}

export async function endStream(streamId: string) {
  return StreamSchema.parse(await msApi.post(`/streams/${streamId}/end`));
}

/**
 * The people you follow who are in a room RIGHT NOW.
 *
 * Authed: it is a statement about the caller's own graph. A 404 means the
 * route is not deployed, which the hook turns into silence rather than an
 * error — an absent rail is the correct rendering of "nobody is around".
 */
export async function fetchFollowingRooms() {
  return FollowingRoomsSchema.parse(await msApi.authedGet("/me/following/rooms"));
}

export async function fetchMyTickets() {
  return MyTicketsSchema.parse(await msApi.authedGet("/me/tickets"));
}

export async function fetchActivities(params: {
  status?: "scheduled" | "live" | "completed" | "cancelled";
  cursor?: string;
  limit?: number;
}) {
  return ActivityListSchema.parse(await msApi.get("/activities", params));
}

export async function createActivity(input: {
  type: "game" | "stream" | "event";
  title: string;
  description?: string;
  startsAt: string;
  deepLink?: DeepLink;
}) {
  return ActivitySchema.parse(await msApi.post("/activities", input));
}

export async function cancelActivity(id: string) {
  return ActivitySchema.parse(await msApi.post(`/activities/${id}/cancel`));
}

export async function updateActivity(id: string, patch: { title?: string; startsAt?: string }) {
  return ActivitySchema.parse(await msApi.patch(`/activities/${id}`, patch));
}

// ---- Studio v2 additions (backend contracts in progress; callers treat
// failures as "not available yet", never as fatal) ----

export async function updateStream(
  id: string,
  patch: {
    title?: string;
    description?: string;
    category?: StreamCategory;
    thumbnailUrl?: string;
    ticketPriceKash?: string;
    vipPriceKash?: string;
  }
) {
  return StreamSchema.parse(await msApi.patch(`/streams/${id}`, patch));
}

export async function fetchStreamStats(id: string) {
  return StreamStatsSchema.parse(await msApi.authedGet(`/streams/${id}/stats`));
}

export async function fetchStreamEvents(id: string, cursor?: string) {
  return StreamEventsSchema.parse(await msApi.authedGet(`/streams/${id}/events`, { cursor }));
}

export async function deleteChatMessage(streamId: string, messageId: string) {
  return msApi.del<{ removed: boolean }>(`/streams/${streamId}/chat/${messageId}`);
}

export async function banFromChat(streamId: string, userId: string) {
  return msApi.post<{ banned: boolean }>(`/streams/${streamId}/bans`, { userId });
}

export async function requestToSpeak(streamId: string) {
  return SpeakerRequestSchema.parse(await msApi.post(`/streams/${streamId}/speaker-requests`));
}

export async function fetchMySpeakerRequest(streamId: string) {
  return SpeakerRequestSchema.nullable().parse(
    await msApi.authedGet(`/streams/${streamId}/speaker-requests/me`)
  );
}

export async function fetchSpeakerRequests(streamId: string) {
  return SpeakerRequestListSchema.parse(
    await msApi.authedGet(`/streams/${streamId}/speaker-requests`)
  );
}

export async function resolveSpeakerRequest(
  streamId: string,
  requestId: string,
  action: "approve" | "decline" | "remove" | "leave"
) {
  return SpeakerRequestSchema.parse(
    await msApi.post(`/streams/${streamId}/speaker-requests/${requestId}/${action}`)
  );
}
