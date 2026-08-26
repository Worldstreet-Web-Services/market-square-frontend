"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { IconMsHandDeposit } from "@/components/ui/design-icons";
import { TipSheet } from "@/features/tips/components/tip-sheet";
import { useTippingUnavailable } from "@/features/tips/lib/availability";
import type { TipTarget } from "@/features/tips/lib/types";

/**
 * "Give a tip" — the icon-only pill that opens the tip flow.
 *
 * Renders NOTHING in two cases, both of them "this control could not do
 * anything if you pressed it":
 *
 *  1. **It is your own post.** Self-tipping is a 400 by contract, so a button
 *     that can only ever fail is worse than no button. Same rule, same reason
 *     as `FollowPill` and `PersonRow`'s own-row guard — and, as there, it is
 *     COMPARED rather than assumed impossible.
 *  2. **The service answered 404.** Tipping is not deployed yet; a 404 means
 *     "not there", not "your tip failed", so the control goes quiet exactly as
 *     `useBookmarkPost().unavailable` does — see `lib/availability.ts` for why
 *     that answer is shared across every card rather than per-button.
 *
 * Quiet, note, not disabled. The flag-off convention (`MARKET_FLAGS`) is
 * "visible and inert" because a flag records a roadmap decision worth showing.
 * This is not a flag: it is a route that is missing today and will simply be
 * there tomorrow, with nothing for a user to read or do about it in between.
 */
export function TipButton({ target }: { target: TipTarget }) {
  const [open, setOpen] = useState(false);
  // Counts openings. It does two jobs: zero means the sheet has never been
  // opened and need not be in the tree at all, and the value keys the sheet so
  // each opening REMOUNTS it — which is what resets the amount, the stage and
  // any previous failure, without a reset effect.
  const [opened, setOpened] = useState(0);
  const gate = useGate();
  const me = useMe();
  const unavailable = useTippingUnavailable();

  const isMine = Boolean(target.recipient && me.data?.id === target.recipient.id);
  if (isMine) return null;

  // The 404 can also arrive MID-FLOW, from this very sheet. Hiding the button
  // then must not take the open dialog down with it: the person pressed Send
  // and is owed an answer, so the trigger goes and the sheet stays until they
  // close it. Only after that does the control disappear for good.
  if (unavailable && !open) return null;

  return (
    <div className="group relative">
      {!unavailable && (
        <button
          type="button"
          aria-label="Give a tip"
          onClick={() =>
            gate(() => {
              setOpened((n) => n + 1);
              setOpen(true);
            })
          }
          /* The design's geometry: 42×26 with 4px/12px padding around a 16px
           glyph, a full-round rim in --color-spotlight-chip-ink, and the
           ramp's dark stop at 34% behind it. Both colours are TOKENS — the
           measured #7E3BEB and #C27AFF are exactly --color-spotlight and
           --color-spotlight-chip-ink, so no third purple is introduced. */
          className={cn(
            "ws-press flex h-[26px] w-[42px] shrink-0 items-center justify-center rounded-full",
            "border border-spotlight-chip-ink bg-spotlight/35 px-3 py-1",
            "text-spotlight-chip-ink transition-colors hover:bg-spotlight/55"
          )}
        >
          <IconMsHandDeposit className="h-4 w-4" />
        </button>
      )}

      {/* Tooltip, in the app's one existing pattern (the icon rail's, in
          `app-shell`): a positioned span revealed by the group's hover state,
          `pointer-events-none` so it can never eat the click it describes.
          Two departures, both deliberate:
            · it also opens on `group-focus-within`, so a keyboard user sees the
              same label a mouse user does — the rail's version is hover-only;
            · it is `aria-hidden`, because the button already carries the label
              as its accessible name and a screen reader reading "Give a tip"
              twice is noise, not redundancy.
          The purple is the ramp's DARK stop with white ink, which is the rule
          for a solid purple fill (5.66:1); the light stop under white text
          would fail AA. */}
      {!unavailable && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2",
            "whitespace-nowrap rounded-lg bg-spotlight px-2.5 py-1 text-xs font-semibold text-white shadow-lg",
            "group-hover:block group-focus-within:block"
          )}
        >
          Give a tip
        </span>
      )}

      {/* In the tree only once opened: one sheet per visible post, all mounted
          up front, would put dozens of dialogs in the DOM to show none of
          them. It stays mounted after closing so the sheet's exit animation
          has something to animate — the `key` is what makes the NEXT opening
          a clean one. */}
      {opened > 0 && (
        <TipSheet
          key={opened}
          open={open}
          onClose={() => setOpen(false)}
          target={target}
        />
      )}
    </div>
  );
}
