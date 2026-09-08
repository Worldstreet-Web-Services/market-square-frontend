/**
 * WHERE THE FAN SITS IN ITS ROW — the one arithmetic decision in the friends
 * deck, pulled out so it can be checked without a browser.
 *
 * The deck draws three cards at the file's own hand-placed offsets (node
 * 225:3374). Two different things need centring depending on how the deck is
 * being used, and getting that wrong is invisible in code review and obvious
 * on a phone:
 *
 * · IN THE FEED the whole fan is on screen and is one block among many, so the
 *   GROUP is what must be centred. At three cards the file's own placement
 *   stands untouched; with one or two — a square with barely anyone on it, or
 *   the ends of the list — the remaining cards would sit off to one side of an
 *   empty row, so the group shifts by the mean of the offsets actually drawn.
 *
 * · ON `/pals` the deck IS the screen and the fan is deliberately WIDER than
 *   the column, its outer cards bleeding off both edges. Centring the group
 *   there is meaningless, because most of the group is not visible. What has to
 *   be centred is the FRONT card — the one being decided about.
 *
 * ─── THE FRONT CARD IS NOT AT ZERO, AND THAT WAS THE BUG ────────────────────
 * `DECK_PLACES[0].x` is **-14.09**: the file puts the front card slightly left
 * of the group's middle, and the two neighbours are not symmetric about it
 * either (-129.32 and +128.21). An earlier version returned 0 when filling, on
 * the written assumption that the front card "already sits at x=0". It does
 * not. At the fill scale of 1.45 that left the card 20px left of the column's
 * centre on every phone — off-centre by exactly the file's own asymmetry,
 * multiplied.
 *
 * So filling returns the NEGATION of the front card's own offset, which is the
 * only shift that lands it dead centre.
 */
export function deckShift({
  fill,
  offsets,
  frontX,
}: {
  /** True on `/pals`, where the deck fills the screen and the outer cards bleed. */
  fill: boolean;
  /** The x offset of every card actually drawn, in file units. */
  offsets: readonly number[];
  /** `DECK_PLACES[0].x` — where the file puts the front card. */
  frontX: number;
}): number {
  if (fill) return -frontX;
  // Three cards is the file's own composition; it is placed by hand and is not
  // ours to average.
  if (offsets.length >= 3 || offsets.length === 0) return 0;
  return -offsets.reduce((a, b) => a + b, 0) / offsets.length;
}
