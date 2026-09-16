import type { Profile } from "../../../lib/api/schemas.ts";
import type { Conversation, ConversationRef } from "./types.ts";

/**
 * A 1:1 you JUST opened, in the shape the thread needs — before any list has it.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The messages page opens a linked thread (`/messages?c=<id>`) by finding it in
 * the inbox's loaded list, because there is no `GET /conversations/:id`. That
 * works for a thread you already share, and for NOTHING you start with a
 * stranger:
 *
 *   - `POST /conversations` creates the thread `pending`, with you as
 *     `requested_by`, unless the other person already FOLLOWS you
 *     (`invited = isFollowing(peer, you)` in the service).
 *   - `GET /me/conversations` defaults `state` to `accepted`, so it is not in
 *     All.
 *   - Gist Requests lists pending threads `requested_by <> you` — other
 *     people's requests — so it is not there either.
 *
 * So an outgoing request is in NO list, the lookup found nothing, and Start
 * gisting, a profile's Message button and the support chat all landed on the
 * inbox instead of the person. Somebody who winked at you usually does not
 * follow you, which is exactly why the wink card hit it first.
 *
 * ─── WHERE THE OBJECT COMES FROM ─────────────────────────────────────────────
 * The response is a bare REF — id, participant ids, timestamps; no peer, no
 * kind. Every caller, though, already holds the profile it tapped, so the
 * thread is built from the server's id plus that profile. Nothing is invented:
 * the id is the service's and the peer is the person being messaged. The rest
 * is what a brand-new 1:1 IS, lifted unchanged from the `+` picker, which has
 * opened its threads this way all along and never had the bug.
 *
 * `requestState` and `requestedBy` stay unset, as the picker leaves them: the
 * ref does not carry them, and the schema's undefaulted field exists precisely
 * so "this object does not say" is not mistaken for "accepted".
 */
export function conversationFromRef(ref: ConversationRef, peer: Profile): Conversation {
  return {
    id: ref.id,
    kind: "direct",
    // A 1:1 has no creator and is never joinable by link.
    createdBy: null,
    visibility: "private",
    // Roles and per-house levels belong to groups.
    viewerRole: null,
    notificationSettings: null,
    imageUrl: null,
    description: null,
    title: null,
    peer,
    members: [],
    memberCount: null,
    lastSender: null,
    lastMessage: null,
    lastMessageAt: ref.lastMessageAt ?? null,
    lastActiveAt: null,
    requestedBy: null,
    unreadCount: 0,
  };
}

/**
 * Where an opened thread is held until the page reads it.
 *
 * Its own second segment on purpose: the inbox is invalidated under
 * `["ms", "conversations"]` every time a thread opens, and a key under that
 * prefix would be swept away by the same call that wrote it.
 */
export function openedConversationKey(id: string) {
  return ["ms", "opened-conversation", id] as const;
}
