import { cn } from "@/lib/cn";

/**
 * THE PAGE PILLS UNDER A HORIZONTAL DECK — nodes 289:5455 (the friends deck)
 * and the gist-room rail's own row.
 *
 * The file draws the same object in both places, to the same numbers: pills
 * 4.33 tall at a 13.54 radius on a 2.71 gap, the active one 27.08 wide in
 * `--color-spotlight` and the rest 9.21 in #D9D9D9. Only the COUNT differs —
 * five on the rooms rail, three under the deck — so it is one component with a
 * count rather than a third copy of the markup.
 *
 * (The file's own inactive pills measure 10.29 and 9.21 in the same row. Two
 * pills that are meant to be identical and are a pixel apart is hand placement,
 * not a spec, so every inactive one is 9.21 here.)
 *
 * ─── THEY ARE PAGES, NOT ITEMS ──────────────────────────────────────────────
 * A fixed number of pills cannot stand for an unbounded list, and pretending
 * otherwise is how a five-dot row ends up claiming a feed has five things in
 * it. The caller maps its own position onto the count — a scroll offset on the
 * rail, an index over the roster on the deck — and the pills say roughly how
 * far along you are, which is all a row of four-pixel pills can honestly say.
 *
 * `aria-hidden`: it is a picture of progress with no information a reader
 * cannot get from the deck itself, and announcing "list, 3 items" over a
 * roster of forty would be worse than silence.
 */
export function DeckDots({
  count,
  active,
  className,
}: {
  count: number;
  /** Clamped by the component, so a caller cannot light a pill that is not there. */
  active: number;
  className?: string;
}) {
  const current = Math.min(Math.max(active, 0), count - 1);
  return (
    <div aria-hidden className={cn("flex items-center justify-center gap-[2.71px]", className)}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-[4.33px] rounded-[13.54px] transition-all",
            index === current ? "w-[27.08px] bg-spotlight" : "w-[9.21px] bg-[#D9D9D9]"
          )}
        />
      ))}
    </div>
  );
}
