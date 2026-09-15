/**
 * WHO SAW YOUR STORY — the two rules the "Seen by" entry lives by.
 *
 * `GET /posts/{id}/viewers` answers the story's AUTHOR only. Everyone else, a
 * removed story, an unknown id, a feed post and a service that has not shipped
 * the route all come back as 4xx — and for every one of those the right
 * answer is the same: draw no entry. So the entry exists only on a success,
 * and a 4xx is never retried (it will not change on a second try, and a
 * retried 404 is three requests to learn one fact).
 *
 * THE NUMBER IS \`total\`, NEVER THE ROWS. The list leaves out people blocked in
 * either direction, so it can be shorter than the count — "Seen by 12" over a
 * list of 11 is correct, and counting the rows would under-report every
 * author who has blocked anyone.
 *
 * Pure, so `node --test` pins it.
 */

export function seenByLabel(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "No views yet";
  return `Seen by ${Math.floor(total).toLocaleString("en-US")}`;
}

export function shouldRetryViewers(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) return false;
  return failureCount < 2;
}
