"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { baseIdentity } from "@/features/streams/lib/stage";
import { errorMessage } from "@/lib/api/envelope";
import { trackMarketEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { KASH_TOKEN_DECIMALS } from "@/lib/kash-amount";
import { encodeErc20Transfer, toBaseUnits } from "@/lib/erc20";
import { holdKey } from "@/lib/payment-hold";
import { clearHeldPayment, heldPayment, holdPayment } from "@/lib/payment-store";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import { useEvmSend } from "@/hooks/use-evm-send";
import { useKashStatus } from "@/hooks/use-kash-status";
import { isHouse } from "@/features/houses/lib/house";
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
  reportTicketTransfer,
  quoteTicket,
  reactToStream,
  requestToSpeak,
  fetchMySpeakerRequest,
  fetchSpeakerRequests,
  resolveSpeakerRequest,
} from "@/features/streams/lib/api";
import type { Stream, TicketTier } from "@/features/streams/lib/types";
import {
  createReactionBuffer,
  type ReactionBuffer,
} from "@/features/streams/lib/reaction-buffer";

/**
 * A stream's lifecycle moves more than the stream list.
 *
 * Going live, ending, editing or creating one changes the Live lane of the
 * home feed and the Featured Arena hero (both read `["ms","feed"]`), the
 * studio's own list and the public rails (`["ms","streams"]` covers every
 * section and the owner-filtered view). Only invalidating the stream list was
 * why a creator's own home feed still showed them offline after going live.
 */
function invalidateStreamSurfaces(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
  queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
}

// "replay" is a UI-layer concept: the backend only knows live | scheduled |
// ended, so replays are ended streams with a replayUrl.
export function useStreamList(
  section: "live" | "scheduled" | "replay",
  topics: string[] = []
) {
  const status = section === "replay" ? "ended" : section;
  // Sorted so the same selection always produces the same cache key.
  const key = [...topics].sort().join(",");
  return useQuery({
    queryKey: ["ms", "streams", section, key],
    queryFn: async () => {
      const page = await fetchStreams({ status, topics });
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

/**
 * Record hearts against the stream's tally.
 *
 * The tally used to be unmovable: hearts were published on the room's data
 * channel and nowhere else, so `likeCount` — a field the service did not even
 * return — sat at 0 for the whole broadcast. Tapping felt like it did nothing
 * because, as far as anything that outlived the animation was concerned, it
 * did.
 *
 * OPTIMISTIC then RECONCILED. The number moves on the tap, because a counter
 * that waits for a round trip to acknowledge your own tap is exactly the lag
 * this is meant to remove. What comes back is the SERVICE's total — which
 * includes every other viewer's hearts, so it is the only number that can be
 * right — and it replaces the guess rather than adding to it. A failed write
 * rolls its own bump back, so the tally cannot drift upward on requests that
 * never landed.
 *
 * Taps are pooled by `createReactionBuffer`, so hammering the button is one
 * request a second rather than one per heart.
 *
 * Silent on failure. A heart is not a transaction, and a toast apologising for
 * one is louder than the thing it is apologising for.
 */
export function useRecordReactions(streamId: string) {
  const queryClient = useQueryClient();

  const bump = useCallback(
    (delta: number) => {
      queryClient.setQueryData(["ms", "stream", streamId], (old: Stream | undefined) =>
        old ? { ...old, likeCount: Math.max(0, old.likeCount + delta) } : old
      );
    },
    [queryClient, streamId]
  );

  const { mutate } = useMutation({
    mutationFn: (burst: number) => reactToStream(streamId, burst),
    onSuccess: (result) => {
      // The service's count, not ours plus ours: other people are tapping too.
      queryClient.setQueryData(["ms", "stream", streamId], (old: Stream | undefined) =>
        old ? { ...old, likeCount: result.likeCount } : old
      );
    },
    onError: (_error, burst) => {
      bump(-burst);
    },
  });

  // One buffer per stream, kept across renders — a new one per render would
  // pool nothing, since each would hold a single tap and flush it alone.
  const bufferRef = useRef<ReactionBuffer | null>(null);
  if (bufferRef.current === null) {
    bufferRef.current = createReactionBuffer({ send: (burst) => mutate(burst) });
  }
  useEffect(() => {
    const buffer = bufferRef.current;
    return () => buffer?.dispose();
  }, []);

  return useCallback(
    (burst = 1) => {
      // Bump by what the buffer actually took, so the tally on screen and the
      // count on its way to the service can never disagree.
      bump(bufferRef.current?.add(burst) ?? 0);
    },
    [bump]
  );
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

/**
 * Buy a ticket — settling it yourself where the service cannot.
 *
 * Mirrors the tip flow deliberately, down to the held payment: a ticket that
 * comes back carrying `toWallet` is NOT paid for, and the buyer's own wallet
 * has to sign a transfer to that address. Where the rail settles server-side
 * the response has no wallet and this is the single request it always was.
 *
 * The hash is written down BEFORE the confirmation wait. From the moment the
 * transfer is broadcast, the only thing that makes a retry safe is that the
 * hash and the ticket it belongs to were recorded first — otherwise a retry
 * opens a second ticket and the buyer pays twice for one seat.
 */
export function usePurchaseTicket(streamId: string) {
  const queryClient = useQueryClient();
  const { address: wallet } = useEmbeddedWallet();
  const { send, waitForReceipt } = useEvmSend();
  const chain = useKashStatus().data?.chain ?? null;

  return useMutation({
    mutationFn: async (tier: TicketTier) => {
      const created = await purchaseTicket(streamId, tier);

      // Rail settlement, or a ticket this buyer already holds: nothing to sign.
      if (!created.toWallet || created.status === "confirmed") return created;

      if (!wallet) throw new Error("Sign in to buy a ticket.");
      if (!chain?.tokenAddress) {
        // Without the engine's own token address there is nothing to transfer,
        // and guessing one sends real money into nothing.
        throw new Error("Ticketing isn't configured on this environment yet.");
      }

      const key = holdKey(`ticket:${streamId}:${tier}`, created.priceKash);
      // A payment a previous attempt made and failed to report.
      const held = key ? heldPayment("ticket", wallet, key) : null;
      let txHash = (held?.txHash ?? null) as `0x${string}` | null;

      if (!txHash) {
        txHash = await send({
          to: chain.tokenAddress as `0x${string}`,
          // The TOKEN's precision, not the API's — see KASH_TOKEN_DECIMALS.
          data: encodeErc20Transfer(
            created.toWallet,
            toBaseUnits(created.priceKash, KASH_TOKEN_DECIMALS)
          ),
          chainId: chain.chainId,
        });
        if (key) holdPayment("ticket", wallet, { key, txHash, ref: created.id });

        const outcome = await waitForReceipt(txHash, chain.chainId);
        if (outcome === "reverted") {
          // Nothing moved, so nothing may be reported as payment.
          clearHeldPayment("ticket", wallet);
          throw new Error("The transfer failed on-chain. Nothing was sent.");
        }
      }

      const reported = await reportTicketTransfer(streamId, created.id, txHash);
      // Reported: the service owns it now and a retry must not re-report it.
      clearHeldPayment("ticket", wallet);
      return reported;
    },
    onSuccess: (ticket) => {
      trackMarketEvent("ticket_purchased", { surface: "ticket_checkout", entityType: "stream", entityId: streamId, accessType: ticket.tier });
      trackMarketEvent("entitlement_issued", { surface: "ticket_checkout", entityType: "ticket", entityId: ticket.id });
      // ["ms","stream", id] is a PREFIX of the playback-token key, so this one
      // call also drops the cached 403 that was gating the player — without it
      // the buyer stayed locked out of a stream they had just paid for.
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId] });
      queryClient.invalidateQueries({ queryKey: ["ms", "my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
      /**
       * "On its way", never "confirmed", on a ticket the chain has not settled.
       *
       * A client-signed ticket stays `pending` until the watcher observes the
       * transfer, so telling the buyer to enjoy a stream they cannot open yet
       * is the one claim this flow may not make.
       */
      toast.success(
        ticket.status === "confirmed"
          ? "Ticket confirmed — enjoy the stream."
          : "Payment sent — your ticket unlocks once it confirms."
      );
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
    onSuccess: (stream) => {
      invalidateStreamSurfaces(queryClient);
      /*
        A house is not a stream, and the person who just opened one should not
        be told it is. One mutation creates both — a house IS a stream with
        `category: "house"` — so the confirmation reads off what was actually
        made rather than off the function that made it.
      */
      toast.success(isHouse(stream) ? "House opened" : "Stream created");
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
      invalidateStreamSurfaces(queryClient);
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
      // The playback token and chat live under this prefix and are both dead
      // once the broadcast stops.
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", stream.id] });
      invalidateStreamSurfaces(queryClient);
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
      // Activities are rendered as feed items and in the Featured Arena.
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
      // ...and in /live's Upcoming tab, which reads the stream list alongside
      // the activity list. Without this the newly scheduled item sat behind a
      // stale cache until that query happened to refetch.
      queryClient.invalidateQueries({ queryKey: ["ms", "streams"] });
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
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
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
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
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
      invalidateStreamSurfaces(queryClient);
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

/**
 * How often a live room asks about things that change on human timescales.
 *
 * Both of these polled every 3 seconds. Nobody raises a hand twenty times a
 * minute, and nobody notices the difference between a 3-second and an
 * 8-second answer to "has the host let me speak yet" — but the machine
 * notices: at 3s each open room made 40 requests a minute per query, every one
 * of them a serverless invocation, and during an outage each of those became
 * a function sitting on a dead upstream. This is the single heaviest thing the
 * app does when everything is WORKING, which is why it is tuned rather than
 * only guarded.
 *
 * The real fix is the socket gateway that already exists for streams; this is
 * the honest interim, and it is written down so the next person knows which
 * one this is.
 */
const SPEAKER_POLL_MS = 8_000;

export function useMySpeakerRequest(streamId: string, enabled: boolean) {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "stream", streamId, "speaker-request", "me"],
    queryFn: () => fetchMySpeakerRequest(streamId),
    enabled: enabled && ready && authenticated,
    retry: false,
    refetchInterval: enabled ? SPEAKER_POLL_MS : false,
  });
}

export function useRequestToSpeak(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestToSpeak(streamId),
    onSuccess: (request) => {
      queryClient.setQueryData(["ms", "stream", streamId, "speaker-request", "me"], request);
      // The host's queue is a different query; without this the request only
      // appeared on their next 3 s poll.
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "speaker-requests"] });
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
    refetchInterval: enabled ? SPEAKER_POLL_MS : false,
  });
}

/**
 * Take a guest off the stage, by LiveKit identity.
 *
 * Shared because the host has TWO surfaces — the studio cockpit they broadcast
 * from and the watch page they may be moderating from — and the removal is the
 * same act on both: find that identity's approved speaker-request and resolve
 * it with `remove`. The backend drops the publish grant, LiveKit unpublishes
 * their tracks, and the stage loses the slot on the next
 * ParticipantPermissionsChanged. This lived inline in the cockpit; a second
 * copy on the watch page is how one of them quietly stops matching the other.
 *
 * `enabled` gates the underlying request poll, so a viewer who is not the host
 * never opens it.
 */
export function useRemoveGuest(streamId: string, enabled: boolean) {
  const requests = useSpeakerRequests(streamId, enabled);
  const resolve = useResolveSpeakerRequest(streamId);
  const remove = (identity: string) => {
    // The tile hands us the LiveKit identity, which for an approved speaker is
    // `<did>#speaker`; the request is keyed on the bare DID. Comparing them raw
    // never matched, so removing a guest always failed with "couldn't find
    // that guest's request" while the guest stayed on stage.
    const userId = baseIdentity(identity);
    const request = requests.data?.items.find(
      (item) => baseIdentity(item.userId) === userId && item.status === "approved"
    );
    // Not an assertion failure: the guest may have left a moment ago, and the
    // poll has not caught up. Say so rather than throwing.
    if (!request) {
      toast.error("Couldn't find that guest's request.");
      return;
    }
    resolve.mutate({ requestId: request.id, action: "remove" });
  };
  return { remove, removing: resolve.isPending };
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
