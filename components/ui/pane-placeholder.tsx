import { cn } from "@/lib/cn";

/**
 * THE EMPTY STATE FOR A WHOLE PANE, as the chat surface draws it.
 *
 * A 200px illustration, ten below it a 24/32 heading at `0.01em`, and two below
 * that a 16/24 line at 50% white — the block 352 wide and optically centred in
 * whatever height the pane has.
 *
 * ─── WHY THIS IS NOT `EmptyState` ───────────────────────────────────────────
 * `EmptyState` is the small one: a glyph character, a short title and a line,
 * sized to sit INSIDE a column between other content. This is what a pane shows
 * when the pane itself has nothing in it — a full surface with an illustration,
 * at display size. Both exist because they answer different questions, and a
 * page that has genuinely nothing on it should not look like a gap between two
 * things that do.
 *
 * The two lines are not optional and the illustration is: art is decoration
 * here, but a person who arrives at an empty surface is owed a reason and
 * something to do about it.
 */
export function PanePlaceholder({
  art,
  title,
  body,
  action,
  className,
}: {
  /** The 200px illustration. Rendered as given so each surface owns its own. */
  art?: React.ReactNode;
  title: string;
  body: string;
  /** Optional — the one thing that would fill this surface. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[60vh] flex-col items-center justify-center px-6",
        className
      )}
    >
      <div className="flex w-[352px] max-w-full flex-col items-center gap-10">
        {art}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[24px] font-bold leading-8 tracking-[0.01em] text-white">
            {title}
          </h2>
          <p className="text-[16px] font-normal leading-6 text-white/50">{body}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * The disc the illustrations sit in — a 200px circle at 5% white, which is how
 * `/messages/empty-illustration.svg` is built. Drawn here rather than exported
 * again per surface so a second illustration cannot arrive at a different size
 * or a different tint.
 */
export function PlaceholderDisc({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex h-[200px] w-[200px] shrink-0 items-center justify-center rounded-full bg-white/5 text-white/60"
    >
      {children}
    </span>
  );
}
