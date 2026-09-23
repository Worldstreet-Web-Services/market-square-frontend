"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { MODERATOR_LIMIT } from "@/features/streams/lib/moderators";
import { atHandle } from "@/lib/handle";

/**
 * ADD MODERATOR — node 2157:18305 in SQUARE-2.0 (Copy), 347 x 449.
 *
 * 22 radius on `rgba(16,16,18,0.62)`, 16 of padding, 12 between the four
 * blocks: the heading, the search, the list, and Continue.
 *
 * ─── EVERYBODY IN THE ROOM, NOT JUST THE STAGE ───────────────────────────────
 * The candidates are whoever is in the room (ogazboiz: "that is where the host
 * will give someone in the space a moderator"), audience included, because
 * appointing somebody does NOT bring them up — those are two separate acts in
 * either order. The followers and @handles in the mock are placeholder rows;
 * this is the room's own roster, which is also why the search field needs no
 * endpoint. It filters what is already here.
 *
 * A LISTENER MODERATOR CANNOT HOLD THE ROOM OPEN, and that is worth knowing
 * rather than designing around: the room lives while SOMEBODY is publishing, so
 * a host who wants cover for their connection dropping has to invite their
 * moderator to speak as well. The sheet does not do it for them — that would
 * put a microphone live without asking.
 *
 * THE COUNT IS THE SERVICE'S. Three is drawn here so the header can say "1/3
 * selected" before anybody taps, but the cap that holds is the 409 the service
 * answers, and its `details.limit` is what the refusal quotes back.
 */
export function AddModeratorSheet({
  open,
  onClose,
  people,
  moderatorIds,
  onAppoint,
  onRemove,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  /** Everyone in the room — speakers and audience alike. */
  people: readonly { id: string; name: string; username?: string | null; avatarUrl?: string | null }[];
  moderatorIds: readonly string[];
  onAppoint: (userId: string) => void;
  onRemove: (userId: string) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.username ?? "").toLowerCase().includes(q)
    );
  }, [people, query]);

  const count = moderatorIds.length;
  const full = count >= MODERATOR_LIMIT;

  return (
    <Sheet open={open} onClose={onClose} title="Add Moderator">
      <div className="flex flex-col gap-3">
        {/* `Heading 4` — the title over one row, 4 apart. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2.5">
            <p className="flex-1 text-[12px] font-normal leading-[15px] text-white/50">
              Add up to {MODERATOR_LIMIT} moderators
            </p>
            {/* The file's own counter. It is the reason the cap is drawn at all:
                a host should know they are on their last one BEFORE choosing. */}
            <p className="shrink-0 text-[10px] font-normal leading-[15px] text-white">
              {count}/{MODERATOR_LIMIT} selected
            </p>
          </div>
        </div>

        {/* `Frame 2147224962` — 38 tall, pill, TRANSPARENT with a 0.68 hairline
            at white/40. The fill is `#FFFFFF @0.00`, so the border is the whole
            control; painting a panel here would be a different field. */}
        <label className="flex h-[38px] items-center gap-2 rounded-full border-[0.68px] border-white/40 px-2">
          <IconSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search people in this room"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-[22px] tracking-[-0.112px] text-white placeholder:text-meta focus:outline-none"
          />
        </label>

        <ul className="flex max-h-[254px] flex-col gap-3 overflow-y-auto">
          {shown.length === 0 && (
            <li className="py-6 text-center text-[12px] leading-4 text-white/50">
              {query.trim() ? "Nobody here by that name." : "Nobody else is in the room yet."}
            </li>
          )}
          {shown.map((person) => {
            const isModerator = moderatorIds.includes(person.id);
            // Full means no MORE may be added; the ones already appointed must
            // stay tappable or there is no way to undo a mistake.
            const locked = full && !isModerator;
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={busy || locked}
                  aria-pressed={isModerator}
                  title={locked ? `A room can have ${MODERATOR_LIMIT} moderators. Remove one first.` : undefined}
                  onClick={() => (isModerator ? onRemove(person.id) : onAppoint(person.id))}
                  className={cn(
                    // `Overlay+Border` — 54.5 tall at a 12 radius, white/3 under
                    // a white/10 hairline.
                    "flex w-full items-center gap-[9px] rounded-[12px] border border-white/10 bg-white/[0.03] px-2 py-2 text-left transition-colors",
                    locked ? "cursor-not-allowed opacity-40" : "ws-press hover:bg-white/[0.06]"
                  )}
                >
                  <span className="size-[38px] shrink-0 overflow-hidden rounded-full bg-white/10">
                    <Avatar
                      name={person.name}
                      seed={person.id}
                      src={person.avatarUrl}
                      size={38}
                      sizeClassName="size-full"
                      className="rounded-none border-0"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12px] font-bold leading-4 text-white">{person.name}</span>
                    {person.username && (
                      <span className="truncate text-[11px] font-normal leading-[16.5px] text-white/50">
                        {atHandle(person.username)}
                      </span>
                    )}
                  </span>
                  {/* `tick-square` — 16, and it is the STATE rather than a
                      checkbox: filled means they are a moderator right now, so
                      tapping it again takes the role back. */}
                  <IconTickSquare on={isModerator} />
                </button>
              </li>
            );
          })}
        </ul>

        {/* `post-button` — 48 tall, pill, the spotlight purple. The node carries a leading
            User glyph and a trailing ArrowRight and BOTH are `visible: false`,
            so it is the word alone, centred. */}
        <button
          type="button"
          onClick={onClose}
          className="ws-btn-lg ws-press flex w-full items-center justify-center rounded-full bg-spotlight font-semibold tracking-[-0.112px] text-white transition-opacity hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </Sheet>
  );
}

/** `vuesax/linear/search-normal` at 16. */
function IconSearch() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-meta" fill="none">
      <circle cx="7.3" cy="7.3" r="5.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="m13.5 13.5-2.2-2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** `vuesax/outline/tick-square` — empty while they are not one, filled once they are. */
function IconTickSquare({ on }: { on: boolean }) {
  return on ? (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" fill="none">
      <rect x="0.8" y="0.8" width="14.4" height="14.4" rx="4" fill="currentColor" className="text-spotlight" />
      <path d="m4.6 8.2 2.2 2.2 4.6-4.6" stroke="currentColor" className="text-white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" fill="none">
      <rect x="0.8" y="0.8" width="14.4" height="14.4" rx="4" stroke="currentColor" strokeWidth="1.2" className="text-white/40" />
    </svg>
  );
}
