import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

// The service's notification kinds. `catch` keeps an unknown future kind from
// failing the whole page — it renders with the neutral glyph instead.
export const NotificationKindSchema = z
  .enum([
    "follow",
    "like",
    "comment",
    "repost",
    "bookmark",
    "ticket_purchased",
    /**
     * Somebody tipped you.
     *
     * The service has sent this since tipping shipped; this enum did not list
     * it, and `.catch("follow")` turned every one of them into "followed you".
     * A creator who was paid was told they had gained a follower — the wrong
     * event, and the one that matters most to get right.
     */
    "tip_received",
    /**
     * Somebody winked at you — a one-tap signal of interest, addressed to you
     * rather than to something you posted.
     *
     * Listed here BEFORE the service sends one, and that ordering is the
     * point: `.catch("follow")` turns any kind this enum has not heard of into
     * "followed you". That is exactly how `tip_received` shipped as a lie for
     * a while — a creator who had been paid was told they had a new follower.
     * A wink misreported as a follow would be the same bug with worse
     * consequences, because a follow is a public act and a wink is not.
     */
    "wink",
    "stream_live",
    "verification_resolved",
    "role_resolved",
    /**
     * FOUR KINDS THE SERVICE HAS BEEN SENDING ALL ALONG, and this enum did not
     * list — so `.catch("follow")` rendered every one of them as "New
     * Follower · X started following you on Square."
     *
     * This is the third time the same hole has bitten (see `tip_received` and
     * `wink` above), and it was live: the service's enum carries fifteen kinds
     * against our eleven, and the local database holds six `message`, six
     * `speaker_request` and three `group_added` rows right now — every one of
     * them being shown to somebody as a follow that never happened.
     *
     * Verified against the served contract at :8094 rather than guessed. The
     * lesson the two earlier notes drew is the right one and was not applied
     * widely enough: list a kind BEFORE the service sends it, and re-read the
     * enum whenever notifications change.
     */
    "message",
    "chat_request",
    "group_added",
    "speaker_request",
  ])
  .catch("follow");

export const NotificationSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  // Hydrated on every read, but a deleted account can leave it null.
  actor: ProfileSchema.nullable().optional().default(null),
  postId: z.string().nullable().optional().default(null),
  streamId: z.string().nullable().optional().default(null),
  /**
   * WHAT THE NOTIFICATION IS ABOUT — the same shape as a tip's `source`, and
   * resolved by the same code upstream so the two can never disagree about
   * what a gist room is (a stream with category 'house', reported as `room`).
   *
   * Two nulls, both real states rather than gaps:
   *  · `subject` null — the row is about a PERSON, not a thing: follow, wink,
   *    message. Render no subject line.
   *  · `title` null — the thing has no words to show, such as a picture-only
   *    post, or a room with no topic set. Same treatment; never fall back to
   *    the id or to "a post".
   *
   * Titles arrive truncated at 140 with an ellipsis already applied, so
   * nothing here clamps again expecting the full text.
   */
  subject: z
    .object({
      kind: z.enum(["post", "stream", "room"]).catch("post"),
      id: z.string().nullable().optional().default(null),
      title: z.string().nullable().optional().default(null),
    })
    .nullable()
    .optional()
    .default(null),
  /**
   * Which bucket this row belongs to, decided by the SERVICE.
   *
   * Optional here only because the deployed environment is behind; on the
   * running service it is never null. It exists precisely so the client never
   * re-derives a kind-to-group map — a client-composed mapping silently drops
   * every kind added after it ships, which is the failure we already hit in
   * the other direction when four kinds rendered as follows.
   */
  group: z.enum(["social", "money", "rooms", "chat", "account"]).nullable().optional().default(null),
  // Null until the notification has been read.
  readAt: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

/** The service's own buckets. No `all` member: omitting the parameter IS all,
    and an enum carrying both gives a client two ways to say one thing. */
export const NOTIFICATION_GROUPS = ["social", "money", "rooms", "chat", "account"] as const;
export type NotificationGroup = (typeof NOTIFICATION_GROUPS)[number];

export const NotificationPageSchema = z.object({
  items: z.array(NotificationSchema),
  unreadCount: z.number().optional().default(0),
  nextCursor: z.string().nullable().optional().default(null),
});

export const ReadResultSchema = z.object({
  unreadCount: z.number().optional().default(0),
});

export type MarketNotification = z.infer<typeof NotificationSchema>;
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
