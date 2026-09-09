"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { Profile } from "@/lib/api/schemas";

/**
 * ONE HOUSE CARD — nodes 534:16956 (your own profile's rail) and 545:47656 (a
 * stranger's), which are the same 427x112 object: a `#101012`/62% fill under
 * a 1px `white/18` stroke at a 20 radius, 16/12 of padding, a 16 gap; an 81x88
 * picture at a 20 radius; a 207-wide text group (title at Geist 600 12/14,
 * the members line 4 under it, the description 8 under that at 400 12/20);
 * and a 26-tall pill on the 90deg purple ramp at the right.
 *
 * The rail on your own profile and the rail on somebody else's used to be
 * candidates for two copies of this markup. They are one card with one
 * difference — what the pill says and where it goes — so the pill is an
 * `action` the surface decides.
 */

/** The one card surface, stated once — the Add tile and a house share it. */
export const HOUSE_CARD =
  "shrink-0 rounded-[20px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)]";

/**
 * The members line — node 534:16962 / 545:47662.
 *
 * Three 20px discs overlapping by 8 (`itemSpacing: -8`), each ringed in solid
 * white so the stack reads as separate faces, then the count 4 away at Geist
 * 500 8/10.4.
 *
 * BOTH HALVES ARE OPTIONAL AND NEITHER IS INVENTED. `members` is the service's
 * preview roster; `memberCount` is nullable ON PURPOSE, because absent means
 * "this payload does not count members" and not "this house has none" — so a
 * missing count prints nothing rather than "0 members". With neither, the
 * line is absent and the title sits straight above the description.
 */
function MemberLine({ members, count }: { members: Profile[]; count: number | null }) {
  // The file draws three; the payload may carry four.
  const faces = members.slice(0, 3);
  if (faces.length === 0 && count === null) return null;
  return (
    <div className="flex items-center gap-1">
      {faces.length > 0 && (
        <div className="flex items-center -space-x-2">
          {faces.map((person) => (
            <Avatar
              key={person.id}
              name={person.displayName || person.username}
              seed={person.id}
              src={person.avatarUrl}
              size={20}
              className="rounded-full ring-1 ring-white"
            />
          ))}
        </div>
      )}
      {count !== null && (
        <span className="tnum text-[8px] font-medium leading-[10.4px] text-white">
          {count.toLocaleString()} {count === 1 ? "member" : "members"}
        </span>
      )}
    </div>
  );
}

export interface HouseCardAction {
  label: string;
  /** A destination, or a handler — never both, never neither. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** The accessible name when the label alone would overclaim — "Sign in to join". */
  title?: string;
}

export function HouseCard({
  id,
  name,
  imageUrl,
  description,
  members,
  memberCount,
  action,
}: {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  members: Profile[];
  memberCount: number | null;
  /**
   * 534:16972 / 545:47672 — 26 tall at a full round, 16/8 of padding, label
   * at Geist 500 8/10.4. Its fill is TWO stacked layers: a `#7E3BEB` solid
   * under an opaque `90deg` gradient, so only the gradient is ever seen — and
   * its stops are `#9F65FD` -> `#5B05E6`, which are `--color-create` and
   * `--color-create-deep` to the byte. That is `ws-btn-welcome`, the existing
   * 90deg utility for exactly this pair.
   */
  action: HouseCardAction;
}) {
  const pill =
    "ws-btn-welcome ws-press flex h-[26px] shrink-0 items-center justify-center rounded-full px-4 text-[8px] font-medium leading-[10.4px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className={cn(HOUSE_CARD, "flex h-[112px] w-[min(427px,100%)] items-center gap-4 px-4 py-3")}>
      {/* 534:16957 / 545:47657 — 81x88 at a 20 radius, and it CLIPS: the
          artwork inside it is 132 wide against the frame's 81, so the picture
          is cropped by the frame rather than squashed into it. */}
      <Avatar
        name={name}
        seed={id}
        src={imageUrl}
        size={88}
        sizeClassName="h-[88px] w-[81px]"
        className="shrink-0 overflow-hidden rounded-[20px]"
      />
      {/* 534:16959 — 8 between the block above and the description,
          4 between the title and the members line inside it. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-[12px] font-semibold leading-[14px] text-white">{name}</p>
          <MemberLine members={members} count={memberCount} />
        </div>
        {/* 534:16971 — 12/20 at 400 in FULL white, two lines. The house's own
            words, so no line at all when there are none. */}
        {description && (
          <p className="line-clamp-2 text-[12px] leading-5 text-white">{description}</p>
        )}
      </div>
      {action.href ? (
        <Link href={action.href} className={pill}>
          {action.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.title}
          aria-label={action.title}
          className={pill}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
