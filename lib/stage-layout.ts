/**
 * How many faces fit, and in what shape.
 *
 * The stage is PORTRAIT at every breakpoint — the live room's centre column is
 * a 9:16 player on desktop just as it is on a phone (CLAUDE.md) — so the
 * layout had no business branching on viewport width. It did: two people were
 * stacked on mobile and side-by-side from `md`, and three went to three
 * columns. Three columns inside a 9:16 frame is three vertical slivers, and
 * side-by-side in portrait gives each person a tall sliver of their own. Both
 * are the shape a face fits worst.
 *
 * One shape per count, at every width:
 *
 *   1  one tile, the whole stage
 *   2  TWO STACKED ROWS — a conversation, each face across the full width
 *   3  two abreast, the third spanning underneath
 *   4  the 2x2 grid
 *   5+ the same two columns, filling downward
 *
 * Why three is not three stacked bands: in a 9:16 stage that gives every tile
 * roughly a 3:1 letterbox and drives each toward the minimum height. Two
 * abreast with the third spanning keeps all three near square, which is the
 * entire point of putting people on a stage.
 *
 * Pure, so `lib/stage-layout.test.ts` can pin the shapes without a browser —
 * a layout that silently regresses to slivers is exactly the kind of thing
 * nobody notices until a four-way stream looks broken.
 */

/** The spec caps the stage at six; past that tiles stop being faces. */
export const MAX_STAGE_SLOTS = 6;

/** Grid classes for the stage container, by how many tiles it holds. */
export function stageLayoutClass(count: number): string {
  if (count <= 1) return "grid grid-cols-1 grid-rows-1";
  // Stacked, not side-by-side: in a portrait stage two columns give each
  // person a sliver, while two rows give each of them the full width.
  if (count === 2) return "grid grid-cols-1 grid-rows-2";
  // Two abreast; the third spans below (see `stageTileSpanClass`).
  return "grid grid-cols-2 auto-rows-fr";
}

/**
 * A tile's column span, which only ever differs for the odd one out.
 *
 * At three, the last tile spans both columns so the bottom row is not a
 * half-empty grid with a hole in it. Every other count divides evenly.
 */
export function stageTileSpanClass(count: number, index: number): string {
  return count === 3 && index === 2 ? "col-span-2" : "";
}
