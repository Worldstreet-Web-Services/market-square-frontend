import { msApi } from "@/lib/api/service";
import {
  ConversationMemberPageSchema,
  ConversationPageSchema,
  ConversationRefSchema,
  GroupRefSchema,
  MessagePageSchema,
  MessageSchema,
  ReadResultSchema,
  InvitePreviewSchema,
  InviteSchema,
} from "@/features/messages/lib/types";
import {
  buildMessagePayload,
  type OutgoingMessage,
} from "@/features/messages/lib/outgoing";

/** Idempotent from either side — returns the existing thread when there is one.
    Answers the bare `Conversation` record, not a `ConversationSummary`. */
export async function openConversation(userId: string) {
  return ConversationRefSchema.parse(await msApi.post("/conversations", { userId }));
}

export async function fetchConversations(
  cursor?: string,
  filter: { kind?: "direct" | "group"; state?: "pending" } = {}
) {
  return ConversationPageSchema.parse(
    await msApi.authedGet("/me/conversations", {
      limit: 30,
      cursor,
      // Undefined keys are dropped by the client, so `All` sends neither and
      // gets the service's own default (accepted, both kinds).
      kind: filter.kind,
      state: filter.state,
    })
  );
}

/**
 * Answer a chat request. Only the person who did NOT ask may do either.
 *
 * Declining DELETES the conversation and tells the sender nothing — a decline
 * that reports itself is a decline nobody will use — so it is not undoable and
 * the row goes rather than changing state.
 */
export async function acceptConversation(conversationId: string) {
  return ConversationRefSchema.parse(
    await msApi.post(`/conversations/${conversationId}/accept`)
  );
}

export async function declineConversation(conversationId: string) {
  // POST, not DELETE: the service models this as an action on the request, and
  // it answers 204 — a success with no body.
  await msApi.post(`/conversations/${conversationId}/decline`);
}

export async function fetchMessages(conversationId: string, cursor?: string) {
  return MessagePageSchema.parse(
    await msApi.authedGet(`/conversations/${conversationId}/messages`, { limit: 50, cursor })
  );
}

/**
 * Sends a message: words, an attachment, or both.
 *
 * The attachment is sent as `media.url`, and that URL must be one the SERVICE
 * issued — the client uploads through `/uploads/*` first and sends back the
 * `publicUrl` it got. Anything else is refused (403 for somebody else's
 * upload, 400 for a URL the service would never have minted), which is what
 * stops a private thread being made to load an arbitrary remote asset.
 *
 * There is deliberately no `kind` field: the service derives it from the
 * object it stored, so a client cannot label a clip as a voice note. Empty
 * halves are DROPPED rather than sent as null — a caption-less photo is
 * `{ media }`, and the service treats a missing `text` and an empty one
 * identically, so sending `text: ""` beside media would only be noise.
 */
export async function sendMessage(conversationId: string, body: OutgoingMessage) {
  return MessageSchema.parse(
    await msApi.post(`/conversations/${conversationId}/messages`, buildMessagePayload(body))
  );
}

/**
 * Creates a named group and returns the bare conversation record.
 *
 * The creator becomes its OWNER (the only member who may rename it or remove
 * somebody) and is added by the service — `memberIds` is everybody else, which
 * is why the picker never includes the caller in its selection.
 */
export async function createGroup(input: {
  title: string;
  memberIds: string[];
  description?: string;
  imageUrl?: string;
  /**
   * Whether somebody holding the group's link may JOIN it themselves
   * (`POST /conversations/:id/join`). It deliberately does NOT mean "listed in
   * a directory" — there is no group directory. Defaults to `private`
   * service-side, which is what every group already was.
   */
  visibility?: "public" | "private";
}) {
  return GroupRefSchema.parse(
    await msApi.post("/conversations/groups", {
      title: input.title.trim(),
      memberIds: input.memberIds,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      // Omitted rather than sent empty: the service reads an absent field as
      // "leave it" and a blank one as "clear it", and a brand-new group has
      // nothing to clear.
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    })
  );
}

export async function markConversationRead(conversationId: string) {
  return ReadResultSchema.parse(await msApi.post(`/conversations/${conversationId}/read`));
}

/**
 * The full member roster of a group thread.
 *
 * `ConversationSummary.members` is capped at four by the service — it is the
 * header's preview, not the membership — so anything that has to resolve an
 * arbitrary `senderId` to a face, or list who is in the room, reads this.
 * Called only for `kind: "group"`: a 1:1 has a `peer` and asking the service
 * to enumerate two people is a request with a known answer.
 */
export async function fetchConversationMembers(conversationId: string) {
  return ConversationMemberPageSchema.parse(
    await msApi.authedGet(`/conversations/${conversationId}/members`)
  );
}

/**
 * Add people to a group — `POST /conversations/:id/members { memberIds }`.
 *
 * ANY member may, not only the owner, which is why the file puts it on both
 * the joined menu ("Invite gist partners") and the owner's ("Add gist
 * partners"). Capped at 20 per call by the contract.
 */
export async function addGroupMembers(conversationId: string, memberIds: string[]) {
  return msApi.post<unknown>(`/conversations/${conversationId}/members`, { memberIds });
}

/**
 * Remove somebody from a group — `DELETE /conversations/:id/members/:profileId`.
 *
 * ONE route for two acts, because they are the same operation with a different
 * subject: anybody may remove THEMSELVES (a group you cannot leave is a group
 * anybody can trap you in) and only the owner may name somebody else. The last
 * member out deletes the group.
 */
export async function removeGroupMember(conversationId: string, profileId: string) {
  return msApi.del<unknown>(`/conversations/${conversationId}/members/${profileId}`);
}

/**
 * Rename a group — `PATCH /conversations/:id { title }`.
 *
 * The route takes title, description and imageUrl in ONE call, deliberately:
 * three endpoints would be three round trips that can half-fail, leaving a
 * group named after the edit and described before it. Only the title is sent
 * here, so an absent description is left alone rather than cleared.
 */
export async function renameGroup(conversationId: string, title: string) {
  return msApi.patch<unknown>(`/conversations/${conversationId}`, { title: title.trim() });
}

/**
 * Walk into a public group — `POST /conversations/:id/join`.
 *
 * What makes a group's `visibility` mean something rather than being a stored
 * preference. It succeeds on a public group, refuses a private one with 403
 * ("ask a member to add you" — the link's existence is not the secret, entry
 * is), and is idempotent for somebody already inside. The owner's blocks still
 * apply: a public door is not a bypass.
 */
export async function joinGroup(conversationId: string) {
  return msApi.post<unknown>(`/conversations/${conversationId}/join`);
}

/**
 * Make a house invite link — `POST /conversations/:id/invites`.
 *
 * Sent with no options, so the service's defaults apply: the link works for a
 * week with no cap on uses. In a public house any member may make one; in a
 * private house only the owner (403 otherwise).
 */
export async function createInvite(conversationId: string) {
  return InviteSchema.parse(await msApi.post(`/conversations/${conversationId}/invites`, {}));
}

/** What an invite link opens onto — `GET /invites/:token`, public with optional auth. */
export async function fetchInvitePreview(token: string) {
  return InvitePreviewSchema.parse(await msApi.get(`/invites/${encodeURIComponent(token)}`));
}

/**
 * Join through a link — `POST /invites/:token/accept`, private houses included.
 * Idempotent for somebody already inside. Answers the house joined.
 */
export async function acceptInvite(token: string) {
  return GroupRefSchema.parse(await msApi.post(`/invites/${encodeURIComponent(token)}/accept`));
}

/**
 * Remove a chat from YOUR inbox — `DELETE /conversations/:id`.
 *
 * It is "delete for me", and the difference matters enough that the confirm
 * copy has to say it:
 *
 *   · the thread leaves your inbox, and history before this moment stops being
 *     returned to you;
 *   · the OTHER person keeps everything, read receipts included;
 *   · you stay a member — this is not leaving a group;
 *   · a new message brings the thread back, carrying only what arrived after.
 *
 * So it is reversible, and nothing here may say "this cannot be undone".
 * Idempotent; 403 if you are not a participant.
 */
export async function deleteConversation(conversationId: string) {
  return msApi.del<unknown>(`/conversations/${conversationId}`);
}
