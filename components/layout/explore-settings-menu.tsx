"use client";

import { IconCheckbox, IconCheckboxChecked } from "@/components/ui/icons";
import { useGate } from "@/hooks/use-gate";
import { useSettings, useUpdateSettings } from "@/features/settings";
import { IconTopCaret } from "@/components/ui/topbar-icons";
import { IconExploreClose, IconExploreLocation, IconExploreTrends } from "@/components/ui/home-icons";

/**
 * EXPLORE SETTINGS — node 1317:158022 (SQUARE 2.0, 4tFF5q0CzOSrADkpCOAE03),
 * the panel Home's settings pill opens. The panel's own box (347 wide,
 * `#201F1F`, radius 22, 16 of padding, rows 12 apart, 14 blur, 18% ring) is
 * `RailMenu`'s `explore` variant; this is what sits inside it.
 *
 * ─── THE FILE'S ROWS ─────────────────────────────────────────────────────────
 *   · the heading (1317:158024): the 12 x 16 `xmark` in `#9B9B9B`, 10 before
 *     "Explore Settings" at 700 14/20 (Roboto in the file; Geist here, the
 *     repo's standing rule);
 *   · "Explore location" (1317:158029): 34 tall on 3% white at radius 12,
 *     14/8 of padding, the label at Geist SemiBold 14/18.2, a 4 x 8 white
 *     chevron at the right edge — the row that opens the location sheet;
 *   · "Show content in this location" (1317:158035, 59 tall) and "Trends For
 *     You" (1317:158045, 62 tall): 12/8 of padding, an 8 gap, a 20px glyph in
 *     `#9B9B9B`, the title at SemiBold 14/18.2 over a 12/16 line at 80% white
 *     (245 wide, two lines), and a 16px `tick-square` at the right.
 *
 * Each row also carries a "13" at x=294 in 40% white — 1317:158034/43/51 —
 * that the file's own render does not show (the checkbox sits on top of it,
 * and the location row clips it). It is not drawn.
 *
 * ─── THE TWO CHECKBOXES ──────────────────────────────────────────────────────
 * "Show content in this location" IS LIVE, under the service's own name:
 * `privacy.personalizeByPlace` on `GET /me/settings` (defaults true), written
 * as `PATCH /me/settings { privacy: { personalizeByPlace } }` — the body is a
 * strict object, so the key goes under `privacy` exactly as the settings
 * screen writes it, through the SAME `useSettings` / `useUpdateSettings`
 * (one owner; the mutation is optimistic and rolls back on refusal, and the
 * service invalidates the viewer's for-you page itself). What it does: lifts
 * posts whose author's DECLARED place matches the viewer's — city, then
 * region, then country — declared only, never anything observed. The row's
 * copy is the file's. Signed out there is nothing to read, so the tap is the
 * sign-in; a service without the key (an older stage) leaves the box inert
 * with the reason, as the settings screen does.
 *
 * "Trends For You" stays a real `disabled` control with the reason on it: the
 * trending route is global with no viewer parameter, and what "personalised"
 * would rank on is a product question with the owner (flagged-capability
 * rule — visible and inert, never a switch that flips nothing).
 *
 * "Explore location" IS live: it opens the location sheet, which writes
 * `city`/`region` through `PATCH /me` — the field Explore's people filters
 * already read. The sheet is mounted by the row's owner (the panel closes
 * when it opens, and a sheet inside a closed menu would close with it).
 */
const MISSING = "Not offered by the service yet";

export function ExploreSettingsMenu({ close, onLocation }: { close: () => void; onLocation: () => void }) {
  const gate = useGate();
  const settings = useSettings();
  const save = useUpdateSettings();
  // Present only once the service carries the key; `undefined` is "not here".
  const byPlace = settings.data?.privacy?.personalizeByPlace;
  return (
    <>
      {/* 1317:158024 — the heading row. */}
      <div className="flex h-5 items-center gap-[10px]">
        <button
          type="button"
          onClick={close}
          aria-label="Close explore settings"
          className="ws-press flex h-4 w-3 shrink-0 items-center justify-center text-[#9B9B9B] transition-colors hover:text-white"
        >
          <IconExploreClose className="h-4 w-3" />
        </button>
        <h2 className="min-w-0 flex-1 text-[14px] font-bold leading-5 text-white">Explore Settings</h2>
      </div>

      {/* 1317:158028 — the rows, 8 apart. */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            close();
            onLocation();
          }}
          className="ws-press flex h-[34px] w-full items-center justify-between rounded-xl bg-white/[0.03] px-2 text-left transition-colors hover:bg-white/[0.06]"
        >
          <span className="text-[14px] font-semibold leading-[18.2px] text-white">Explore location</span>
          {/* 1317:158032 — 4 x 8; the same vuesax caret as the pill's, turned to point right. */}
          <span className="relative h-[8px] w-[4px] shrink-0 text-white">
            <IconTopCaret className="absolute -left-[3.5px] -top-[0.5px] h-[7px] w-[11px] -rotate-90" />
          </span>
        </button>

        <PreferenceRow
          height={59}
          icon={<IconExploreLocation className="h-5 w-5" />}
          title="Show content in this location"
          body="When this is on, you’ll see what’s happening around you right now."
          // Unread (signed out, still loading) shows the service's default, on.
          checked={byPlace ?? true}
          disabledReason={settings.isSuccess && byPlace === undefined ? MISSING : null}
          onChange={(value) => gate(() => save.mutate({ privacy: { personalizeByPlace: value } }))}
        />
        <PreferenceRow
          height={62}
          icon={<IconExploreTrends className="h-5 w-5" />}
          title="Trends For You"
          body="You can personalize trends based on your location and who you follow."
          checked={false}
          disabledReason={MISSING}
        />
      </div>
    </>
  );
}

/** 1317:158035 / 1317:158045 — a preference row with the file's tick-square. */
function PreferenceRow({
  height,
  icon,
  title,
  body,
  checked,
  disabledReason,
  onChange,
}: {
  height: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  checked: boolean;
  /** Set, the box is a real `disabled` control carrying this reason. */
  disabledReason: string | null;
  onChange?: (value: boolean) => void;
}) {
  return (
    <div
      className="flex w-full items-center gap-2 rounded-xl bg-white/[0.03] px-2 py-3"
      style={{ height }}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#9B9B9B]">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
        <p className="text-[14px] font-semibold leading-[18.2px] text-white">{title}</p>
        <p className="text-[12px] leading-4 text-white/80">{body}</p>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={title}
        disabled={disabledReason !== null}
        title={disabledReason ?? undefined}
        onClick={() => onChange?.(!checked)}
        className="ws-press flex h-4 w-4 shrink-0 items-center justify-center text-white/50 transition-colors hover:text-white disabled:cursor-not-allowed disabled:hover:text-white/50"
      >
        {checked ? <IconCheckboxChecked className="h-4 w-4" /> : <IconCheckbox className="h-4 w-4" />}
      </button>
    </div>
  );
}
