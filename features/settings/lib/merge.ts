/**
 * A settings save, applied to what is on screen before the service answers.
 *
 * `PATCH /me/settings` is partial and nested — `{ chat: { messagesFrom } }` —
 * and answers the whole object, so the optimistic copy has to merge the same
 * way the service does: one level deep, a section's untouched keys kept.
 * Pure, so `node --test` pins it.
 */

export type MessagesFrom = "no_one" | "everyone" | "verified";

export interface SettingsShape {
  notifications: { friendsRooms: boolean; direct: boolean };
  chat: { messagesFrom: MessagesFrom; allowHouseMembers: boolean; allowPastAudience: boolean };
}

export interface SettingsPatch {
  notifications?: Partial<SettingsShape["notifications"]>;
  chat?: Partial<SettingsShape["chat"]>;
}

export function applySettingsPatch(current: SettingsShape, patch: SettingsPatch): SettingsShape {
  return {
    notifications: { ...current.notifications, ...patch.notifications },
    chat: { ...current.chat, ...patch.chat },
  };
}
