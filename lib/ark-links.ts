/**
 * THE WAY BACK TO ARK, for the build Ark mounts at www.tsionark.com/square.
 *
 * Inside Ark the Square is one Next.js zone and the rest of Ark is another, on
 * the same origin. Nothing in the Square used to lead out of it, so a reader
 * who arrived from Ark's Market had no way back but the browser's own button.
 * The mobile app solved the same problem with a "Back to Ark" control in the
 * Square's header (tsion `useExitSquare`): step back to the Ark screen the
 * reader came from, and only when there is none, open Ark's Market. This is
 * that rule, pure, so both the phone pill and the desktop menu share it.
 *
 * Every Ark address here is a FULL page load: this build has no route for any
 * of them, so a client transition would ask the wrong app.
 *
 * Nothing here renders in the standalone square.tsionark.com build.
 */

import { SQUARE_BASE } from "./square-path.ts";

/** Where "Back to Ark" lands when there is no Ark page to step back to — the mobile app's rule. */
export const ARK_BACK_FALLBACK = "/market";

/** Ark's own sections, in Ark's dock and rail order, as their web routes. */
export const ARK_DESTINATIONS: readonly { label: string; href: string }[] = [
  { label: "Home", href: "/portfolio" },
  { label: "Market", href: "/market" },
  { label: "Meme", href: "/meme" },
  { label: "Prediction", href: "/prediction" },
  { label: "Real assets", href: "/rwa" },
  { label: "Arkade", href: "/casino" },
  { label: "Activity", href: "/activity" },
];

/** True in the build Ark mounts, the only build that shows any of this. */
export const SHOWS_ARK_NAV = SQUARE_BASE !== "";

/**
 * Step back in history, or navigate to the fallback?
 *
 * Back only when the page before this one was an Ark page on this same origin:
 * then the browser's history returns the reader to exactly where they were, as
 * the app's stack does. A referrer from another site, from inside the Square,
 * or none at all (a pasted link, a new tab) navigates to Ark's Market instead,
 * because "back" there would leave Ark altogether or stay in the Square.
 */
export function arkBackAction(input: { referrer: string; origin: string; base: string }): "history" | "navigate" {
  if (!input.referrer || !input.base) return "navigate";
  let url: URL;
  try {
    url = new URL(input.referrer);
  } catch {
    return "navigate";
  }
  if (url.origin !== input.origin) return "navigate";
  const inSquare = url.pathname === input.base || url.pathname.startsWith(`${input.base}/`);
  return inSquare ? "navigate" : "history";
}
