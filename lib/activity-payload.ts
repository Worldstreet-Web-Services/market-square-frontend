import type { DeepLink } from "@/lib/api/schemas";

/**
 * Build the POST /activities body.
 *
 * Extracted from the form so the wire shape is testable against the service's
 * contract. Two rules the form got wrong and that live here now:
 *
 *   - `deepLink` is REQUIRED. Sending nothing produced
 *     "400 deepLink: Invalid input: expected object, received undefined",
 *     which is why no activity was ever persisted.
 *   - `startsAt` must be a full ISO-8601 datetime. A date-only value fails.
 */
export interface CreateActivityInput {
  type: "game" | "stream" | "event";
  title: string;
  /** Raw <input type="datetime-local"> value, e.g. "2026-09-01T10:00". */
  localStartsAt: string;
  deepLink: DeepLink | null;
  description?: string;
}

export interface CreateActivityBody {
  type: "game" | "stream" | "event";
  title: string;
  startsAt: string;
  deepLink: DeepLink;
  description?: string;
}

export function buildCreateActivityBody(input: CreateActivityInput): CreateActivityBody {
  if (!input.deepLink) {
    // Throw rather than send: a silent 400 is what hid this bug for so long.
    throw new Error("deepLink is required — choose what the activity is about.");
  }
  const startsAt = new Date(input.localStartsAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new Error("startsAt must be a valid date and time.");
  }
  const description = input.description?.trim();
  return {
    type: input.type,
    title: input.title.trim(),
    startsAt: startsAt.toISOString(),
    deepLink: input.deepLink,
    ...(description ? { description } : {}),
  };
}
