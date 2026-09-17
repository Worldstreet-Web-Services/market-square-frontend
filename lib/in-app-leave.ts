/**
 * IS A BROADCAST LIVING IN THIS PAGE RIGHT NOW?
 *
 * A Studio broadcast and a guest's stage in a stream still live in their page:
 * any in-app navigation unmounts them and ends what is on air. A link click is
 * asked about where it happens (`useInAppLeaveConfirm`), but a tapped push
 * navigates through the client router (components/layout/push-navigation.tsx)
 * and never passes a link — it silently ended a live broadcast. So the page
 * that is on air raises this guard, with the question to ask, and anything
 * that navigates programmatically reads it first.
 *
 * A gist room is NOT one of these: the shell owns it and it survives in-app
 * navigation, so its host never raises the guard.
 *
 * Module-level, like the other shell signals. Pure; pinned in
 * lib/room-session.test.ts.
 */
const guards: Array<{ message: string }> = [];

/** Raise the guard; returns the release, which clears only this one. */
export function setInAppLeaveGuard(message: string): () => void {
  const entry = { message };
  guards.push(entry);
  return () => {
    const at = guards.indexOf(entry);
    if (at !== -1) guards.splice(at, 1);
  };
}

/** The question to ask before navigating away in-app, or null with nothing on air. */
export function inAppLeaveGuard(): string | null {
  return guards.at(-1)?.message ?? null;
}
