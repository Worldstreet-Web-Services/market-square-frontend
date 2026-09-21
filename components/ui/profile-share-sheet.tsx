"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/sheet";
import { ShareSheet } from "@/components/ui/share-sheet";
import { IconCardClose, IconCardDownload, IconCardShare } from "@/components/ui/profile-card-icons";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { api, asset, sq } from "@/lib/square-path";
import {
  PROFILE_CARD_VARIANTS,
  profileCardFileName,
  profileCardQuery,
} from "@/lib/profile-card";
import type { Profile } from "@/lib/api/schemas";

/**
 * "SHARE PROFILE" — node 1624:21811, at the file's own measurements.
 *
 * A 686-wide modal: the heading spans 645 with the 43px glass close disc at its
 * right; the card (`/api/profile-card`, 529 wide) sits centred with its variant
 * dots under it; then two 256.5-wide buttons, Download and Share, 16 apart.
 *
 * The card is server-rendered so the PREVIEW is the saved picture — the same
 * pattern the wink card uses. Download saves that exact image; Share hands the
 * profile link to the device's share sheet (or the clipboard). The dots switch
 * the card's background variant, re-requesting the image with a new `v`.
 */
export function ProfileShareSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
}) {
  const [variant, setVariant] = useState(0);
  // Share opens the app's own target list (WhatsApp/X/Telegram/Copy), which
  // works on desktop too — the bare `navigator.share` exists only on phones.
  const [sharing, setSharing] = useState(false);

  // The carousel SWIPES (a horizontal drag), not just the dots — that is the
  // gesture the design's dots imply and the one a phone reaches for. Left goes
  // to the next background, right to the previous, wrapping round.
  const swipeStart = useRef<number | null>(null);
  const step = (delta: number) =>
    setVariant((v) => (v + delta + PROFILE_CARD_VARIANTS) % PROFILE_CARD_VARIANTS);
  const onCardPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = e.clientX;
  };
  const onCardPointerUp = (e: React.PointerEvent) => {
    const from = swipeStart.current;
    swipeStart.current = null;
    if (from === null) return;
    const dx = e.clientX - from;
    if (Math.abs(dx) < 40) return;
    step(dx < 0 ? 1 : -1);
  };

  // A TWO-FINGER (trackpad) horizontal swipe fires `wheel` with deltaX. It has
  // to be a NATIVE, non-passive listener: React's onWheel is passive, so it
  // cannot preventDefault, and the browser would spend the gesture on its own
  // back/forward navigation before we ever saw it. One gesture streams many
  // events, so a short lock keeps it to a single step.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let locked = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < 18 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (locked) return;
      locked = true;
      const dir = e.deltaX > 0 ? 1 : -1;
      setVariant((v) => (v + dir + PROFILE_CARD_VARIANTS) % PROFILE_CARD_VARIANTS);
      window.setTimeout(() => {
        locked = false;
      }, 450);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const name = profile.displayName || profile.username;
  // A SHARE link keeps the short username on purpose (the documented exception
  // to the by-id rule); this modal is client-only, so `window` is defined.
  const profileUrl = `${window.location.origin}${sq(`/u/${profile.username}`)}`;

  const cardUrl = api(
    `/api/profile-card?${profileCardQuery({
      username: profile.username,
      displayName: name,
      avatarUrl: profile.avatarUrl,
      seed: profile.id,
      verified: profile.verification === "verified",
      url: profileUrl,
      variant,
    })}`
  );
  const fileName = profileCardFileName(profile.username);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      bare
      // The file's surface: #1A1A1A behind an indigo hairline at radius 25, 686
      // wide, with a soft purple wash from the top.
      panelClassName="border-[0.735px] border-[#6155F5] bg-[#1a1a1a] bg-[radial-gradient(120%_70%_at_50%_-6%,rgba(97,85,245,0.38),transparent_55%)] sm:max-w-[686px] sm:rounded-[25px]"
    >
      <div className="relative">
        {/* 1624:21812–21814 / 21820 — the file's decoration, ON THE MODAL (not
            inside the card): the purple rays bursting from the top, two glow
            ellipses at the corners, and the coloured sparkles around the card.
            Behind the content, inert. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- decoration served locally */}
          <img src={asset("/profile-card/rays.png")} alt="" className="absolute left-1/2 top-[-60px] w-[720px] max-w-none -translate-x-1/2 opacity-[0.5]" />
          {/* eslint-disable-next-line @next/next/no-img-element -- decoration served locally */}
          <img src={asset("/profile-card/glow-modal.svg")} alt="" className="absolute -bottom-20 -left-28 w-64 opacity-90" />
          {/* eslint-disable-next-line @next/next/no-img-element -- decoration served locally */}
          <img src={asset("/profile-card/glow-modal.svg")} alt="" className="absolute -right-20 top-[30%] w-56 opacity-80" />
          {/* The three sparkles, around the card. */}
          <SparkleStar className="absolute right-[7%] top-[14%] h-8 w-8 text-[#9F65FD]" />
          <SparkleStar className="absolute left-[7%] top-[43%] h-9 w-9 text-[#3B82F6]" />
          <SparkleStar className="absolute right-[9%] top-[52%] h-6 w-6 text-[#E8B74A]" />
        </div>

        <div className="relative z-10 flex flex-col">
          {/* 1624:21815 — the heading, 645 wide, and the 43px glass close disc. */}
          <div className="flex items-center justify-between px-5 pb-4 pt-6">
            <h2 className="text-[24px] font-bold leading-none text-white">Share Profile</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ws-press flex size-[43px] shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-white backdrop-blur-[4.8px] transition-colors hover:bg-white/10"
            >
              <IconCardClose className="h-[21px] w-[21px]" />
            </button>
          </div>

          {/* 1624:21819 — the card (529 wide) and its dots, centred. */}
          <div className="mx-auto flex w-[529px] max-w-[calc(100%-40px)] flex-col items-center gap-6 pb-6">
            <div className="relative w-full">
              <div
                ref={cardRef}
                onPointerDown={onCardPointerDown}
                onPointerUp={onCardPointerUp}
                className="w-full touch-pan-y select-none overflow-hidden rounded-[40px] shadow-[0_10px_25px_rgba(78,78,78,0.1)]"
                style={{ aspectRatio: "529 / 610" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered PNG, keyed on variant */}
                <img
                  key={variant}
                  src={cardUrl}
                  alt={`${name}'s Square profile card`}
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                />
              </div>

              {/* Left / right steppers — the other way through the carousel. */}
              {PROFILE_CARD_VARIANTS > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous design"
                    className="ws-press absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                  >
                    <IconChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next design"
                    className="ws-press absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                  >
                    <IconChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* 1624:18036 — the variant dots, first one wide. */}
            {PROFILE_CARD_VARIANTS > 1 && (
              <div className="flex items-center gap-2" role="tablist" aria-label="Card background">
                {Array.from({ length: PROFILE_CARD_VARIANTS }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={index === variant}
                    aria-label={`Background ${index + 1}`}
                    onClick={() => setVariant(index)}
                    className={cn(
                      "ws-press h-2 rounded-full transition-all",
                      index === variant ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 1624:21824 — Download (#323232) and Share (create ramp), 256.5 each. */}
          <div className="mx-auto flex w-[529px] max-w-[calc(100%-40px)] items-center gap-4 pb-6">
            <a
              href={cardUrl}
              download={fileName}
              className="ws-press flex flex-1 items-center justify-center gap-2 rounded-[30px] bg-[#323232] py-3 text-[14px] font-medium leading-6 text-white transition-opacity hover:opacity-90"
            >
              <IconCardDownload className="h-6 w-6" />
              Download
            </a>
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="ws-press flex flex-1 items-center justify-center gap-2 rounded-[30px] bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] py-3 text-[14px] font-medium leading-6 text-white transition-opacity hover:opacity-90"
            >
              <IconCardShare className="h-6 w-6" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* The actual share targets — offered over the card. Works on desktop
          (target buttons + copy) and on a phone (the native sheet first). */}
      {sharing && (
        <ShareSheet
          open
          onClose={() => setSharing(false)}
          title="Share profile"
          payload={{ text: `${name} on Square`, url: profileUrl }}
        />
      )}
    </Sheet>
  );
}

/** A four-point sparkle — the little stars the modal floats around the card. */
function SparkleStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 0c.6 6.3 5.7 11.4 12 12-6.3.6-11.4 5.7-12 12-.6-6.3-5.7-11.4-12-12C6.3 11.4 11.4 6.3 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
