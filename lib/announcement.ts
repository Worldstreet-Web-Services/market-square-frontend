/**
 * THE PINNED ANNOUNCEMENT — one post held above the timeline for everybody.
 *
 * Used for the things a product occasionally has to say to all of its readers
 * at once: which accounts are official, what support will never ask you for,
 * a release everyone needs to know about. It is a POST rather than a bespoke
 * banner so it can be written in the composer, read on its own permalink,
 * replied to, and quoted — an announcement nobody can reply to reads like a
 * notice taped to a wall.
 *
 * ─── WHY THE ID IS SERVER CONFIG AND NOT A CONSTANT ─────────────────────────
 * `MS_ANNOUNCEMENT_POST_ID` is read on the SERVER, deliberately without the
 * `NEXT_PUBLIC_` prefix. Every `NEXT_PUBLIC_*` value is inlined into the
 * bundle at build time, so putting it there would mean a full rebuild to
 * change or clear the announcement — and the moment you most need to take one
 * down is the moment you least want to wait for a build. Read server-side, it
 * is an env change and a restart.
 *
 * There is no `pinned` flag on the contract and no pin route, so the id lives
 * in config and an operator sets it. That is a deliberate, working mechanism
 * and not scaffolding — the backend capability was considered and DEFERRED,
 * not scheduled.
 *
 * REPLACE THIS WHEN `GET /announcement` EXISTS, and not before. The agreed
 * shape, if it is ever picked up: `POST|DELETE /admin/posts/{id}/pin` for an
 * admin to pin from the console, and a public `GET /announcement` answering
 * the pinned post or null. At that point the id stops being config, this
 * module becomes a field read, and the two must not run side by side — two
 * sources for one pinned post is exactly the shape that drifts.
 *
 * ─── DISMISSAL IS KEYED ON THE POST, NOT A BOOLEAN ──────────────────────────
 * The one thing that would quietly break this: storing "dismissed: true".
 * Everyone who closed the last announcement would never see the next one, and
 * the failure is invisible — the people who need the warning are exactly the
 * ones who would not get it. Storing WHICH post was dismissed means a new id
 * shows again to everybody, automatically.
 */

/** Where the dismissal lives. One key, holding the id that was dismissed. */
export const ANNOUNCEMENT_KEY = "ms.announcement.dismissed";

/**
 * Should the announcement be on screen?
 *
 * `postId` null means none is configured, which is the normal state and must
 * cost nothing. `dismissed` is whatever is in storage, which may be a stale id
 * from a previous announcement, a boolean written by an older build, or junk.
 */
export function shouldShowAnnouncement(
  postId: string | null | undefined,
  dismissed: string | null | undefined
): boolean {
  if (!postId) return false;
  return dismissed !== postId;
}
