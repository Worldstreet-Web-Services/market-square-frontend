/**
 * HOW FAR TO SCALE A FIXED-SIZE COMPOSITION SO IT FITS THE ROOM.
 *
 * For a design that is laid out at ONE size with its parts absolutely placed —
 * the friends popup's 441 x 472 card, and anything else drawn that way. Such a
 * card cannot simply be narrowed: `max-width` shrinks the BOX while every
 * child keeps the offset it was given, so the whole composition slides off
 * centre. That is the bug this exists for. On a 390px phone the popup's card
 * came down to 358 while its heart, avatar, headline and buttons stayed
 * positioned for 441, putting all of them (441 - 358) / 2 = 41px right of
 * where they belong.
 *
 * Scaling keeps every relationship the design specifies and simply makes the
 * whole thing smaller, which is what a fixed composition wants.
 *
 * NEVER SCALES UP. A design drawn at 441 is drawn for 441; blowing it up on a
 * wide screen makes a modal that dominates the page and turns crisp text
 * fuzzy on any non-integer factor.
 */
export function fitScale({
  width,
  height,
  roomWidth,
  roomHeight,
}: {
  /** The composition's own width, in its own units. */
  width: number;
  /** Its own height. */
  height: number;
  roomWidth: number;
  roomHeight: number;
}): number {
  if (!(width > 0) || !(height > 0)) return 1;
  if (!Number.isFinite(roomWidth) || !Number.isFinite(roomHeight)) return 1;
  // A room not measured yet reads as 0. Scaling to 0 would blank the card for
  // a frame; leaving it at 1 shows the design at full size and then settles.
  if (roomWidth <= 0 || roomHeight <= 0) return 1;
  return Math.min(1, roomWidth / width, roomHeight / height);
}
