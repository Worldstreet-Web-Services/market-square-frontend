export { useSettings, useUpdateSettings } from "@/features/settings/hooks/use-settings";
export { usePushNotifications } from "@/features/settings/hooks/use-push";
// `/unsubscribe?token=` — where the daily email summary's unsubscribe link lands.
export { UnsubscribePage } from "@/features/settings/components/unsubscribe-page";
export type { ProfileSettings } from "@/features/settings/lib/types";
export type { LocationPrecision, MessagesFrom, PrivacySettings, SettingsPatch } from "@/features/settings/lib/merge";
