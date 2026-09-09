"use client";

import { MakeSomeFriends } from "@/components/layout/make-some-friends";

/**
 * THE PALS SURFACE — the deck on a page of its own, at the size a page allows.
 *
 * The dock's second destination points here rather than at Explore, because
 * the act its glyph promises is deciding about ONE PERSON AT A TIME — the fan,
 * its pass and its wink — and Explore is a directory you scan.
 *
 * It is the SAME `MakeSomeFriends` the home timeline renders, not a second
 * copy and not a second card: one component means the swipe, the wink
 * cooldown and the already-following guard cannot be fixed on one surface and
 * left broken on the other.
 *
 * WHAT IS DIFFERENT HERE IS ONLY THE SIZE. Inside the feed the deck is one
 * block among many and sits at the file's own scale. As a whole screen that
 * left a 186px card marooned in the middle of a phone with the page empty
 * under it, so here it is told to FILL — same fan, same cards, same controls,
 * just drawn as large as the column allows.
 */
export function PalsScreen() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col justify-center px-4 py-6 lg:px-6">
      <MakeSomeFriends fill />
    </div>
  );
}
