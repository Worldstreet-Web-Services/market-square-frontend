"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { IconFriendsClose, IconProfileWink } from "@/components/ui/profile-icons";
import { useFollow, useWink } from "@/features/profile";
import { useMarkNotificationsRead, useNotifications } from "@/features/notifications";
import { useOpenConversation } from "@/features/messages";
import { friendsMomentCopy, pickFriendsMoment, type FriendsMoment } from "@/lib/friends-popup";
import type { Profile } from "@/lib/api/schemas";

/**
 * "YOU AND FOLA ARE NOW FRIENDS" — node 647:16628, "Follow modals".
 *
 * The popup a person meets on their next sign-in when somebody followed them
 * back, winked at them, or winked back. WHICH moment, and what it says, is
 * `lib/friends-popup` (pure, pinned); this is the picture.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A 441.2 x 472.1 card, `#1A1A1A`, a 0.735px ring in `#6155F5`, radius 25,
 * over a dimmed page. Inside, all absolutely placed from the file:
 *   · the rays vector (647:16629, 600 x 601, its own 6% opacity) behind
 *     everything, and two `#7E3BEB` discs (178, layer blur 197) glowing at
 *     the top-right and bottom-left corners;
 *   · the hugging-heart art (647:16630, 123.5 x 106.5) at (158.8, 43.4) with
 *     its three stars (647:16663) at (127, 36.8);
 *   · two portrait cards at y=155.2: the left one 136.6 x 145.6 at x=93.8
 *     turned -7.35°, the right one 139.9 x 148.5 at x=207.6 turned +9.02°,
 *     each `#EDEDED` under a 4.645 white ring at a 37.16 radius;
 *   · the line at (104.4, 311.8), 238 wide, Manrope Bold 14.7/17.65 centred —
 *     Geist here — with its dim runs at 38% white exactly as the file's
 *     character overrides have them;
 *   · the buttons at (113.2, 364): 214 x 36 on the 90° ramp (`ws-btn-welcome`,
 *     the file's two stops), 5.88 under it a 219 x 36 `#323232` pill with the
 *     wink face at 16.3 and the label 9.4 from it, both labels Geist 500
 *     11.77/20.45;
 *   · the close: a 45 glass disc at (375, 23.5) with the file's 15.4 cross.
 *
 * The file draws the FRIENDS moment. The wink moments reuse it: a first wink
 * shows the other person's card alone, centred where the pair would be, and
 * the labels change per `friendsMomentCopy`. Which face is "you": the viewer
 * on the left, the other person on the right, the way the file reads.
 *
 * ─── ON ENTERING, AND THE MOMENT IT HAPPENS ──────────────────────────────────
 * It reads the person's unread social notifications when the shell first has
 * them, and keeps reading them as they poll — so what arrived while they were
 * away shows on entering, and a wink or a follow-back that lands while they
 * are here shows then ("if they enter and that thing happens it will show").
 * On close it marks the rows it showed as read, which is what keeps any one
 * moment to once.
 *
 * Composed here because it acts across slices: the wink and follow are the
 * profile's, "Start gisting" is the messages slice's, the rows are the
 * notifications slice's.
 */
export function FriendsPopup() {
  const me = useMe();
  const notifications = useNotifications("social");
  const markRead = useMarkNotificationsRead();
  const [moment, setMoment] = useState<FriendsMoment | null>(null);
  // Rows this session has already put in front of the reader, so a poll
  // that returns them again (before the read lands) cannot re-open them.
  const shown = useRef(new Set<string>());

  /*
    ON ENTERING, AND WHILE THEY ARE HERE. The first answer from the social
    list shows whatever arrived since they were last in; every later answer
    (the list polls every 30s) is checked again for rows this session has not
    shown, so a wink or a follow-back that lands while they are reading
    appears then, not on their next sign-in. One popup at a time: a second
    moment waits until the first is closed, and is picked up on the next
    answer. Realtime delivery through the ws-gateway would cut the 30s; the
    rule here does not change when it does.
  */
  useEffect(() => {
    if (moment || !notifications.data) return;
    const rows = notifications.data.pages
      .flatMap((page) => page.items)
      .filter((row) => !shown.current.has(row.id));
    const next = pickFriendsMoment(
      rows.map((row) => ({ id: row.id, kind: row.kind, readAt: row.readAt, actor: row.actor }))
    );
    if (!next) return;
    for (const id of next.notificationIds) shown.current.add(id);
    setMoment(next);
  }, [notifications.data, moment]);

  if (!moment || !me.data) return null;
  return (
    <FriendsDialog
      moment={moment}
      viewer={me.data}
      onClose={() => {
        setMoment(null);
        markRead.mutate(moment.notificationIds);
      }}
    />
  );
}

function FriendsDialog({
  moment,
  viewer,
  onClose,
}: {
  moment: FriendsMoment;
  viewer: Profile;
  onClose: () => void;
}) {
  const router = useRouter();
  const other = moment.actor as unknown as Profile;
  const name = other.displayName || other.username;
  const copy = friendsMomentCopy(moment, name);
  const wink = useWink(other);
  const follow = useFollow(other);
  const chat = useOpenConversation();
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  const startGisting = () => {
    onClose();
    chat.mutate(other.id, { onSuccess: () => router.push("/messages") });
  };
  const winkBack = () => {
    wink.send();
    onClose();
  };
  const followBack = () => {
    follow.mutate(true);
    onClose();
  };

  const primaryLabel =
    copy.primary === "start-gisting" ? "Start gisting" : copy.primary === "wink-back" ? "Wink back" : "Follow back";
  const primaryAct =
    copy.primary === "start-gisting" ? startGisting : copy.primary === "wink-back" ? winkBack : followBack;
  const primaryOff = copy.primary === "wink-back" && (wink.unavailable || wink.refusal !== null);

  const secondaryLabel = copy.secondary === "wink" ? `Wink at ${name}` : "Start gisting";
  const secondaryAct = copy.secondary === "wink" ? winkBack : startGisting;
  const secondaryOff = copy.secondary === "wink" && (wink.unavailable || wink.refusal !== null);

  const card =
    "absolute overflow-hidden rounded-[37.16px] border-[4.645px] border-white bg-[#EDEDED] shadow-[0_6.6px_6.5px_rgba(0,0,0,0.25)]";
  const face = (profile: Profile, size: number) => (
    <Avatar
      name={profile.displayName || profile.username}
      seed={profile.id}
      src={profile.avatarUrl}
      size={size}
      sizeClassName="h-full w-full"
      className="rounded-none border-0"
    />
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={copy.headline.map((run) => run.text).join("")}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
        className="relative h-[472px] w-[441px] max-w-full overflow-hidden rounded-[25px] border-[0.735px] border-[#6155F5] bg-[#1A1A1A] outline-none"
      >
        {/* 647:16629 — the rays, at the file's own placement and its own 6%. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- the file's own artwork, served locally */}
        <img src="/friends/rays.svg" alt="" aria-hidden className="absolute" style={{ left: -72, top: -121, width: 601, height: 602 }} />
        {/* 647:16661 / 647:16662 — the two glows. */}
        <span aria-hidden className="absolute rounded-full bg-spotlight" style={{ left: -119, top: 438, width: 178, height: 176, filter: "blur(99px)" }} />
        <span aria-hidden className="absolute rounded-full bg-spotlight" style={{ left: 390, top: -85, width: 178, height: 176, filter: "blur(99px)" }} />

        {/* 647:16663 then 647:16630 — the stars behind the hugging heart. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friends/stars.svg" alt="" aria-hidden className="absolute" style={{ left: 127, top: 37, width: 181, height: 110 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friends/hug.svg" alt="" aria-hidden className="absolute" style={{ left: 159, top: 43, width: 124, height: 107 }} />

        {/* 647:16667 — the close disc. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ws-glass-clear ws-press absolute flex items-center justify-center rounded-full text-white"
          style={{ left: 375, top: 23.5, width: 45, height: 45 }}
        >
          <IconFriendsClose className="h-[15.4px] w-[15.4px]" />
        </button>

        {/* The portraits — 647:16646 (you, left, -7.35°) and 647:16642 (them,
            right, +9.02°). A first wink shows theirs alone, centred. */}
        {copy.faces === "both" ? (
          <>
            <div className={card} style={{ left: 93.8, top: 155.2, width: 136.6, height: 145.6, transform: "rotate(-7.35deg)" }}>
              {face(viewer, 146)}
            </div>
            <div className={card} style={{ left: 207.6, top: 155.2, width: 139.9, height: 148.5, transform: "rotate(9.02deg)" }}>
              {face(other, 149)}
            </div>
          </>
        ) : (
          <div className={card} style={{ left: 150.6, top: 155.2, width: 139.9, height: 148.5, transform: "rotate(9.02deg)" }}>
            {face(other, 149)}
          </div>
        )}

        {/* 647:16649 — the two lines, run for run. */}
        <p
          className="absolute text-center text-[14.71px] font-bold leading-[17.65px] text-white"
          style={{ left: 104.4, top: 311.8, width: 238 }}
        >
          {copy.headline.map((run, i) => (
            <span key={`h${i}`} className={cn(run.dim && "text-white/[0.38]")}>{run.text}</span>
          ))}
          <br />
          {copy.subline.map((run, i) => (
            <span key={`s${i}`} className={cn(run.dim && "text-white/[0.38]")}>{run.text}</span>
          ))}
        </p>

        {/* 647:16651 — the buttons. The file stacks them 5.88 apart, which on
            screen read as two pills touching ("there is no space in that
            button"); 12 here, and the column keeps the file's top. */}
        <div className="absolute flex flex-col items-center gap-3" style={{ left: 111.4, top: 364, width: 219 }}>
          <button
            type="button"
            onClick={primaryAct}
            disabled={primaryOff}
            title={copy.primary === "wink-back" ? (wink.refusal ?? undefined) : undefined}
            className="ws-btn-welcome ws-press flex h-9 w-[214px] items-center justify-center rounded-full text-[11.77px] font-medium leading-[20.45px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {primaryLabel}
          </button>
          {copy.secondary && (
            <button
              type="button"
              onClick={secondaryAct}
              disabled={secondaryOff}
              title={copy.secondary === "wink" ? (wink.refusal ?? undefined) : undefined}
              className="ws-press flex h-9 w-[219px] items-center justify-center gap-[9.4px] rounded-full bg-[#323232] text-[11.77px] font-medium leading-[20.45px] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copy.secondary === "wink" && <IconProfileWink className="h-[16.3px] w-[16.3px]" />}
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
