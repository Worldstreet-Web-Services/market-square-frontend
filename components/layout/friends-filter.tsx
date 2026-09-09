"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MenuRow } from "@/components/ui/menu-row";
import {
  IconFilterChevron,
  IconFilterChevronRight,
  IconFilterFriends,
  IconFilterGender,
  IconFilterLocation,
} from "@/components/ui/home-icons";

/**
 * THE FILTER ON "MAKE SOME FRIENDS" — node 647:17482 (the pill) and 651:18441
 * (the menu under it).
 *
 * ─── THE PILL ────────────────────────────────────────────────────────────────
 * 136 x 38, fully rounded, `#979797` at 5% — which on the `#0F0F0F` page
 * composites to a hair above the ground, and that is the whole pill; there is
 * no stroke (the raw node's `strokes` is empty). "Location" is Geist SemiBold
 * 16/23.96 in white, 25 from the left edge; the 7 x 3.5 chevron sits 20 from
 * the right at a 2px round stroke. The file's `chevron-left` frame at x=10.5
 * is EMPTY — no children — so nothing is drawn there.
 *
 * The file draws the chevron pointing UP beside the OPEN menu. Closed, it
 * turns to point down: that is the one state the file does not draw, and a
 * chevron that never moves tells the reader nothing about what a press does.
 *
 * ─── THE MENU ────────────────────────────────────────────────────────────────
 * 172 wide, `#1C1C1C` (which is `--color-grey-800`), an 8px radius and a
 * 0.745px `white/18` inside ring, 11.913 of padding, rows 5.957 apart. It hangs
 * 3px under the pill with its right edge 2px inside the pill's — the file's
 * own offsets (menu right -1018 against pill right -1016; menu top 49858
 * against pill bottom 49855).
 *
 * The rows are the DM menu's `MenuRow` at 74.46% — `size="compact"` — with the
 * file's three glyphs in `--color-grey-400` and its own trailing chevron. Each
 * row also carries a `13` count in the file that is `visible: false`, and so
 * is not drawn.
 *
 * ─── WHAT THE ROWS DO ────────────────────────────────────────────────────────
 * Nothing yet, and they say so. Each row's chevron promises a second step —
 * pick a place, pick a gender — and the file draws only this first one.
 * `GET /profiles` DOES take `city`, `region` and `gender`, so the deck can
 * narrow the moment those pickers exist; until they do, a row that closed the
 * menu and changed nothing would be lying about what it did. So they are real
 * `disabled` buttons with the reason on them, the same rule the chat inbox's
 * tabs follow — not hidden, which loses the roadmap, and not live, which lies.
 */
export function FriendsFilter({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  const hint = "Coming soon";

  return (
    /*
      ESCAPE CLOSES IT and focus goes back to the pill — handled on the wrapper
      because focus is inside this subtree whenever the menu is open, so the
      keydown bubbles here without a document listener.
    */
    <div
      className={cn("relative shrink-0", className)}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        close();
        trigger.current?.focus();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="Filter people"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="ws-press flex h-[38px] w-[136px] items-center justify-between rounded-full bg-[#979797]/5 pl-[25px] pr-[19px] text-[16px] font-semibold leading-[24px] text-white transition-colors hover:bg-[#979797]/10"
      >
        Location
        <IconFilterChevron
          className={cn(
            "h-[6px] w-[9px] transition-transform motion-reduce:transition-none",
            !open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          {/* A full-screen catcher rather than a blur listener: a click that
              lands on the deck behind the menu must close it, not decide
              about a person. */}
          <div className="fixed inset-0 z-10" onClick={close} />
          <div
            role="menu"
            aria-label="Filter people by"
            className="ws-popover-enter absolute right-[2px] top-[calc(100%+3px)] z-20 flex w-[172px] flex-col gap-[5.957px] rounded-lg border-[0.745px] border-white/[0.18] bg-grey-800 p-[11.913px]"
          >
            <MenuRow
              size="compact"
              icon={<IconFilterLocation className="h-[11.81px] w-[12.25px] text-grey-400" />}
              label="Location"
              trailing={<IconFilterChevronRight className="h-[3.57px] w-[1.79px] text-white" />}
              hint={hint}
            />
            <MenuRow
              size="compact"
              icon={<IconFilterFriends className="h-[9.64px] w-[13.13px] text-grey-400" />}
              label="Friends"
              trailing={<IconFilterChevronRight className="h-[3.57px] w-[1.79px] text-white" />}
              hint={hint}
            />
            <MenuRow
              size="compact"
              icon={<IconFilterGender className="h-3.5 w-3.5 text-grey-400" />}
              label="Gender"
              trailing={<IconFilterChevronRight className="h-[3.57px] w-[1.79px] text-white" />}
              hint={hint}
            />
          </div>
        </>
      )}
    </div>
  );
}
