/**
 * EVERY WAY OUT OF THE SQUARE, THROUGH ONE DOOR.
 *
 * Inside Ark, leaving the Square is a full page load, and a full page load
 * ends the tab's gist room. `ZoneExitGuard` asks a host or a speaker first —
 * but it listened only for clicks on `<a href>`, so the rail's Ark menu
 * (buttons calling `location.assign`) and "Back to Ark" (`history.back()`)
 * walked straight past it and dropped a host mid-sentence.
 *
 * Programmatic exits now call `requestZoneExit` with the address (for "Open in
 * new tab") and the act of leaving. While the guard is listening it may hold
 * the request for its question; otherwise the exit happens at once. The same
 * module-level doorbell pattern as lib/chat-open-store.ts; pinned in
 * lib/room-session.test.ts.
 */
export interface ZoneExitRequest {
  /** Where the exit goes — opened in a new tab if the reader keeps the room. */
  href: string;
  /** Leave: the navigation itself. */
  go: () => void;
}

/** Returns true when it has taken the request (the question is on screen). */
type ZoneExitHandler = (request: ZoneExitRequest) => boolean;

let handler: ZoneExitHandler | null = null;

/** The guard's door. Null when nobody needs asking. */
export function setZoneExitHandler(next: ZoneExitHandler | null) {
  handler = next;
}

export function requestZoneExit(request: ZoneExitRequest) {
  if (handler?.(request)) return;
  request.go();
}

/** The one full-page load out of the Square. */
export function leaveSquare(href: string) {
  window.location.assign(href);
}
