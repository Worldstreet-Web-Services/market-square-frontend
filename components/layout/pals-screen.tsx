"use client";

import { PalsDeck } from "@/components/layout/pals-deck";

/**
 * THE PALS SURFACE — the friends deck on a page of its own.
 *
 * The dock's second destination (748:15734) used to point at Explore. It
 * points here instead, because the act the glyph promises is deciding about
 * ONE PERSON AT A TIME — swipe right to follow, left to pass — and Explore is
 * a directory you scan. The deck already existed and already did that; what it
 * lacked was anywhere to go and be the whole screen.
 *
 * It renders `PalsDeck`, NOT the home timeline's compact fan. The fan is right
 * where it sits inside a feed and wrong as a whole screen: a 186px card
 * floating in the middle of a phone with most of the page empty under it. A
 * card you decide from has to carry enough to decide on, so this one is
 * full-width and holds the face, the name, the bio and the follower counts.
 *
 * Both still share `useSwipeCard` and `useFollow`, so the gesture and the
 * follow behaviour cannot drift between the two surfaces.
 */
export function PalsScreen() {
  return (
    /* The column claims the viewport minus the chrome, so the deck below has a
       height to fill. Without it the card is content-tall and the page is the
       sparse thing this replaced. */
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-medium leading-7 text-white">Make some friends</h1>
        <p className="text-[13px] leading-5 text-white/40">
          Follow cool people and watch your feed go from boring to elite ✨
        </p>
      </div>
      <PalsDeck />
    </div>
  );
}
