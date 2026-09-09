"use client";

import { useEffect, useState, type RefObject } from "react";
import { Avatar } from "@/components/ui/avatar";
import { newPostsLabel } from "@/lib/new-posts";

/**
 * "N NEW POSTS" — the pill that floats over the timeline while posts wait.
 *
 * NO FIGMA NODE EXISTS FOR THIS. It is drawn from the design language in
 * CLAUDE.md rather than a frame: `ws-popover` (the near-opaque material every
 * floating menu uses — it sits OVER posts and must not be read through), the
 * silver ramp, Geist 500 at 13px, a full round. The
 * geometry is X's — up to three of the new authors' faces overlapping at the
 * left, then the count — because that is the pattern the reader already
 * knows to tap.
 *
 * It is a real button, FIXED to the viewport under the top bars and centred
 * over the column it belongs to — X's placement — so it is where the eye
 * goes whenever the reader is scrolled, however far. It was a sticky row at
 * the head of the list, which pinned nowhere useful once the reader was deep
 * in the page and read as sitting under the cards. The column's centre is
 * measured from `column` and followed on resize; the count is announced
 * politely so a screen reader hears "3 new posts" without being interrupted.
 */
export function NewPostsPill({
  count,
  authors,
  onTap,
  column,
}: {
  count: number;
  authors: { id: string; username: string; displayName: string; avatarUrl?: string | null }[];
  onTap: () => void;
  /** The list the pill floats over; its horizontal centre is the pill's. */
  column: RefObject<HTMLElement | null>;
}) {
  const label = newPostsLabel(count);
  const [centre, setCentre] = useState<number | null>(null);
  useEffect(() => {
    const place = () => {
      const node = column.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setCentre(rect.left + rect.width / 2);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [column]);
  if (centre === null) return null;
  return (
    <div
      className="pointer-events-none fixed top-[calc(var(--ws-topbar-h)+var(--ws-crumb-h)+12px)] z-30 flex -translate-x-1/2"
      style={{ left: centre }}
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onTap}
        // NEARLY OPAQUE, NOT GLASS. `ws-glass` is 70% over a blur, which reads
        // fine over a dark ground and badly over a post: the words behind it
        // showed through the pill and the pill "did not cover it". A control
        // that floats over content is the popover's material (98%), as every
        // menu in the app is — the reader must not read through it.
        className="ws-popover ws-press ws-popover-enter pointer-events-auto flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full pl-2 pr-4 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
      >
        {authors.length > 0 && (
          <span aria-hidden className="flex items-center -space-x-2">
            {authors.map((author) => (
              <Avatar
                key={author.id}
                name={author.displayName || author.username}
                seed={author.id}
                src={author.avatarUrl}
                size={22}
                className="rounded-full ring-2 ring-[#141416]"
              />
            ))}
          </span>
        )}
        <span>{label}</span>
      </button>
    </div>
  );
}
