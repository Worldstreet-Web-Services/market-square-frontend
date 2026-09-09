/**
 * THE WELCOME COLUMN'S FIT ARITHMETIC — the two numbers `WelcomeFrame`
 * publishes, pulled out so they can be checked without a browser.
 *
 * See `fitReflowedColumn` in `components/layout/welcome/welcome-art.tsx` for
 * what measures the column and what the stylesheet does with these; this file
 * is only the maths.
 */

/**
 * The viewport height at which the reflowed welcome layout stops being tight.
 * 390x844 is the phone the design was tuned for and every gap is the file's own
 * at that height and above — so `welcomeAir` MUST return exactly 1 there, or
 * this fix would move a screen that was already correct.
 */
export const AIR_FULL_AT = 844;

/**
 * How far the air is allowed to close up. Below this the gaps have stopped
 * being rhythm and the screen should overflow into the gate's scroll instead —
 * a reachable button under a scroll beats an unreadable one that fits.
 */
export const AIR_FLOOR = 0.55;

/** The band's share of the stage's height. The stylesheet's own 0.55. */
export const BAND_SHARE = 0.55;

/** The stage's aspect, 1440:1024 — the design frame's. */
export const STAGE_ASPECT = 1440 / 1024;

/**
 * The factor every GAP in the reflowed column is multiplied by: 1 on a phone
 * 844 tall or taller, falling linearly to `AIR_FLOOR` on shorter ones.
 *
 * Computed in TypeScript because CSS cannot divide a length by a length to
 * produce the bare number `calc()` needs in order to scale a px value.
 */
export function welcomeAir(viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 1;
  return Math.min(1, Math.max(AIR_FLOOR, viewportHeight / AIR_FULL_AT));
}

/**
 * The vertical room genuinely left for the art band, converted back into the
 * STAGE WIDTH that would fill it — which is the form the stylesheet's
 * `--ws-stage-w` can take a `min()` of against the design's 130vw.
 *
 * Negative room is zero, not a negative width: the stylesheet floors the stage
 * at 60vw anyway, and a negative here would make `min()` pick a nonsense value.
 */
export function bandCapWidth(room: number): number {
  if (!Number.isFinite(room) || room <= 0) return 0;
  return (room / BAND_SHARE) * STAGE_ASPECT;
}
