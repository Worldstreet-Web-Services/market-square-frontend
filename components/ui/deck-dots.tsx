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
/**
 * The pills' two drawings. `default` is the rooms rail's and `/pals`'. `home`
 * is Home's "Make some friends" row, 647:16296: FIVE pills 5.81 tall at an
 * 18.14 radius on a 3.63 gap, the active one 36.29 wide and the rest 13.79 —
 * the file's last pill reads 12.34, the same hand placement the note above
 * describes, so every inactive one is 13.79.
 */
const DOT_VARIANTS = {
  default: { row: "gap-[2.71px]", pill: "h-[4.33px] rounded-[13.54px]", on: "w-[27.08px]", off: "w-[9.21px]" },
  home: { row: "gap-[3.63px]", pill: "h-[5.81px] rounded-[18.14px]", on: "w-[36.29px]", off: "w-[13.79px]" },
} as const;

export function DeckDots({
  count,
  active,
  className,
  variant = "default",
  onSelect,
}: {
  count: number;
  /** Clamped by the component, so a caller cannot light a pill that is not there. */
  active: number;
  className?: string;
  variant?: keyof typeof DOT_VARIANTS;
  /**
   * Given, each pill is a BUTTON that picks its page — Home's banner
   * (1305:149178), where the dots are the only way between slides. The
   * geometry is unchanged; the hit area is the button around the pill, and the
   * row stops being `aria-hidden` because it is now a control.
   */
  onSelect?: (index: number) => void;
}) {
  const current = Math.min(Math.max(active, 0), count - 1);
  const v = DOT_VARIANTS[variant];
  const pill = (index: number) => (
    <span
      key={onSelect ? undefined : index}
      className={cn(
        v.pill,
        "block transition-all",
        index === current ? cn(v.on, "bg-spotlight") : cn(v.off, "bg-[#D9D9D9]")
      )}
    />
  );
  return (
    <div aria-hidden={onSelect ? undefined : true} className={cn("flex items-center justify-center", v.row, className)}>
      {Array.from({ length: count }, (_, index) =>
        onSelect ? (
          <button
            key={index}
            type="button"
            aria-label={`Slide ${index + 1} of ${count}`}
            aria-current={index === current ? "true" : undefined}
            onClick={() => onSelect(index)}
            className="ws-press flex h-4 items-center"
          >
            {pill(index)}
          </button>
        ) : (
          pill(index)
        )
      )}
    </div>
  );
}
