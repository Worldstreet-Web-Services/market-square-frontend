/**
 * The sidebar's width, as the reader sets it.
 *
 * The rail used to be two fixed sizes chosen by a breakpoint: an icon strip
 * below `xl` and a 224px labelled rail above it. That is a guess about what a
 * screen is for. A 1280px laptop and a 2560px monitor both land in "labelled",
 * and neither reader can say "I want the labels" or "give the timeline that
 * space back". These helpers own the arithmetic for a rail the reader drags,
 * so the component keeps only the pointer plumbing and the state lives in one
 * testable place.
 *
 * Widths are px because the rail is a fixed-size column beside a fluid one:
 * a percentage would grow the nav on a wide screen, which is the opposite of
 * what the extra room is for.
 */

/** The icon rail: one glyph plus its padding, no labels. */
export const RAIL_ICON_W = 72;
/** Narrowest LABELLED rail — below this the longest nav word wraps. */
export const RAIL_MIN_W = 180;
/** Widest, so the nav can never eat the column it navigates. */
export const RAIL_MAX_W = 380;
/** The breakpoint default, and what a reset returns to. */
export const RAIL_DEFAULT_W = 224;
/**
 * Drag below this and the rail becomes icon-only.
 *
 * Set between the icon width and the labelled minimum so the collapse is a
 * deliberate pull rather than something a small overshoot triggers.
 */
export const RAIL_SNAP_W = 140;

export type RailMode = "icon" | "full";

export interface RailState {
  mode: RailMode;
  /** Width of the LABELLED rail. Kept while collapsed so expanding restores it. */
  width: number;
}

export const RAIL_DEFAULT: RailState = { mode: "full", width: RAIL_DEFAULT_W };

/** The width actually rendered for a state. */
export function railWidth(state: RailState): number {
  return state.mode === "icon" ? RAIL_ICON_W : clampRail(state.width);
}

export function clampRail(width: number): number {
  return Math.min(RAIL_MAX_W, Math.max(RAIL_MIN_W, Math.round(width)));
}

/**
 * Where a drag to `x` (px from the shell's left edge) leaves the rail.
 *
 * Past the snap point it collapses to icons and REMEMBERS the labelled width,
 * so dragging back out returns to the size the reader chose rather than to a
 * default they did not.
 */
export function railFromDrag(x: number, previous: RailState): RailState {
  if (x < RAIL_SNAP_W) return { mode: "icon", width: previous.width };
  return { mode: "full", width: clampRail(x) };
}

/** Toggle used by the collapse button and the separator's keyboard handling. */
export function toggleRail(state: RailState): RailState {
  return { ...state, mode: state.mode === "icon" ? "full" : "icon" };
}

/**
 * Read a persisted rail, refusing anything that is not one.
 *
 * A stored value is data from a previous version of this code, so it is parsed
 * rather than trusted: a bad width would otherwise render a nav 4000px wide
 * with no way to reach the control that fixes it.
 */
export function parseRail(raw: string | null): RailState | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { mode, width } = value as { mode?: unknown; width?: unknown };
  if (mode !== "icon" && mode !== "full") return null;
  if (typeof width !== "number" || !Number.isFinite(width)) return null;
  return { mode, width: clampRail(width) };
}

export const RAIL_STORAGE_KEY = "ms:sidebar-rail";
