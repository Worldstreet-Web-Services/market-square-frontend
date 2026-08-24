import { msApi } from "@/lib/api/service";
import { NotificationListSchema, NotificationSchema } from "@/features/notifications/lib/types";

export async function fetchNotifications() {
  return NotificationListSchema.parse(await msApi.get("/notifications"));
}

export async function markNotificationRead(id: string) {
  return NotificationSchema.parse(await msApi.patch(`/notifications/${id}`, { read: true }));
}

export async function markAllNotificationsRead() {
  return msApi.post<{ updated: number }>("/notifications/read-all", {});
}
