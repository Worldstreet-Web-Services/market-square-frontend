"use client";

import { cn } from "@/lib/cn";
import type { MentionTyping } from "@/features/feed/hooks/use-mention-typing";

/**
 * The candidate list under an @-token — the composer's, lifted out so the
 * comment boxes draw the same one. Render it only while `typing.token` is
 * open; the caller decides where it sits (in flow under a textarea, floated
 * under a one-line field).
 *
 * `onMouseDown` prevents the field losing focus before the click lands, which
 * is what made a pick close the list without inserting.
 */
export function MentionPicker({
  typing,
  className,
}: {
  typing: MentionTyping;
  className?: string;
}) {
  const { results } = typing;
  return (
    <div
      role="listbox"
      aria-label="People to mention"
      className={cn("ws-popover z-30 max-h-64 overflow-y-auto rounded-2xl p-1.5", className)}
    >
      <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-meta">
        People and groups
      </p>
      {results.isPending && <p className="px-3 py-3 text-xs text-meta">Searching…</p>}
      {results.data?.items.map((mention) => (
        <button
          key={`${mention.type}:${mention.id}`}
          type="button"
          role="option"
          aria-selected={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => typing.pick(mention)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/8"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-xs font-bold text-accent">
            {mention.type === "group" ? "GR" : mention.label.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-heading">{mention.label}</span>
            <span className="block truncate text-xs text-meta">
              @{mention.handle} · {mention.type === "group" ? "Group" : "Person"}
            </span>
          </span>
        </button>
      ))}
      {results.isSuccess && results.data.items.length === 0 && (
        <p className="px-3 py-3 text-xs text-meta">No matching people or groups.</p>
      )}
    </div>
  );
}
