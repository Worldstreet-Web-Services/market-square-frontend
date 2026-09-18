import { z } from "zod";
import { MentionSchema, ProfileSchema } from "@/lib/api/schemas";
import { flattenMessageMedia } from "@/features/messages/lib/message-media";

/** `ConversationMessage` in the served spec. Note it carries NO `sender` — a
    1:1 thread has only one non-viewer sender and the view reads identity from
    the conversation's `peer`. A GROUP thread cannot do that, so it resolves
    `senderId` against the member roster instead; still no `sender` object is
    invented here, because the spec does not send one.

    THE MEDIA FIELDS ARE ALL NULLABLE AND `text` IS NOW NULLABLE TOO. A voice
    note or a photo is a message with no body, so `z.string()` on `text` would
    fail the WHOLE page parse the first time one arrives — one bad message
    blanking a thread rather than one bad bubble. Everything optional with a
    null default is the forward-compatible shape `orgBadge` uses: a backend
    that has not shipped these yet parses exactly as it does today. */
export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string().optional().default(""),
  senderId: z.string().optional().default(""),
  text: z.string().nullable().optional().default(null),
  /**
   * The attachment, as ONE nullable object — which is the shape the service
   * sends and the shape the database enforces: `(media_url IS NULL) =
   * (media_kind IS NULL)`, so a URL without a kind cannot exist.
   *
   * It is flattened onto the message below, because every reader here wants
   * `message.mediaUrl` rather than `message.media?.url`. The flattening is a
   * transform rather than a second set of wire fields on purpose — parsing
   * five independent optional fields is what let a nested payload arrive and
   * default ALL of them to null, which renders as "this message simply has no
   * attachment". No error, no crash, just media that never appears.
   */
  media: z
    .object({
      url: z.string(),
      // `catch` rather than a hard enum: a future fourth kind must degrade to
      // "media we cannot type" (the URL sniff then decides) instead of
      // throwing the message away.
      kind: z
        .enum(["image", "video", "audio", "file"])
        .nullable()
        .optional()
        .default(null)
        .catch(null),
      // Intrinsic pixels, when the service knows them. They set the bubble's
      // aspect ratio so a photo is not letterboxed into a guessed box —
      // absent, the bubble contains rather than crops.
      width: z.number().nullable().optional().default(null),
      height: z.number().nullable().optional().default(null),
      /** Voice-note length. Null means "unknown", which renders no duration
          at all rather than `00:00`. */
      durationSeconds: z.number().nullable().optional().default(null),
      /** Files only: the name to show. The service sanitises it and forces the
          stored object's real extension, so it is display text and never a
          storage key. Null renders as the generic noun, never as an empty row. */
      fileName: z.string().nullable().optional().default(null),
      /** Files only: the size to show beside the name. Null renders no size
          rather than `0 KB`, which would be a claim about the file. */
      sizeBytes: z.number().nullable().optional().default(null),
    })
    .nullable()
    .optional()
    .default(null),
  /**
   * Something the message points at — today, a gist room its sender opened.
   *
   * The service writes these; a client cannot attach one. `catch(null)` on the
   * kind for the same reason the media kind has it: a future deep-link kind
   * must degrade to "a link we cannot type" rather than throwing the message
   * away and blanking the thread.
   */
  deepLink: z
    .object({
      kind: z.string().nullable().optional().default(null).catch(null),
      ref: z.string(),
    })
    .nullable()
    .optional()
    .default(null),
  // How many OTHER participants have read this. `readByAll` is the service's
  // own answer to "everyone", which is the only one a group can act on
  // without also knowing the roster size at the moment of sending.
  readBy: z.number().optional().default(0),
  readByAll: z.boolean().optional().default(false),
  /**
   * OPENED, per message and per person — stricter than `readByAll`.
   *
   * `readByAll` is the thread's read watermark: it says the other side has
   * been into the conversation, not that they looked at THIS message.
   * `openedByMe` and `openedByPeer` (direct conversations only) are the
   * service's per-message stamps, and they are what a view-once snap turns on.
   *
   * Both are optional and BOTH DEFAULT TO FALSE ONLY AS A SHAPE, never as an
   * answer: `snapStatus` prefers them when the payload carries them and falls
   * back to the watermark when it does not, so a service that has not shipped
   * them yet still draws a correct row.
   */
  openedByMe: z.boolean().nullable().optional().default(null),
  openedByPeer: z.boolean().nullable().optional().default(null),
  // The spec's enum. `catch` keeps an unknown future state from blanking the
  // thread; a removed message keeps its row but not its body.
  status: z.enum(["active", "removed"]).optional().default("active").catch("active"),
  /**
   * The message this one answers — ONE level, no threading: a reply to a
   * reply points at that message. The service embeds the original's
   * 140-character excerpt and its media kind so the quote draws without a
   * second lookup; `deleted` is always false today (conversation messages
   * cannot be deleted yet) but the shape is the contract's, and a true value
   * renders "Message deleted".
   *
   * Optional with a null default AND `catch(null)`: a service without the
   * field, or a malformed one, draws no quote rather than blanking the thread.
   */
  replyTo: z
    .object({
      id: z.string(),
      senderId: z.string().optional().default(""),
      text: z.string().nullable().optional().default(null),
      media: z
        .object({ kind: z.string().nullable().optional().default(null) })
        .nullable()
        .optional()
        .default(null),
      deleted: z.boolean().optional().default(false),
    })
    .nullable()
    .optional()
    .default(null)
    .catch(null),
  /** Who the sender @-mentioned — the same `Mention` rows a post carries, and
      the same renderer (`PostText`) turns them into links. Empty on a service
      that has not shipped them. */
  mentions: z.array(MentionSchema).optional().default([]).catch([]),
  createdAt: z.string(),
}).transform((message) => ({
  ...message,
  // The flat accessors the pane and its libs read, derived in ONE place and
  // pinned by `lib/messages-message-media.test.ts` — see the note on
  // `flattenMessageMedia` for the bug this shape prevents.
  ...flattenMessageMedia(message.media),
}));

/**
 * A reader's notification levels for ONE house (settings stage 2b). Every
 * member starts at all/all. "leaders_and_friends" is the house's owner and
 * admins, plus anyone the reader follows; "directed" (rooms only) hears no
 * room openings but still gets speaker requests addressed to them.
 */
export const HouseNotificationSettingsSchema = z.object({
  messages: z.enum(["all", "leaders_and_friends", "none"]),
  rooms: z.enum(["all", "leaders_and_friends", "directed", "none"]),
});

export type HouseNotificationSettings = z.infer<typeof HouseNotificationSettingsSchema>;

/** `ConversationSummary` in the served spec, and the object the thread pane is
    handed. `lastMessage` is a full ConversationMessage object, NOT a string —
    declaring it as a string is what made the whole inbox fail to parse. The
    object is deliberate: it lets the row show who sent the preview and when. */
export const ConversationSchema = z.object({
  id: z.string(),
  // `catch` so a third kind arriving from the service reads as a 1:1 thread
  // (which renders correctly with a null peer) rather than failing the page.
  kind: z.enum(["direct", "group"]).optional().default("direct").catch("direct"),
  /** The group's name. Null on a 1:1, where the peer IS the title. */
  title: z.string().nullable().optional().default(null),
  /** The group's picture (migration 037). A 1:1 is pictured by its peer. */
  imageUrl: z.string().nullable().optional().default(null),
  /** What the group is for. Shown on the group's own header, not the row. */
  description: z.string().nullable().optional().default(null),
  /** Direct threads only. */
  peer: ProfileSchema.nullable().optional().default(null),
  /** Groups only, and CAPPED AT FOUR by the service — it is the header's
      preview roster, never the membership. Anything that needs the whole list
      (resolving a sender avatar, the members sheet) reads
      `GET /conversations/:id/members`. */
  members: z.array(ProfileSchema).optional().default([]),
  // NOT defaulted to 0. Absent means "this payload does not count members",
  // which is a different statement from "this group has no members" — and the
  // header renders nothing for the first and would render "0 members" for the
  // second.
  memberCount: z.number().nullable().optional().default(null),
  /**
   * Who created the group. Groups only, null on a 1:1.
   *
   * It decides WHICH overflow menu a thread draws — the owner's (78:8525) or a
   * member's (78:8337). It used to be absent from the summary, so the client
   * had to infer ownership from `role === "owner"` on the roster, which meant
   * the menu could not be right until a second request landed.
   */
  createdBy: z.string().nullable().optional().default(null),
  /**
   * Whether somebody holding this group's link may join it themselves via
   * `POST /conversations/:id/join`. It does NOT mean "listed in a directory" —
   * `GET /conversations/discover` is what lists them, and it lists exactly the
   * public ones. A direct conversation is always private.
   *
   * `canMakeInvite` reads it: any member of a public house may share an invite
   * link, only the owner or an admin of a private one.
   */
  visibility: z.enum(["public", "private"]).optional().default("private").catch("private"),
  /** The reader's own role in a GROUP row. Null on a 1:1, and on a service that predates roles. */
  viewerRole: z.enum(["owner", "admin", "member"]).nullable().optional().default(null).catch(null),
  /** The reader's notification levels for a GROUP row. Null on a 1:1, and before stage 2b. */
  notificationSettings: HouseNotificationSettingsSchema.nullable().optional().default(null).catch(null),
  /** Groups only: who wrote `lastMessage`, so the inbox row can prefix it. */
  lastSender: ProfileSchema.nullable().optional().default(null),
  lastMessage: MessageSchema.nullable().optional().default(null),
  lastMessageAt: z.string().nullable().optional().default(null),
  /** Group presence, the counterpart of a profile's `lastSeenAt`. */
  lastActiveAt: z.string().nullable().optional().default(null),
  // DELIBERATELY NOT DEFAULTED, for the reason `isFollowing` is not:
  // `undefined` means "this payload does not carry a request state", which is
  // not the same as "accepted". Only an explicit `pending` may gate anything,
  // so a backend that has not shipped requests can never silently lock a
  // thread the reader is already in.
  requestState: z.enum(["pending", "accepted"]).optional().catch(undefined),
  requestedBy: z.string().nullable().optional().default(null),
  unreadCount: z.number().optional().default(0),
});

/** `Conversation` in the served spec — what `POST /conversations` returns. It
    is a DIFFERENT shape from ConversationSummary: participant ids and no peer,
    preview or unread count. They were conflated onto one schema, which parsed
    only because every summary-only field happened to be optional. */
export const ConversationRefSchema = z.object({
  id: z.string(),
  participantA: z.string().optional().default(""),
  participantB: z.string().optional().default(""),
  lastMessageAt: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});
export type ConversationRef = z.infer<typeof ConversationRefSchema>;

/** A row of `GET /conversations/:id/members`. The profile is nullable because
    a member whose account has gone is still a member of the group — dropping
    the row would silently shrink the count the header prints. */
export const ConversationMemberSchema = z.object({
  profile: ProfileSchema.nullable().optional().default(null),
  // owner | admin | member. An unknown future role reads as a plain member,
  // which offers the fewest controls rather than the most.
  role: z.enum(["owner", "admin", "member"]).optional().default("member").catch("member"),
  joinedAt: z.string().nullable().optional().default(null),
});

export const ConversationMemberPageSchema = z.object({
  items: z.array(ConversationMemberSchema),
  /** The group's name. Null on a direct conversation, absent on a service
      that has not shipped it — a gist room's header reads this. */
  title: z.string().nullable().optional().default(null),
  /** Newest `lastSeenAt` across the OTHER members — the "Active 3d ago" line. */
  lastActiveAt: z.string().nullable().optional().default(null),
});

export const ConversationPageSchema = z.object({
  items: z.array(ConversationSchema),
  nextCursor: z.string().nullable().optional().default(null),
  // Global across every thread. The nav badge still reads `GET /me/unread`,
  // which answers messages and notifications together in one call.
  totalUnread: z.number().optional().default(0),
  /**
   * Requests awaiting the caller's answer — GLOBAL, not page-scoped, so it is
   * the same number whichever tab asked for it. It badges the Gist Requests
   * tab. Defaulted to 0 rather than left undefined because a count is a count;
   * a backend that does not send one has none to show.
   */
  pendingRequests: z.number().optional().default(0),
});

// Newest-first, like the service returns it.
export const MessagePageSchema = z.object({
  items: z.array(MessageSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const ReadResultSchema = z.object({
  unreadCount: z.number().optional().default(0),
});

/**
 * `Conversation` as `POST /conversations/groups` answers it.
 *
 * A group carries a `title` and no participant pair, which is the mirror of
 * `ConversationRefSchema` — kept separate rather than widened into it, because
 * one schema that is optional in both directions would parse a malformed
 * response of either shape.
 */
/** `POST /conversations/:id/invites` — a house invite. The link is ours: `/join/<token>`. */
export const InviteSchema = z.object({
  token: z.string(),
  conversationId: z.string(),
  expiresAt: z.string().nullable().optional().default(null),
  maxUses: z.number().nullable().optional().default(null),
  useCount: z.number().optional().default(0),
});

/**
 * `GET /invites/:token` — what a link opens onto, for members, strangers and
 * signed-out visitors alike. `canJoin` is for THIS link and THIS viewer, and is
 * false for anybody signed out. An expired or used-up link still answers, with
 * `valid: false` and the reason.
 */
export const InvitePreviewSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
  imageUrl: z.string().nullable().optional().default(null),
  memberCount: z.number().nullable().optional().default(null),
  visibility: z.enum(["public", "private"]).optional().default("private").catch("private"),
  viewerIsMember: z.boolean().optional().default(false),
  canJoin: z.boolean().optional().default(false),
  valid: z.boolean(),
  reason: z.enum(["expired", "used_up"]).nullable().optional().default(null).catch(null),
  expiresAt: z.string().nullable().optional().default(null),
});

export type InvitePreview = z.infer<typeof InvitePreviewSchema>;

export const GroupRefSchema = z.object({
  id: z.string(),
  kind: z.enum(["direct", "group"]).optional().default("group").catch("group"),
  title: z.string().nullable().optional().default(null),
  createdBy: z.string().nullable().optional().default(null),
  lastMessageAt: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

/** The composer's outgoing shape lives with the pure builder that validates
    it — re-exported here so callers keep a single import site for the slice's
    types. */
export type { OutgoingMessage } from "@/features/messages/lib/outgoing";

export type Conversation = z.infer<typeof ConversationSchema>;
export type Message = z.infer<typeof MessageSchema>;
/** The quoted original on a reply, as the service embeds it. */
export type MessageReplyTo = NonNullable<Message["replyTo"]>;
export type ConversationMember = z.infer<typeof ConversationMemberSchema>;

/** The service caps a message body at 2000 characters. */
export const MESSAGE_MAX = 2000;
