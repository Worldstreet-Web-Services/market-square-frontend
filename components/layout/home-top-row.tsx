"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { AccountMenuItems, RailMenu } from "@/components/layout/app-shell";
import { IconHomeSettings } from "@/components/ui/home-icons";
import { IconTopCaret, IconTopSearch } from "@/components/ui/topbar-icons";

/**
 * THE HEAD OF HOME'S COLUMN — node 1295:142736, the 2026-09-12 Home.
 *
 * A 574 x 48 row: the search field (1295:142737) flexing beside a 67-wide
 * settings pill (1295:142740), 12 apart. The row is as wide as the column's
 * content, so the field takes what the pill leaves.
 *
 * ─── THE FIELD IS A LINK, NOT AN INPUT ───────────────────────────────────────
 * It looks like a field and it goes to Explore's search. Explore owns the query
 * state (`?q=` on `/discover`, read by `discover-screen`), and a second live
 * input here would be a second owner of the same string — the rule the top bar
 * followed before the chrome lost its search. The destination is the one that
 * field used: `/discover`. A room's spoken code no longer has a typed entry on
 * this page; `/code/<code>` still resolves, and the gap is reported rather
 * than papered over with an input the design does not draw.
 *
 * The file's numbers: transparent fill, a 0.68 `#FFFFFF` at 40% INSIDE stroke
 * at a full radius, 8 of side padding, the two drop shadows
 * (`0 5.45 6.81 -4.09` and `0 13.62 17.02 -3.4`, both black at 10%), the 16px
 * `vuesax/linear/search-normal` in `#6D6D6D`, and the placeholder in Geist
 * Medium 16/22 at -0.112 tracking in `#7A7A7A`.
 *
 * The node's copy is " Search Gistrooms, houses, friends..." with a LEADING
 * SPACE: the glyph and the text box touch (glyph 8..24, text from 24), so the
 * space is the file's gap. It is rendered as a 3.78px gap — a Geist Medium
 * 16px space at the node's tracking, measured in Chrome — rather than as a
 * character, so the copy is the words and nothing else.
 *
 * ─── THE PILL'S GLASS ────────────────────────────────────────────────────────
 * The node says `#7A7A7A` at 5% with Figma's GLASS effect, whose parameters the
 * API does not publish. The RENDER is the truth: an opaque near-black lens
 * (17 at the top edge to 30 at the bottom, on a 0–255 scale) with a rim that is
 * brightest top-left and bottom-right and gone on the other diagonal — the same
 * lens the top bar's bell measured in the same file. So it is `ws-glass-pill`
 * for the body and `ws-glass-rim` for the rim, both already matched to that
 * render, rather than a border the file does not draw. Geometry is the node's:
 * radius 36, padding 3/4/3/8, the 24px gear in `#D9D9D9` and the 8 x 4 white
 * caret 23 apart.
 *
 * It opens the ACCOUNT MENU — the same `AccountMenuItems` the top bar's avatar
 * and the rail's chip open — because the file wires no prototype to it and a
 * settings pill beside your own avatar is that menu. Signed out there is no
 * account to open, so the tap is the sign-in, as the top bar's is.
 */
export function HomeTopRow() {
  const { ready, authenticated, login } = useAuth();

  const pill = (
    <span className="ws-glass-pill ws-glass-rim relative flex h-12 w-[67px] shrink-0 items-center gap-[23px] rounded-[36px] py-[3px] pl-1 pr-2">
      <IconHomeSettings className="h-6 w-6 shrink-0 text-[#D9D9D9]" />
      {/* 8 x 4 in the file; the export is 11 x 7 because the 2.29 stroke is
          centred on the path, so it overflows the box it is laid out at. */}
      <span className="relative h-[4px] w-[8px] shrink-0 text-white">
        <IconTopCaret className="absolute -left-px -top-px h-[7px] w-[11px]" />
      </span>
    </span>
  );

  return (
    <div className="flex h-12 items-center gap-3">
      <Link
        href="/discover"
        aria-label="Search Gistrooms, houses, friends"
        className="ws-press flex h-12 min-w-0 flex-1 items-center gap-[3.78px] rounded-full border-[0.68px] border-white/40 px-2 shadow-[0_5.45px_6.81px_-4.09px_rgba(0,0,0,0.1),0_13.62px_17.02px_-3.4px_rgba(0,0,0,0.1)] transition-colors hover:border-white/55"
      >
        <IconTopSearch className="h-4 w-4 shrink-0 text-[#6D6D6D]" />
        <span className="min-w-0 truncate text-[16px] font-medium leading-[22px] tracking-[-0.112px] text-[#7A7A7A]">
          Search Gistrooms, houses, friends...
        </span>
      </Link>

      {ready && !authenticated ? (
        <button type="button" onClick={login} aria-label="Sign in" className="ws-press shrink-0">
          {pill}
        </button>
      ) : (
        <RailMenu
          label="Account"
          align="below"
          panel="gist"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="ws-press block shrink-0"
            >
              {pill}
            </button>
          )}
        >
          {(close) => <AccountMenuItems close={close} />}
        </RailMenu>
      )}
    </div>
  );
}
