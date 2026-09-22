/**
 * A settings save, applied to what is on screen before the service answers.
 *
 * `PATCH /me/settings` is partial and nested — `{ chat: { messagesFrom } }` —
 * and answers the whole object, so the optimistic copy has to merge the same
 * way the service does: one level deep, a section's untouched keys kept.
 * Pure, so `node --test` pins it.
 */

export type MessagesFrom = "no_one" | "everyone" | "verified";

export type LocationPrecision = "city_region_country" | "region_country" | "country" | "continent";

export interface PrivacySettings {
  locationPrecision: LocationPrecision;
  showListening?: boolean;
  personalizeByPlace?: boolean;
}

/**
 * Which buckets may reach a phone. Always all five or absent — see the schema;
 * a save replaces the whole object rather than patching one key, so there is
 * never a partial one in flight.
 */
export interface PushGroupSettings {
  social: boolean;
  money: boolean;
  rooms: boolean;
  chat: boolean;
  account: boolean;
}

export interface SettingsShape {
  notifications: {
    friendsRooms: boolean;
    direct: boolean;
    push?: boolean;
    emailDigest?: boolean;
    pushGroups?: PushGroupSettings;
  };
  chat: { messagesFrom: MessagesFrom; allowHouseMembers: boolean; allowPastAudience: boolean };
  /** Absent on a service without stage 3. */
  privacy?: PrivacySettings;
}

export interface SettingsPatch {
  notifications?: Partial<SettingsShape["notifications"]>;
  chat?: Partial<SettingsShape["chat"]>;
  privacy?: Partial<PrivacySettings>;
}

export function applySettingsPatch(current: SettingsShape, patch: SettingsPatch): SettingsShape {
  const next: SettingsShape = {
    notifications: { ...current.notifications, ...patch.notifications },
    chat: { ...current.chat, ...patch.chat },
  };
  // Only a section the service has sent can be merged into; a privacy save is
  // never offered without it.
  if (current.privacy) next.privacy = { ...current.privacy, ...patch.privacy };
  return next;
}
