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
  }),
  chat: z.object({
    messagesFrom: z.enum(["no_one", "everyone", "verified"]),
    allowHouseMembers: z.boolean(),
    allowPastAudience: z.boolean(),
  }),
});

export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;
