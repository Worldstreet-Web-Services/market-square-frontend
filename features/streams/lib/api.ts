"use client";

import { msApi } from "@/lib/api/service";
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
  StreamEventsSchema,
  SpeakerRequestListSchema,
  SpeakerRequestSchema,
  StreamListSchema,
  StreamSchema,
  StreamStatsSchema,
  TicketSchema,
  type StreamCategory,
  type TicketTier,
} from "@/features/streams/lib/types";

// Backend status enum is live | scheduled | ended — "replay" is a UI concept
// (ended + non-null replayUrl), filtered by the caller.
export async function fetchStreams(params: {
  status?: "live" | "scheduled" | "ended";
  category?: StreamCategory;
  /** Topic keys from the viewer's picker; omitted when nothing is chosen. */
  topics?: string[];
  cursor?: string;
  limit?: number;
}) {
  const { topics, ...rest } = params;
  return StreamListSchema.parse(
    await msApi.get("/streams", {
      ...rest,
      // Comma-joined, and omitted entirely when nothing is chosen — an empty
      // `topics=` would read as "match no topics" rather than "no filter".
      ...(topics && topics.length > 0 ? { topics: topics.join(",") } : {}),
    })
  );
}

export async function fetchStream(id: string) {
  return StreamSchema.parse(await msApi.get(`/streams/${id}`));
}

export async function quoteTicket(streamId: string, tier: TicketTier) {
  return QuoteSchema.parse(await msApi.post(`/streams/${streamId}/tickets/quote`, { tier }));
}

export async function purchaseTicket(streamId: string, tier: TicketTier) {
  return TicketSchema.parse(await msApi.post(`/streams/${streamId}/tickets`, { tier }));
}

export async function fetchPlaybackToken(streamId: string) {
  return PlaybackSchema.parse(await msApi.post(`/streams/${streamId}/playback-token`));
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
