"use client";

import { Avatar } from "@/components/ui/avatar";
import { newPostsLabel } from "@/lib/new-posts";

/**
 * "N NEW POSTS" — the pill that floats over the timeline while posts wait.
 *
 * NO FIGMA NODE EXISTS FOR THIS. It is drawn from the design language in
 * CLAUDE.md rather than a frame: `ws-glass` (the dock's own material, with
 * the dock's shadow), the silver ramp, Geist 500 at 13px, a full round. The
 * geometry is X's — up to three of the new authors' faces overlapping at the
 * left, then the count — because that is the pattern the reader already
 * knows to tap.
 *
 * It is a real button, sticky under the column's chrome, in a zero-height
 * row so it never pushes the list down; and the count is announced politely
 * so a screen reader hears "3 new posts" without being interrupted.
 */
export function NewPostsPill({
  count,
  authors,
  onTap,
}: {
  count: number;
  authors: { id: string; username: string; displayName: string; avatarUrl?: string | null }[];
  onTap: () => void;
}) {
  const label = newPostsLabel(count);
  return (
    <div
      className="pointer-events-none sticky top-[calc(var(--ws-topbar-h)+var(--ws-crumb-h)+12px)] z-30 flex h-0 justify-center"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onTap}
        className="ws-glass ws-press ws-popover-enter pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 text-[13px] font-medium text-white shadow-[0_22px_60px_-19px_rgba(0,0,0,0.95)] transition-colors hover:bg-white/10"
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
