export { NotificationsPage } from "@/features/notifications/components/notifications-page";
// The "now friends" popup (647:16628) is composed in `components/layout`
// because it acts across slices (wink and follow are the profile's, "Start
// gisting" is the messages slice's); these are the reads it needs from here.
export { useNotifications, useMarkNotificationsRead } from "@/features/notifications/hooks/use-notifications";
export type { MarketNotification } from "@/features/notifications/lib/types";
