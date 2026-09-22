import { z } from "zod";

/**
 * `GET|PATCH /me/settings` — the reader's own preferences (stage 1).
 *
 * STRICT on purpose: the service refuses unknown keys and values on write, and
 * a reply that does not match is a contract change, not something to paper
 * over with defaults. `privacy` is not here yet — those rows wait for the
 * stages that build what they govern.
 */
export const ProfileSettingsSchema = z.object({
  notifications: z.object({
    /** When someone you follow goes live. */
    friendsRooms: z.boolean(),
    /** Chat requests, 1:1 messages and being added to a group. */
    direct: z.boolean(),
    /** Web push to subscribed browsers. Absent on a service without push. */
    push: z.boolean().optional(),
    /**
     * Which of the service's buckets may reach a phone — `push` is the master
     * switch and these only narrow it.
     *
     * OPTIONAL, AND ALL-OR-NOTHING. Absent means a service without per-group
     * push, and Settings draws no rows at all. Present means all five keys:
     * the service stores a boolean column per group and always sends the set.
     *
     * So the five are REQUIRED inside the object rather than optional. A
     * partial object is a contract break, and tolerating it with `?? true`
     * would show somebody a switch reading on while the service believed
     * something else — the quiet failure this whole file is strict to avoid.
     */
    pushGroups: z
      .object({
        social: z.boolean(),
        money: z.boolean(),
        rooms: z.boolean(),
        chat: z.boolean(),
        account: z.boolean(),
      })
      .optional(),
    /** The daily email summary. Absent on a service without email; turned off by the email's unsubscribe link too. */
    emailDigest: z.boolean().optional(),
  }),
  chat: z.object({
    messagesFrom: z.enum(["no_one", "everyone", "verified"]),
    allowHouseMembers: z.boolean(),
    allowPastAudience: z.boolean(),
  }),
  /**
   * OPTIONAL, and its presence is the signal: a service without stage 3 sends
   * no `privacy`, and one without stage 4 sends it without the two toggles.
   * The screen enables each control only once its key has arrived.
   */
  privacy: z
    .object({
      /** How much of the place OTHER people see. The owner always sees it all. */
      locationPrecision: z.enum(["city_region_country", "region_country", "country", "continent"]),
      /** "Visibility on Space": followers can see which gist rooms you are in. */
      showListening: z.boolean().optional(),
      /** "Personalize based on places": the for-you lane lifts people near your declared place. */
      personalizeByPlace: z.boolean().optional(),
    })
    .optional(),
});

export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;
