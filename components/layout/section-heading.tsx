import Link from "next/link";

/**
 * A SECTION HEADING ON HOME — the object the 2026-09-12 design repeats four
 * times (Top GistRooms, Make some friends, Coming Soon, Popular Houses).
 *
 * The file's values: Manrope Bold 24 / 28.61, the second word carrying the
 * 90deg #C196FD -> #7E3BEB character fill; the "View more" pill 4/3/4/10 with a
 * 14 gap on 4% white at a full radius, its label Manrope SemiBold 10/24 at
 * 0.015em, and the file's own 16px arrow beside it.
 *
 * It is one component because it is one object drawn four times. Four copies of
 * this markup is how one heading ends up a different size from its neighbours
 * the first time somebody adjusts a number.
 */
export function SectionHeading({
  lead,
  accent,
  id,
  subtitle,
  action,
}: {
  /** The plain white half. */
  lead: string;
  /** The half in the gradient — absent where the file sets the heading all white. */
  accent?: string;
  id: string;
  subtitle?: string;
  /** The pill at the right: usually "View more", sometimes a filter. */
  action?: { label: string; href?: string; onPress?: () => void };
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="font-[family-name:var(--font-heading)] text-[24px] font-bold leading-[28.61px] text-white">
          {lead}
          {accent && (
            <>
              {" "}
              <span className="bg-[linear-gradient(90deg,#C196FD_0%,#7E3BEB_100%)] bg-clip-text text-transparent">
                {accent}
              </span>
            </>
          )}
        </h2>
        {subtitle && (
          <p className="pt-0.5 font-[family-name:var(--font-roboto)] text-[10px] font-bold leading-[10.16px] text-white/40">
            {subtitle}
          </p>
        )}
      </div>
      {action && <SectionAction {...action} />}
    </div>
  );
}

/** The pill — a link when it goes somewhere, a button when it opens something. */
function SectionAction({ label, href, onPress }: { label: string; href?: string; onPress?: () => void }) {
  const className =
    "ws-press flex shrink-0 items-center gap-[14px] rounded-full bg-white/[0.04] py-1 pl-2.5 pr-[3px] font-[family-name:var(--font-heading)] text-[10px] font-semibold leading-6 tracking-[0.015em] text-white transition-colors hover:bg-white/[0.08]";
  const inner = (
    <>
      {label}
      {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export */}
      <img src="/home/view-more-arrow.svg" alt="" aria-hidden className="h-4 w-4" />
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onPress} className={className}>
      {inner}
    </button>
  );
}
