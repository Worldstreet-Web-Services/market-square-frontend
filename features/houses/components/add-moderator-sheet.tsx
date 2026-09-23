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

/** `vuesax/linear/search-normal`, exported at 16. Strokes, not a drawn circle. */
function IconSearch() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-meta" fill="none">
      <path d="M7.66732 14.0007C11.1651 14.0007 14.0007 11.1651 14.0007 7.66732C14.0007 4.16951 11.1651 1.33398 7.66732 1.33398C4.16951 1.33398 1.33398 4.16951 1.33398 7.66732C1.33398 11.1651 4.16951 14.0007 7.66732 14.0007Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6673 14.6673L13.334 13.334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * `vuesax/outline/tick-square` — BOTH of the file's states, exported.
 *
 * They are not one shape with a tick added: the empty square is a hollow
 * rounded outline at white/50, and the filled one is a SOLID rounded square
 * with the tick punched out of it as a single path. Drawing the second as the
 * first plus a checkmark gives a different corner radius and a different
 * stroke weight, which is what the hand-drawn version did.
 */
function IconTickSquare({ on }: { on: boolean }) {
  return on ? (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-spotlight" fill="none">
      <path d="M10.794 1.33398H5.20732C2.78065 1.33398 1.33398 2.78065 1.33398 5.20732V10.7873C1.33398 13.2207 2.78065 14.6673 5.20732 14.6673H10.7873C13.214 14.6673 14.6607 13.2207 14.6607 10.794V5.20732C14.6673 2.78065 13.2207 1.33398 10.794 1.33398ZM11.1873 6.46732L7.40732 10.2473C7.31398 10.3407 7.18732 10.394 7.05398 10.394C6.92065 10.394 6.79398 10.3407 6.70065 10.2473L4.81398 8.36065C4.62065 8.16732 4.62065 7.84732 4.81398 7.65398C5.00732 7.46065 5.32732 7.46065 5.52065 7.65398L7.05398 9.18732L10.4807 5.76065C10.674 5.56732 10.994 5.56732 11.1873 5.76065C11.3807 5.95398 11.3807 6.26732 11.1873 6.46732Z" fill="currentColor" />
    </svg>
  ) : (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0 text-white/50" fill="none">
      <path d="M10.0007 15.1673H6.00065C2.38065 15.1673 0.833984 13.6207 0.833984 10.0007V6.00065C0.833984 2.38065 2.38065 0.833984 6.00065 0.833984H10.0007C13.6207 0.833984 15.1673 2.38065 15.1673 6.00065V10.0007C15.1673 13.6207 13.6207 15.1673 10.0007 15.1673ZM6.00065 1.83398C2.92732 1.83398 1.83398 2.92732 1.83398 6.00065V10.0007C1.83398 13.074 2.92732 14.1673 6.00065 14.1673H10.0007C13.074 14.1673 14.1673 13.074 14.1673 10.0007V6.00065C14.1673 2.92732 13.074 1.83398 10.0007 1.83398H6.00065Z" fill="currentColor" />
    </svg>
  );
}
