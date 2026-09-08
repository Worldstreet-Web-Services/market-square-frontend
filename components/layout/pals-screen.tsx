"use client";

import { MakeSomeFriends } from "@/components/layout/make-some-friends";

/**
 * THE PALS SURFACE — the friends deck on a page of its own.
 *
 * The dock's second destination (748:15734) used to point at Explore. It
 * points here instead, because the act the glyph promises is deciding about
 * ONE PERSON AT A TIME — swipe right to follow, left to pass — and Explore is
 * a directory you scan. The deck already existed and already did that; what it
 * lacked was anywhere to go and be the whole screen.
 *
 * It is the SAME `MakeSomeFriends` the home timeline renders, not a second
 * copy: one component means the swipe, the wink cooldown and the
 * already-following guard cannot be fixed on one surface and left broken on
 * the other. The deck renders nothing at all when the directory is empty, and
 * that stays true here — an empty page is the honest answer when there is
 * nobody to meet.
 */
export function PalsScreen() {
  return (
    <div className="px-4 py-6 lg:px-6">
      <MakeSomeFriends />
    </div>
  );
}
