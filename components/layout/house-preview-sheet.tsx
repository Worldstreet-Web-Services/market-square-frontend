"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { IconChevronLeft } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { RoomPeopleSection, type RoomPerson } from "@/features/houses";
import { useConversationMembers, useJoinGroup } from "@/features/messages";

/**
 * VIEW A HOUSE BEFORE JOINING — node 1285:36375.
 *
 * A full-screen preview of a community (a public group conversation) reached by
 * tapping a house in the directory / the home grids, so a reader can see what a
 * house is before committing to `POST /conversations/:id/join`.
 *
 * THE FILE draws a 741-wide column: a 473-tall cover carrying Back, the title
 * over its member count, and the Join House pill; then the description with a
 * "Read more", a stats line, a website link, a Members grid and a Replays row.
 *
 * WHAT IS DRAWN HERE, AND WHY NOT THE REST. A house is a `Conversation`
 * (`kind: "group"`), and the service gives it a title, a picture (`imageUrl`),
 * a description and a member count — those are drawn, real. It does NOT carry a
 * website or a "gistrooms/week", and REPLAYS are a capability that does not
 * exist yet (`MARKET_FLAGS.replays` is off — no egress, no storage), so those
 * sections are omitted rather than faked. The members come from
 * `GET /conversations/:id/members`, and the grid is the room's own
 * `RoomPeopleSection`, so a member reads the same everywhere.
 *
 * There is no `GET /conversations/:id`, so the house object is handed in by the
 * grid that already loaded it; only the members are fetched here.
 */
interface PreviewProfile {
  id: string;
  displayName?: string | null;
  username: string;
  avatarUrl?: string | null;
}

export interface HousePreview {
  id: string;
  title: string | null;
  imageUrl: string | null;
  description: string | null;
  memberCount: number | null;
  /** The capped preview roster carried on the Conversation (up to 4). Used as a
      fallback when the full members list can't be read before joining. */
  members?: PreviewProfile[];
}

export function HousePreviewSheet({
  house,
  onClose,
}: {
  house: HousePreview;
  onClose: () => void;
}) {
  const members = useConversationMembers(house.id, true);
  const join = useJoinGroup();
  const [expanded, setExpanded] = useState(false);

  // A dialog closes on Escape and locks the page behind it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const people: RoomPerson[] = useMemo(() => {
    // The full roster if the reader may read it; otherwise the Conversation's
    // own capped preview roster, so a not-yet-member still sees faces.
    const fetched = (members.data?.items ?? []).flatMap((member) =>
      member.profile ? [member.profile] : []
    );
    const source: PreviewProfile[] = fetched.length > 0 ? fetched : (house.members ?? []);
    return source.map((profile) => ({
      id: profile.id,
      userId: profile.id,
      name: profile.displayName || profile.username,
      avatarUrl: profile.avatarUrl,
    }));
  }, [members.data, house.members]);

  const title = house.title ?? "House";
  const count = house.memberCount;
  // The file clamps the description and offers "Read more"; a short one needs no
  // control, so the toggle only appears past a few lines.
  const description = house.description?.trim() ?? "";
  const longDescription = description.length > 220;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ground"
    >
      <div className="mx-auto w-full max-w-[805px] px-4 pb-16 pt-4 md:px-8 md:pt-6">
        {/* ── THE COVER ──────────────────────────────────────────────────────
            741 x 473 in the file (ratio ~0.64), rounded 22, the room's picture
            filling it under a bottom scrim that carries the white furniture. */}
        <div className="relative aspect-[741/473] w-full overflow-hidden rounded-[22px] bg-white/5">
          {house.imageUrl ? (
            // A user-uploaded picture: a plain <img>, since next/image throws on
            // a src it cannot decode (the room cover has shipped that crash).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={house.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Avatar
              name={title}
              seed={house.id}
              size={741}
              sizeClassName="h-full w-full"
              className="rounded-none border-0"
            />
          )}

          {/* The scrim only where the furniture sits, so the picture stays the
              picture at the top. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
          />

          {/* Back, top-left. Closes the preview (it opened over the grid). */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="ws-press absolute left-4 top-4 flex items-center gap-2 text-[16px] font-medium leading-6 text-white transition-opacity hover:opacity-80 md:left-6 md:top-6"
          >
            <IconChevronLeft className="h-5 w-5 shrink-0" />
            Back
          </button>

          {/* Title over count, left; Join House on the right. */}
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 md:inset-x-6 md:bottom-6">
            <div className="min-w-0">
              <h1 className="ws-display truncate text-[24px] leading-8 text-white">{title}</h1>
              {count !== null && (
                <p className="mt-1 text-[14px] leading-5 text-white/70">
                  <span className="tnum">{count.toLocaleString()}</span>{" "}
                  {count === 1 ? "member" : "members"}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={join.isPending}
              onClick={() => join.mutate(house.id, { onSuccess: onClose })}
              className="ws-btn-welcome ws-press flex h-10 shrink-0 items-center justify-center rounded-full px-5 text-[14px] font-semibold leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Join House
            </button>
          </div>
        </div>

        {/* ── DESCRIPTION ────────────────────────────────────────────────── */}
        {description && (
          <div className="mt-6">
            <p className={cn("text-[15px] leading-6 text-body", !expanded && longDescription && "line-clamp-4")}>
              {description}
            </p>
            {longDescription && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="ws-press mt-1 text-[15px] font-medium leading-6 text-create transition-opacity hover:opacity-80"
              >
                {expanded ? "Read less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* ── MEMBERS ───────────────────────────────────────────────────────
            The room's own grid, so a member tile reads the same here as in a
            gist room. */}
        <div className="mt-8">
          <RoomPeopleSection
            title="Members"
            rule={false}
            people={people}
            empty="No members yet."
          />
        </div>
      </div>
    </div>
  );
}
