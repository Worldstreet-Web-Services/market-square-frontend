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
 * The label is the file's "Location" at rest and the active value once a
 * clause is on (`friendsFilterLabel`), so the narrowing is visible without
 * opening the menu.
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
 *   · Gender   — "Anyone", then the values the loaded people actually
 *     published (`facetValues`), never a list written here: the service and
 *     the people describing themselves own that vocabulary.
 *
 * A step opens with a Back row at its head, and Escape from anywhere closes
 * the whole menu and returns focus to the pill.
 */
type Step = "root" | "location" | "friends" | "gender";

export function FriendsFilter({
  value,
  onChange,
  viewerCity,
  genders,
  className,
}: {
  value: FriendsFilter;
  onChange: (next: FriendsFilter) => void;
  /** The viewer's own published city, for "Near me". Null when they have none. */
  viewerCity: string | null;
  /** The gender values present among the loaded people — the service's vocabulary. */
  genders: string[];
  className?: string;
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

  const chevron = <IconFilterChevronRight className="h-[3.57px] w-[1.79px] text-white" />;
  /* The file's own chevron, turned round: a step's Back row points the way it goes. */
  const back = <IconFilterChevronRight className="h-[3.57px] w-[1.79px] -scale-x-100 text-white" />;
  /* The file draws no selected state; a row that is on is simply named in the pill.
     Inside a step, the row that is on carries a filled dot in `--color-create`
     so the reader can see which line they are on without leaving the menu. */
  const dot = (on: boolean) =>
    on ? <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-create" /> : undefined;

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
        className="ws-press flex h-[38px] w-[136px] items-center justify-between rounded-full bg-[#979797]/5 pl-[25px] pr-[19px] text-[16px] font-semibold leading-[24px] text-white transition-colors hover:bg-[#979797]/10"
      >
        <span className="min-w-0 truncate">{friendsFilterLabel(value)}</span>
        <IconFilterChevron
          className={cn(
            "h-[6px] w-[9px] shrink-0 transition-transform motion-reduce:transition-none",
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
            {step === "root" && (
              <>
                <MenuRow
                  size="compact"
                  icon={<IconFilterLocation className="h-[11.81px] w-[12.25px] text-grey-400" />}
                  label={value.city.trim() ? `Location · ${value.city.trim()}` : "Location"}
                  trailing={chevron}
                  onClick={() => setStep("location")}
                />
                <MenuRow
                  size="compact"
                  icon={<IconFilterFriends className="h-[9.64px] w-[13.13px] text-grey-400" />}
                  label={value.newOnly ? "Friends · New people" : "Friends"}
                  trailing={chevron}
                  onClick={() => setStep("friends")}
                />
                <MenuRow
                  size="compact"
                  icon={<IconFilterGender className="h-3.5 w-3.5 text-grey-400" />}
                  label={value.gender.trim() ? `Gender · ${value.gender.trim()}` : "Gender"}
                  trailing={chevron}
                  onClick={() => setStep("gender")}
                />
              </>
            )}

            {step === "location" && (
              <>
                <MenuRow size="compact" icon={back} label="Back" onClick={() => setStep("root")} />
                <MenuRow
                  size="compact"
                  icon={dot(value.city === "")}
                  label="Anywhere"
                  onClick={() => set({ city: "" })}
                />
                <MenuRow
                  size="compact"
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
                    className="h-[23.83px] w-full rounded-[8.935px] bg-white/[0.03] px-[5.957px] text-[8.935px] font-medium leading-[11.913px] text-white/80 outline-none placeholder:text-white/40 focus:bg-white/[0.08]"
                  />
                </form>
              </>
            )}

            {step === "friends" && (
              <>
                <MenuRow size="compact" icon={back} label="Back" onClick={() => setStep("root")} />
                <MenuRow
                  size="compact"
                  icon={dot(!value.newOnly)}
                  label="Everyone"
                  onClick={() => set({ newOnly: false })}
                />
                <MenuRow
                  size="compact"
                  icon={dot(value.newOnly)}
                  label="People I don't follow yet"
                  onClick={() => set({ newOnly: true })}
                />
              </>
            )}

            {step === "gender" && (
              <>
                <MenuRow size="compact" icon={back} label="Back" onClick={() => setStep("root")} />
                <MenuRow
                  size="compact"
                  icon={dot(value.gender === "")}
                  label="Anyone"
                  onClick={() => set({ gender: "" })}
                />
                {genders.map((gender) => (
                  <MenuRow
                    key={gender}
                    size="compact"
                    icon={dot(value.gender === gender)}
                    label={gender}
                    onClick={() => set({ gender })}
                  />
                ))}
                {genders.length === 0 && (
                  <MenuRow
                    size="compact"
                    label="Nobody has shared a gender yet"
                    hint="Values appear as people publish them"
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
