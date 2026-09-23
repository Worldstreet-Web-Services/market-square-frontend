"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import Link from "next/link";
import { useHouse, useHouseMembers } from "@/features/messages/lib/house";
import { useJoinGroup } from "@/features/messages";
import { sq } from "@/lib/square-path";
import { profileHref } from "@/lib/profile-href";
import { cn } from "@/lib/cn";

/**
 * A HOUSE'S OWN PAGE — nodes 1285:36373 and 1285:36895 (SQUARE 2.0 Copy).
 *
 * The two nodes are ONE page in two states, and the only difference between
 * them is the button: "Join House" for somebody outside it, "View House" for a
 * member. That is `viewerIsMember` off the house read, so the page is built
 * once and the service decides which of the two it is.
 *
 * It is a ROUTE, not a sheet (ogazboiz, 2026-09-23: "just like the way normal
 * person avatar is taking me to his own profile"). Tapping a house anywhere
 * goes to /houses/<id>, the way tapping a face goes to /u/<username> — the
 * preview sheet answered a tap with a modal, which is a different gesture with
 * a different meaning and no address you can send anyone.
 *
 * ─── WHAT THE FILE DRAWS THAT IS NOT HERE, AND WHY IT IS NOT STUBBED ─────────
 * The design also carries a website, a location, a "gistrooms/week" figure and
 * a Replays rail, and the service has a field for none of them. Members DOES
 * render, off `GET /conversations/:id/members` — but that route is bearerAuth,
 * so a signed-out reader and a stranger to a private house see no row at all,
 * while the design draws it in the NON-MEMBER state. The fix is a capped
 * roster on the house read itself; the backend has taken it, public houses
 * only, because a private house deliberately never enumerates who is inside.
 *
 * Replays needs a `houseConversationId` filter on `GET /streams` — taken too.
 * The weekly figure turned out to be a REAL CAP a house sets rather than
 * design filler, so it is a feature being built and NOT a number to draw until
 * the service enforces it.
 *
 * So those sections are ABSENT rather than empty. A shelf captioned "Members"
 * with nothing on it tells a reader the house has no members, which is a
 * claim, and a false one. Each gap is with the backend and each lands here as
 * it ships.
 *
 * ─── THE FILE'S ROBOTO IS GEIST HERE ─────────────────────────────────────────
 * The node sets the house name, "Back" and the section headings in Roboto.
 * `app/layout.tsx` names the two surfaces whose design genuinely is Roboto and
 * says nothing else may reach for it, so this uses the product's own face.
 */
export function HouseProfileScreen({ id }: { id: string }) {
  const router = useRouter();
  const house = useHouse(id);
  const join = useJoinGroup();
  const members_ = useHouseMembers(id, Boolean(house.data));
  const [expanded, setExpanded] = useState(false);

  if (house.missing) {
    return (
      <div className="px-4 py-10">
        <EmptyState
          title="This house isn't here"
          body="It may have been removed, or it may be private."
        />
      </div>
    );
  }

  const data = house.data;
  const title = data?.title ?? "House";
  const members = data?.memberCount ?? null;

  /*
    THE COLUMN'S OWN INSET. The node puts the page column at x=112 and the
    cover at x=144 — 32 between them — so the cover never touches the rule that
    separates this column from the rail beside it (ogazboiz, 2026-09-23: "no
    space in the left hand side touching the border line"). Built edge to edge
    it read as a bleed nobody asked for.
  */
  return (
    <div className="mx-auto w-full max-w-[773px] px-4 pb-16 pt-6 md:px-8">
      {/*
        `Caver` — 741 x 473 at a 20 radius, the house picture full-bleed with a
        scrim at each end: 108 down from the top so Back stays readable, and
        215 up from the bottom so the name does. Both are the file's own.
      */}
      <div className="relative aspect-[741/473] w-full overflow-hidden rounded-[20px] bg-[#101012]">
        {data?.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
          <img src={data.imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#241640_0%,#101012_70%)]" />
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[23%]"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0))" }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[46%]"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))" }}
        />

        {/* `Frame 1000002771` — 24 in and 24 down, a 20 glyph and the label 8 away. */}
        <button
          type="button"
          onClick={() => router.back()}
          className="ws-press absolute left-6 top-6 flex items-center gap-2 text-[16px] leading-6 text-white"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none">
            <path
              d="M12.5 4.5 7 10l5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>

        {/* `Frame 2147230511` — the name over the count, on the cover. */}
        <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-4">
          {/*
            NO AVATAR BESIDE THE NAME, and that is a departure with a reason.
            The node draws a 72 picture next to the title because its cover is
            a DIFFERENT image — a photograph behind, the house's own mark in
            front. A house here has exactly one `imageUrl`, so reproducing the
            node means printing the same picture twice, a few pixels apart
            (ogazboiz, 2026-09-23: "the background banner image we are using it
            has the image already"). The banner is the picture; the name sits
            on it.
          */}
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="truncate text-[24px] font-bold leading-8 text-white">{title}</h1>
              {/* Never "0 members": a null count means the payload does not
                  count them, which is a different claim. */}
              {members !== null && (
                <p className="flex items-baseline gap-1 text-[15px] leading-5">
                  <span className="tnum font-semibold text-[#F7F9F9]">{members.toLocaleString()}</span>
                  <span className="text-white">{members === 1 ? "member" : "members"}</span>
                </p>
              )}
            </div>
          </div>

          {/* `Frame` at 700,494 — the action and its overflow, 16 apart. The
              node draws TWO states of one button and the service decides
              which: a member views, everybody else joins. */}
          <div className="flex shrink-0 items-center gap-4">
            {data?.viewerIsMember ? (
              <a
                href={sq(`/messages?c=${id}`)}
                className="ws-btn-welcome ws-btn-sm ws-press flex items-center justify-center whitespace-nowrap rounded-full font-medium text-white"
              >
                View House
              </a>
            ) : (
              <button
                type="button"
                disabled={!data?.canJoin || join.isPending}
                title={data && !data.canJoin ? "This house isn't open to join" : undefined}
                onClick={() => join.mutate(id)}
                className="ws-btn-welcome ws-btn-sm ws-press flex items-center justify-center whitespace-nowrap rounded-full font-medium text-white disabled:opacity-40"
              >
                Join House
              </button>
            )}
          </div>
        </div>
      </div>

      {/* `Frame 2147230547` — the body, 24 between its blocks. */}
      <div className="flex flex-col gap-6 pt-6">
        {data?.description && (
          <p className={cn("text-[15px] leading-5 text-[#F7F9F9]", !expanded && "line-clamp-6")}>
            {data.description}{" "}
            {!expanded && data.description.length > 260 && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="ws-press font-medium text-accent"
              >
                Read more
              </button>
            )}
          </p>
        )}

        {house.isPending && (
          <div aria-hidden className="h-5 w-40 animate-pulse rounded bg-white/10" />
        )}

        {/*
          `Frame 2147230544` — Members: the heading, then 104-wide tiles 24
          apart, each a 104 x 113 picture at a 32 radius with the name 8 under
          it. The row is ABSENT rather than empty when the roster cannot be
          read: "we may not see who is in here" and "nobody is in here" are
          different things and must not look the same.
        */}
        {members_.data && members_.data.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-[12px] font-bold leading-4 text-[#F4F4F4]">Members</h2>
            <ul className="flex gap-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {members_.data.slice(0, 12).map((member) => (
                <li key={member.profile.id} className="flex w-[104px] shrink-0 flex-col gap-2">
                  <Link
                    href={sq(profileHref(member.profile))}
                    className="ws-press block h-[113px] w-[104px] overflow-hidden rounded-[32px] bg-[#EDEDED]"
                  >
                    <Avatar
                      name={member.profile.displayName || member.profile.username}
                      seed={member.profile.id}
                      src={member.profile.avatarUrl}
                      size={113}
                      sizeClassName="size-full"
                      className="rounded-none border-0"
                    />
                  </Link>
                  <p className="truncate text-center text-[14px] leading-6 text-white">
                    {member.profile.displayName || member.profile.username}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
