import { msApi } from "@/lib/api/service";
import {
  NotificationPageSchema,
  ReadResultSchema,
} from "@/features/notifications/lib/types";

export async function fetchNotifications(cursor?: string) {
  return NotificationPageSchema.parse(
    await msApi.authedGet("/me/notifications", { limit: 30, cursor })
  );
}

/** Omitting `ids` marks everything read — the service's own default. */
export async function markNotificationsRead(ids?: string[]) {
  return ReadResultSchema.parse(
    await msApi.post("/me/notifications/read", ids?.length ? { ids } : {})
  );
}
