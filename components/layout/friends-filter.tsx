"use client";

import { GENDER_OPTIONS, genderLabel, normalizeGender } from "@/lib/gender";
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
import { friendsFilterLabel, type FriendsFilter } from "@/lib/friends-filter";

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
 * The label is `friendsFilterLabel`: "Filter" at rest (ogazboiz, 2026-09-12 —
 * it narrows by more than a place, so the file's "Location" would be the
 * untrue word) and the active value once a clause is on, so the narrowing is
 * visible without opening the menu.
 *
 * ─── THE `/pals` PILL, node 1344:21865 ───────────────────────────────────────
 * A different drawing of the same control — `variant="pals"`. 86 x 32 hugging
 * "Location": 4% white at a full radius, padding 4 / 3 / 4 / 10, a 14 gap,
 * the label Manrope SemiBold 10 / 24 at 0.15 tracking, and the file's own 16
 * `arrow-left-01-round` turned to point right, `#9F5AFF` at a 1.5 round
 * stroke — which is byte for byte the "View more" arrow already exported at
 * `public/home/view-more-arrow.svg`, so that file is reused rather than a
 * second copy of it. The pill HUGS its label in the file, so "Filter" draws it
 * narrower than the file's 86 and an active value wider; the height, padding
 * and gap are the file's regardless. Open, the arrow turns to point down at
 * the menu — the one state the file does not draw, for the reason above. The
 * menu under it is the same one on both drawings.
 *
 * ─── THE MENU ────────────────────────────────────────────────────────────────
 * `#1C1C1C` (which is `--color-grey-800`) with a `white/18` inside ring. The
 * file draws it 172 wide at 74.46% scale — 11.913 of padding, rows 5.957 apart,
 * an 8.935px label — and ogazboiz asked for it bigger (2026-09-14), so it is
 * drawn at full scale: 231 wide, 16 of padding, rows 8 apart, which is
 * `MenuPanel` exactly, with the file's 8 radius scaled to 11. It hangs
 * 3px under the pill with its right edge 2px inside the pill's — the file's
 * own offsets (menu right -1018 against pill right -1016; menu top 49858
 * against pill bottom 49855).
 *
 * The rows are the DM menu's own `MenuRow`, unscaled, with the
 * file's three glyphs in `--color-grey-400` and its own trailing chevron. Each
 * row also carries a `13` count in the file that is `visible: false`, and so
 * is not drawn.
 *
 * ─── THE SECOND LEVEL, WHICH THE FILE DOES NOT DRAW ─────────────────────────
 * Each row's chevron promises a next step and the file stops at this panel.
 * The step is drawn IN PLACE, in the same panel with the same rows, rather
 * than as a second popover or a sheet: it is three short lists, and a menu
 * that changes size and material between its levels reads as two controls.
 * Every option is something `GET /profiles` narrows by itself:
 *
 *   · Location — "Anywhere", "Near me" (the viewer's own published city, the
 *     same rule the nearby rail uses; disabled with the reason when they have
 *     not published one), or a city typed in. Exact match on the server.
 *   · Friends  — "Everyone", or only people the viewer does not follow yet
 *     (`excludeFollowing`). Nothing else is offered: "friends of friends" has
 *     no route, and a row the service cannot back is a lie, not a roadmap.
 *   · Gender   — "Anyone", Male or Female (`lib/gender.ts`), the only two
 *     values a profile can hold, so the list never shows five spellings.
 *
 * A step opens with a Back row at its head, and Escape from anywhere closes
 * the whole menu and returns focus to the pill.
 */
type Step = "root" | "location" | "friends" | "gender";

export function FriendsFilter({
  value,
  onChange,
  viewerCity,
  className,
  variant = "home",
}: {
  value: FriendsFilter;
  onChange: (next: FriendsFilter) => void;
  /** The viewer's own published city, for "Near me". Null when they have none. */
  viewerCity: string | null;
  className?: string;
  /** Which drawing of the pill: Home's 647:17482 or `/pals`' 1344:21865. */
  variant?: "home" | "pals";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("root");
  const [cityDraft, setCityDraft] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setStep("root");
  };
  const set = (patch: Partial<FriendsFilter>) => {
    onChange({ ...value, ...patch });
    close();
  };

  const chevron = <IconFilterChevronRight className="h-2 w-1 text-white" />;
  /* The file's own chevron, turned round: a step's Back row points the way it goes. */
  const back = <IconFilterChevronRight className="h-2 w-1 -scale-x-100 text-white" />;
  /* The file draws no selected state; a row that is on is simply named in the pill.
     Inside a step, the row that is on carries a filled dot in `--color-create`
     so the reader can see which line they are on without leaving the menu. */
  const dot = (on: boolean) =>
    on ? <span aria-hidden className="block h-[7px] w-[7px] rounded-full bg-create" /> : undefined;

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
        onClick={() => (open ? close() : setOpen(true))}
        className={
          variant === "pals"
            ? "ws-press flex h-8 shrink-0 items-center gap-[14px] rounded-full bg-white/[0.04] py-1 pl-2.5 pr-[3px] font-[family-name:var(--font-heading)] text-[10px] font-semibold leading-6 tracking-[0.015em] text-white transition-colors hover:bg-white/[0.08]"
            : "ws-press flex h-[38px] w-[136px] items-center justify-between rounded-full bg-[#979797]/5 pl-[25px] pr-[19px] text-[16px] font-semibold leading-[24px] text-white transition-colors hover:bg-[#979797]/10"
        }
      >
        <span className="min-w-0 truncate">{friendsFilterLabel(value)}</span>
        {variant === "pals" ? (
          // eslint-disable-next-line @next/next/no-img-element -- the file's own export
          <img
            src="/home/view-more-arrow.svg"
            alt=""
            aria-hidden
            className={cn(
              "h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none",
              open && "rotate-90"
            )}
          />
        ) : (
          <IconFilterChevron
            className={cn(
              "h-[6px] w-[9px] shrink-0 transition-transform motion-reduce:transition-none",
              !open && "rotate-180"
            )}
          />
        )}
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
            className="ws-popover-enter absolute right-[2px] top-[calc(100%+3px)] z-20 flex w-[231px] flex-col gap-2 rounded-[11px] border border-white/[0.18] bg-grey-800 p-4"
          >
            {step === "root" && (
              <>
                <MenuRow
                  icon={<IconFilterLocation className="h-[13.5px] w-[14px] text-grey-400" />}
                  label={value.city.trim() ? `Location · ${value.city.trim()}` : "Location"}
                  trailing={chevron}
                  onClick={() => setStep("location")}
                />
                <MenuRow
                  icon={<IconFilterFriends className="h-[11px] w-[15px] text-grey-400" />}
                  label={value.newOnly ? "Friends · New people" : "Friends"}
                  trailing={chevron}
                  onClick={() => setStep("friends")}
                />
                <MenuRow
                  icon={<IconFilterGender className="h-4 w-4 text-grey-400" />}
                  label={genderLabel(value.gender) ? `Gender · ${genderLabel(value.gender)}` : "Gender"}
                  trailing={chevron}
                  onClick={() => setStep("gender")}
                />
              </>
            )}

            {step === "location" && (
              <>
                <MenuRow icon={back} label="Back" onClick={() => setStep("root")} />
                <MenuRow
                  icon={dot(value.city === "")}
                  label="Anywhere"
                  onClick={() => set({ city: "" })}
                />
                <MenuRow
                  icon={dot(Boolean(viewerCity) && value.city === viewerCity)}
                  label={viewerCity ? `Near me · ${viewerCity}` : "Near me"}
                  hint={viewerCity ? undefined : "Add your city to your profile first"}
                  onClick={viewerCity ? () => set({ city: viewerCity }) : undefined}
                />
                {/*
                  A typed city. Enter applies it; the service matches it exactly
                  and case-insensitively, so "lagos" finds Lagos. The field is
                  the row's own geometry so the step stays one list.
                */}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (cityDraft.trim()) set({ city: cityDraft.trim() });
                  }}
                >
                  <input
                    type="text"
                    value={cityDraft}
                    onChange={(event) => setCityDraft(event.target.value)}
                    placeholder="Type a city, then Enter"
                    aria-label="City"
                    autoFocus
                    className="h-8 w-full rounded-xl bg-white/[0.03] px-2 text-[12px] font-medium leading-4 text-white/80 outline-none placeholder:text-white/40 focus:bg-white/[0.08]"
                  />
                </form>
              </>
            )}

            {step === "friends" && (
              <>
                <MenuRow icon={back} label="Back" onClick={() => setStep("root")} />
                <MenuRow
                  icon={dot(!value.newOnly)}
                  label="Everyone"
                  onClick={() => set({ newOnly: false })}
                />
                <MenuRow
                  icon={dot(value.newOnly)}
                  label="People I don't follow yet"
                  onClick={() => set({ newOnly: true })}
                />
              </>
            )}

            {step === "gender" && (
              <>
                <MenuRow icon={back} label="Back" onClick={() => setStep("root")} />
                <MenuRow
                  icon={dot(normalizeGender(value.gender) === null)}
                  label="Anyone"
                  onClick={() => set({ gender: "" })}
                />
                {GENDER_OPTIONS.map((option) => (
                  <MenuRow
                    key={option.value}
                    icon={dot(normalizeGender(value.gender) === option.value)}
                    label={option.label}
                    onClick={() => set({ gender: option.value })}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
