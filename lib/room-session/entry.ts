/**
 * MAY THIS VIEW ENTER THE ROOM YET?
 *
 * Two rules, pinned in lib/room-session.test.ts:
 *
 *   · NOT WITHOUT AN ACCOUNT. Anonymous listening is backend-dependent and not
 *     in this build: a signed-out reader's playback-token request is refused,
 *     and a session entered anyway sat at "Lost connection" in the shell's
 *     mini-player on every page, polling a room they never joined. The room
 *     view shows the sign-in invitation instead.
 *   · NOT BEFORE `/me` HAS SETTLED, so a host is not seated as a listener. A
 *     `/me` that FAILED counts as settled (TanStack has already retried it):
 *     the reader enters as a listener, and the session switches role if it
 *     later turns out they are the host (`RoomSessionController.enter`).
 */
export interface RoomEntryInput {
  authReady: boolean;
  authenticated: boolean;
  meLoaded: boolean;
  meFailed: boolean;
}

export function roomEntryReady({ authReady, authenticated, meLoaded, meFailed }: RoomEntryInput): boolean {
  return authReady && authenticated && (meLoaded || meFailed);
}
