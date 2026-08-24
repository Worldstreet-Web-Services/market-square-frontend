"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { trackMarketEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import {
  banFromChat,
  cancelActivity,
  deleteChatMessage,
  fetchStreamEvents,
  fetchStreamStats,
  updateStream,
  updateActivity,
  createActivity,
  createStream,
  endStream,
  fetchActivities,
  fetchMyTickets,
  fetchStream,
  fetchStreams,
  goLive,
  purchaseTicket,
  quoteTicket,
  requestToSpeak,
  fetchMySpeakerRequest,
  fetchSpeakerRequests,
  resolveSpeakerRequest,
} from "@/features/streams/lib/api";
import type { Stream, TicketTier } from "@/features/streams/lib/types";

// "replay" is a UI-layer concept: the backend only knows live | scheduled |
// ended, so replays are ended streams with a replayUrl.
export function useStreamList(section: "live" | "scheduled" | "replay") {
  const status = section === "replay" ? "ended" : section;
  return useQuery({
    queryKey: ["ms", "streams", section],
    queryFn: async () => {
      const page = await fetchStreams({ status });
      if (section !== "replay") return page;
      return { ...page, items: page.items.filter((stream) => stream.replayUrl !== null) };
    },
    refetchInterval: section === "live" ? 30_000 : false,
  });
}

// The room polls the detail to refresh viewerCount and status. Pass a number
// for a custom interval (the cockpit polls at 5 s per spec).
export function useStream(id: string, poll: boolean | number = false) {
  return useQuery({
    queryKey: ["ms", "stream", id],
    queryFn: () => fetchStream(id),
    refetchInterval: poll === false ? false : poll === true ? 10_000 : poll,
  });
}

export function useTicketQuote(streamId: string, tier: TicketTier, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "stream", streamId, "quote", tier],
    queryFn: () => quoteTicket(streamId, tier),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function usePurchaseTicket(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tier: TicketTier) => purchaseTicket(streamId, tier),
    onSuccess: (ticket) => {
      trackMarketEvent("ticket_purchased", { surface: "ticket_checkout", entityType: "stream", entityId: streamId, accessType: ticket.tier });
      trackMarketEvent("entitlement_issued", { surface: "ticket_checkout", entityType: "ticket", entityId: ticket.id });
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId] });
      queryClient.invalidateQueries({ queryKey: ["ms", "my-tickets"] });
      toast.success("Ticket confirmed — enjoy the stream.");
    },
  });
}

export function useMyTickets() {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "my-tickets"],
    queryFn: fetchMyTickets,
    enabled: ready && authenticated,
  });
}

// The backend has no owner filter on GET /streams, so "my streams" is every
// status list filtered to the signed-in owner.
export function useMyStreams() {
  const me = useMe();
  const ownerId = me.data?.id;
  return useQuery({
    queryKey: ["ms", "streams", "mine", ownerId],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      const pages = await Promise.all([
        fetchStreams({ status: "live" }),
        fetchStreams({ status: "scheduled" }),
        fetchStreams({ status: "ended" }),
      ]);
      const items = pages
        .flatMap((page) => page.items)
        .filter((stream) => stream.ownerId === ownerId);
      return { items, nextCursor: null as string | null };
    },
  });
}

export function useCreateStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createStream,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
      toast.success("Stream created");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create the stream.")),
  });
}

export function useGoLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: goLive,
    onSuccess: ({ stream }) => {
      queryClient.setQueryData<Stream>(["ms", "stream", stream.id], stream);
      queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
      toast.success("You're live");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't go live.")),
  });
}

export function useEndStream() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: endStream,
    onSuccess: (stream) => {
      queryClient.setQueryData(["ms", "stream", stream.id], stream);
      queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
      toast.success("Stream ended");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't end the stream.")),
  });
}

export function useActivities(status: "scheduled" | "live" | "completed" | "cancelled" = "scheduled") {
  return useQuery({
    queryKey: ["ms", "activities", status],
    queryFn: () => fetchActivities({ status }),
  });
}

// No owner filter upstream: "my activities" is the scheduled list filtered to
// the signed-in host.
export function useMyActivities() {
  const me = useMe();
  const hostId = me.data?.id;
  return useQuery({
    queryKey: ["ms", "activities", "mine", hostId],
    enabled: Boolean(hostId),
    queryFn: async () => {
      const page = await fetchActivities({ status: "scheduled" });
      return { ...page, items: page.items.filter((activity) => activity.hostId === hostId) };
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createActivity,
    onSuccess: (activity) => {
      trackMarketEvent("activity_scheduled", { surface: "schedule", entityType: "activity", entityId: activity.id });
      queryClient.invalidateQueries({ queryKey: ["ms", "activities"] });
      toast.success("Activity scheduled");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't schedule that.")),
  });
}

export function useCancelActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "activities"] });
      toast.success("Activity cancelled");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't cancel that.")),
  });
}

export function useUpdateActivity(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { title?: string; startsAt?: string }) => updateActivity(activityId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "activities"] });
      toast.success("Activity updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update that activity.")),
  });
}

// ---- Studio v2 ----

export function useUpdateStream(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateStream>[1]) => updateStream(streamId, patch),
    onSuccess: (stream) => {
      queryClient.setQueryData(["ms", "stream", streamId], (old: Stream | undefined) =>
        old ? { ...old, ...stream, myTicket: old.myTicket, viewerCount: old.viewerCount } : stream
      );
      queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
      toast.success("Stream updated");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save changes.")),
  });
}

// Stats and events are owner-only and still shipping server-side: a failure
// means "not available yet", surfaced as a quiet placeholder — never retried
// aggressively, never faked.
export function useStreamStats(streamId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "stream", streamId, "stats"],
    queryFn: () => fetchStreamStats(streamId),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export function useStreamEvents(streamId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "stream", streamId, "events"],
    queryFn: () => fetchStreamEvents(streamId),
    enabled,
    retry: false,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function useDeleteChatMessage(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => deleteChatMessage(streamId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "chat"] });
      toast.success("Message removed");
    },
    onError: (error) => toast.error(errorMessage(error, "Moderation isn't available yet.")),
  });
}

export function useBanFromChat(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => banFromChat(streamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "chat"] });
      toast.success("Banned from chat");
    },
    onError: (error) => toast.error(errorMessage(error, "Moderation isn't available yet.")),
  });
}

export function useMySpeakerRequest(streamId: string, enabled: boolean) {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "stream", streamId, "speaker-request", "me"],
    queryFn: () => fetchMySpeakerRequest(streamId),
    enabled: enabled && ready && authenticated,
    retry: false,
    refetchInterval: enabled ? 3_000 : false,
  });
}

export function useRequestToSpeak(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestToSpeak(streamId),
    onSuccess: (request) => {
      queryClient.setQueryData(["ms", "stream", streamId, "speaker-request", "me"], request);
      toast.success("Request sent to the host");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't request to speak.")),
  });
}

export function useSpeakerRequests(streamId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "stream", streamId, "speaker-requests"],
    queryFn: () => fetchSpeakerRequests(streamId),
    enabled,
    retry: false,
    refetchInterval: enabled ? 3_000 : false,
  });
}

export function useResolveSpeakerRequest(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: "approve" | "decline" | "remove" | "leave" }) =>
      resolveSpeakerRequest(streamId, requestId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "speaker-requests"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "speaker-request", "me"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update the speaker.")),
  });
}
