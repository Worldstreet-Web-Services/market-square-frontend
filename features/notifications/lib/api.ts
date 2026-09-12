import { msApi } from "@/lib/api/service";
import {
  NotificationPageSchema,
  ReadResultSchema,
} from "@/features/notifications/lib/types";

export async function fetchNotifications(cursor?: string, group?: string) {
  /* `group` omitted entirely for "everything" — the enum has no `all` member,
     because a value meaning the same as sending nothing is a second way to say
     one thing and somebody has to be told which is which. */
  return NotificationPageSchema.parse(
    await msApi.authedGet("/me/notifications", { limit: 30, cursor, ...(group ? { group } : {}) })
  );
}

/** Omitting `ids` marks everything read — the service's own default. */
export async function markNotificationsRead(ids?: string[]) {
  return ReadResultSchema.parse(
    await msApi.post("/me/notifications/read", ids?.length ? { ids } : {})
  );
}
