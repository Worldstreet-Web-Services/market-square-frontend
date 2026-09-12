"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { inviteErrorCopy } from "@/features/messages/lib/invites";
import { useAuth } from "@/hooks/use-auth";
import { useRefreshUnread } from "@/hooks/use-unread";
import {
  acceptConversation,
  acceptInvite,
  createInvite,
  fetchInvitePreview,
  addGroupMembers,
  createGroup,
  joinGroup,
  declineConversation,
  deleteConversation,
  fetchConversationMembers,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  openConversation,
  removeGroupMember,
  renameGroup,
  setMemberRole,
  transferOwnership,
  sendMessage,
  fetchHouseNotificationSettings,
  updateHouseNotificationSettings,
} from "@/features/messages/lib/api";
import type { HouseNotificationSettings, OutgoingMessage } from "@/features/messages/lib/types";
import { tabQuery, type InboxTab } from "@/features/messages/lib/filter";

// The service publishes `market-square.message.sent` for the ws-gateway
// without the body, so realtime is only ever a "refetch" signal. Until that
// exists an open thread polls on the same cadence as the live room's chat.
const THREAD_POLL_MS = 5_000;

/**
 * One tab's conversations.
 *
 * The TAB IS IN THE QUERY KEY, so each of the four caches and pages
 * independently. Sharing one key would make switching tabs replay the previous
 * tab's rows under the new tab's name until the refetch landed, and paging
 * would carry a cursor minted for a different filter.
 */
export function useConversations(tab: InboxTab = "all") {
  const { authenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: ["ms", "conversations", tab],
    queryFn: ({ pageParam }) => fetchConversations(pageParam ?? undefined, tabQuery(tab)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: authenticated,
    refetchInterval: 30_000,
  });
}

export function useMessages(conversationId: string, open: boolean) {
  return useQuery({
    queryKey: ["ms", "messages", conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: open && Boolean(conversationId),
    refetchInterval: open ? THREAD_POLL_MS : false,
  });
}

/**
 * The roster behind a group thread's avatars and its members sheet.
 *
 * ONE query for both, deliberately. The bubbles need it to turn a `senderId`
 * into a face, and the sheet needs it to list who is in the room; two queries
 * would poll the same route twice and could disagree about the membership
 * inside one render.
 *
 * `enabled` is the caller's answer to "is this a group", so a 1:1 thread never
 * issues the request at all. No `refetchInterval`: membership changes when
 * somebody adds or removes a person, which is a mutation this client makes or
 * a change the next open picks up — not something worth a 5s poll beside the
 * message poll that already runs.
 */
export function useConversationMembers(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "conversation-members", conversationId],
    queryFn: () => fetchConversationMembers(conversationId),
    enabled: enabled && Boolean(conversationId),
    // A group of 75 does not change between two openings of the same thread.
    staleTime: 60_000,
  });
}

export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  return useMutation({
    mutationFn: (body: OutgoingMessage) => sendMessage(conversationId, body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "messages", conversationId] });
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      refreshUnread();
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't send that message.")),
  });
}

/** Opening a thread is the acknowledgement — the inbox refreshes after it. */
export function useMarkConversationRead() {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  return useMutation({
    mutationFn: markConversationRead,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      refreshUnread();
    },
  });
}

/**
 * Creates a group thread.
 *
 * Invalidates the inbox rather than writing the new row into it: the service
 * decides the group's shape (the creator's `owner` role, the capped member
 * preview, the member count) and a hand-built optimistic row would be a second
 * guess at all three that the next poll silently corrects.
 */
export function useCreateGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      memberIds: string[];
      description?: string;
      imageUrl?: string;
      /** Whether somebody holding the link may join themselves. */
      visibility?: "public" | "private";
    }) => createGroup(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ms", "conversations"] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that group.")),
  });
}

/**
 * Accept or decline a chat request.
 *
 * Both invalidate every conversation list, not just the requests tab: accepting
 * MOVES a row from Gist Requests into All and Gists, so a tab that kept its
 * cached page would show the same conversation in two places at once.
 */
export function useAnswerRequest() {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  const settle = () => {
    client.invalidateQueries({ queryKey: ["ms", "conversations"] });
    refreshUnread();
  };
  const accept = useMutation({
    mutationFn: acceptConversation,
    onSuccess: settle,
    onError: (error) => toast.error(errorMessage(error, "Couldn't accept that request.")),
  });
  const decline = useMutation({
    mutationFn: declineConversation,
    onSuccess: settle,
    onError: (error) => toast.error(errorMessage(error, "Couldn't decline that request.")),
  });
  return { accept, decline };
}

export function useOpenConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: openConversation,
    onSuccess: () => client.invalidateQueries({ queryKey: ["ms", "conversations"] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't open that conversation.")),
  });
}

/**
 * The three group-management mutations behind the thread's overflow menu
 * (nodes 78:8337 and 78:8525).
 *
 * They share one invalidation set because they change the same two things a
 * reader can see: the roster (`conversation-members`) and the inbox row that
 * names and counts it (`conversations`). Splitting them was how a rename
 * landed in the header and not in the list.
 */
function useConversationAction<TVariables>(
  conversationId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
  message: string
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "conversation-members", conversationId] });
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      toast.success(message);
    },
    onError: (error) => toast.error(errorMessage(error, "That didn't work.")),
  });
}

/** "Add gist partners" / "Invite gist partners" — any member may. */
export function useAddGroupMembers(conversationId: string) {
  return useConversationAction<string[]>(
    conversationId,
    (memberIds) => addGroupMembers(conversationId, memberIds),
    "Added to the group"
  );
}

/** "Edit group title" — owner only, enforced by the service. */
export function useRenameGroup(conversationId: string) {
  return useConversationAction<string>(
    conversationId,
    (title) => renameGroup(conversationId, title),
    "Group renamed"
  );
}

/**
 * "Leave group" — `DELETE /conversations/:id/members/:me`.
 *
 * The caller passes their OWN profile id. The same route removes somebody
 * else when the owner names them, so this hook does not hard-code "me": the
 * menu knows who is leaving and the roster sheet may one day know who is being
 * removed.
 */
export function useLeaveGroup(conversationId: string) {
  return useConversationAction<string>(
    conversationId,
    (profileId) => removeGroupMember(conversationId, profileId),
    "You left the group"
  );
}

/** Remove somebody from the house — owner (anyone but themself) or admin (members only). */
export function useRemoveGroupMember(conversationId: string) {
  return useConversationAction<string>(
    conversationId,
    (profileId) => removeGroupMember(conversationId, profileId),
    "Removed from the house"
  );
}

/** "Make admin" / "Remove admin" — owner only. */
export function useSetMemberRole(conversationId: string) {
  return useConversationAction<{ profileId: string; role: "admin" | "member" }>(
    conversationId,
    ({ profileId, role }) => setMemberRole(conversationId, profileId, role),
    "Role updated"
  );
}

/** "Make owner" — the owner hands the house over and stays on as an admin. */
export function useTransferOwnership(conversationId: string) {
  return useConversationAction<string>(
    conversationId,
    (profileId) => transferOwnership(conversationId, profileId),
    "Ownership handed over"
  );
}

const houseSettingsKey = (conversationId: string) =>
  ["ms", "house-notification-settings", conversationId] as const;

/**
 * One house's notification levels. A 404 means the route is not deployed here
 * (or the reader is not a member) — the screen reads it as "coming", never as
 * an error to retry.
 */
export function useHouseNotificationSettings(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: houseSettingsKey(conversationId),
    queryFn: () => fetchHouseNotificationSettings(conversationId),
    enabled: enabled && conversationId.length > 0,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
}

/** Save a house's levels — optimistic, and put back with a toast when refused. */
export function useUpdateHouseNotificationSettings(conversationId: string) {
  const client = useQueryClient();
  const key = houseSettingsKey(conversationId);
  return useMutation({
    mutationFn: (patch: Partial<HouseNotificationSettings>) =>
      updateHouseNotificationSettings(conversationId, patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<HouseNotificationSettings>(key);
      if (previous) client.setQueryData<HouseNotificationSettings>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast.error(errorMessage(error, "Couldn't save that setting."));
    },
    onSuccess: (saved) => {
      client.setQueryData(key, saved);
      // The inbox rows carry the same levels; keep them in step.
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
    },
  });
}

/** "Join House" on Home's community grid — `POST /conversations/:id/join`. */
export function useJoinGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: joinGroup,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      client.invalidateQueries({ queryKey: ["ms", "discover-houses"] });
      toast.success("You're in");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't join that house.")),
  });
}

/**
 * "Share invite link" — makes the token the share sheet carries.
 *
 * A 404 from a member's own thread means the route is not on this server yet,
 * so it says that rather than "not found".
 */
export function useCreateInvite() {
  return useMutation({
    mutationFn: createInvite,
    onError: (error) =>
      toast.error(
        errorCode(error) === "NOT_FOUND"
          ? "Invite links aren't available here yet."
          : errorMessage(error, "Couldn't make an invite link.")
      ),
  });
}

/**
 * The landing page's read. SIGNED-IN STATE IS IN THE KEY: `canJoin` answers
 * for the viewer, so signing in on the page has to ask again.
 */
export function useInvitePreview(token: string) {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "invite", token, authenticated],
    queryFn: () => fetchInvitePreview(token),
    enabled: ready && token.length > 0,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
}

export function useAcceptInvite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: acceptInvite,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      client.invalidateQueries({ queryKey: ["ms", "invite"] });
      toast.success("You're in");
    },
    onError: (error) =>
      toast.error(inviteErrorCopy(error as never) ?? errorMessage(error, "Couldn't join with this link.")),
  });
}

/** "Delete Chat" — removes the thread from YOUR inbox only. See the api note. */
export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      toast.success("Removed from your inbox");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't remove that chat.")),
  });
}
