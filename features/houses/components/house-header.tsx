"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { IconArrowLeft } from "@/components/ui/icons";
// The file's own glyphs, exported from it. See components/ui/room-icons.tsx.
import { IconHouseGroup, IconRoomBack, IconRoomLeave, IconRoomShare } from "@/components/ui/room-icons";
import { canGoBack } from "@/lib/nav-history";
import { sq } from "@/lib/square-path";

/**
 * The room's header. The topic is the room, so the topic is the header.
 *
 * It MEASURES itself and republishes `--ws-house-head-h`, exactly as
 * ColumnHeader does with `--ws-colhead-h` and for the same reason: the talking
 * line sticks directly underneath it, and this row is taller with a two-line
 * topic than with a one-line one. A magic number here is a talking line that
 * overlaps the topic on some phones and floats below it on others.
 *
 * `top-[var(--ws-topbar-h)]` rather than `top-0`: the shell's mobile top strip
 * is FIXED, so a sticky header parked at zero slides under the wordmark the
 * moment the page scrolls. The variable is 48px on a phone and 0 from md up,
 * where that strip does not exist, so one offset is correct at both ends.
 */
export function HouseHeader({
  topic,
  meta,
  onShare,
  onLeave,
  house,
  join,
  confirmBeforeLeave = true,
  leaveLabel = "Leave Room",
}: {
  topic: string;
  meta: React.ReactNode;
  /**
   * The share circle — node 129:11902.
   *
   * The file gives row 2 exactly TWO controls, share and leave, so the
   * three-dot overflow that used to sit beside them is gone and this opens the
   * sheet that held its contents: both room links and the keyboard shortcuts.
   * Nothing was dropped, and the row is the file's.
   */
  onShare?: () => void;
  /**
   * Leaving the room.
   *
   * NOT called on the tap. The tap opens an "are you sure" dialog, and this
   * runs only when the person says yes — see `confirmBeforeLeave`.
   */
  onLeave?: () => void;
  /**
   * Whether the tap asks first. TRUE by default, because the alternative is a
   * room you fall out of by brushing the top-right corner of a phone, and
   * there is no undo: rejoining is a fresh connection into a conversation that
   * did not pause for you.
   *
   * The seam exists for a caller that already asks its own question and would
   * otherwise stack two dialogs. Pass `false` there and keep the caller's
   * dialog, which knows things this header cannot — whether you are the host,
   * and so whether "leave" means "close the room for everybody".
   */
  confirmBeforeLeave?: boolean;
  /**
   * The HOUSE GROUP this room belongs to — the file's "Hacker House Maestros
   * '26" line. Absent for a room opened from the street, which belongs to no
   * house; the row then simply does not appear rather than naming nothing.
   */
  house?: React.ReactNode;
  /**
   * "Join House" — node 129:11893, beside the room's name.
   *
   * WHAT IT ACTUALLY DOES, because the file cannot say: there is no join
   * endpoint and no membership on a gist room. A house is a room you can walk
   * into, so anybody reading this page has already "joined" in the only sense
   * the service knows. The one real thing an audience member can ask for is a
   * SEAT, which `POST /streams/:id/speaker-requests` backs and which the free
   * chair in the ring already triggers.
   *
   * So this is that same action, given the label and the position the file
   * puts it in — a discoverable button instead of "tap the empty chair". It is
   * deliberately NOT wired to anything about membership, and its label follows
   * the request's real state so it can never claim you joined something you
   * did not.
   *
   * Omitted entirely when there is nothing to ask for (the host, a room that
   * is not live, or a seat already taken), rather than rendered dead.
   */
  join?: { onJoin: () => void; state: "idle" | "pending" | "seated"; reason: string | null };
  /**
   * What the red pill says ON A PHONE — node 1285:92938 draws the host's as
   * "Close Room", which is the truth for the one person whose leaving ends
   * the room. From `md` the pill keeps the desktop file's "Leave Room" as it
   * always has; only the phone frame names the host's act.
   */
  leaveLabel?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  // The trigger itself, so dismissing the dialog puts focus back on it instead
  // of dropping it at the top of the document — this header is sticky and a
  // keyboard user would otherwise have to tab the whole room to reach it again.
  const leaveRef = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const closeConfirm = useCallback(() => {
    setConfirming(false);
    leaveRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const publish = () =>
      document.documentElement.style.setProperty("--ws-house-head-h", `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      // Reset, so the next surface's sticky offsets do not inherit this one's
      // measurement after the room unmounts.
      document.documentElement.style.removeProperty("--ws-house-head-h");
    };
  }, []);

  return (
    /*
      NODE 129:11888 — two rows, 24 apart, in a 32px gutter.

      Row 1: the HOUSE this room belongs to, beside the Join House pill.
      Row 2: the room's own title at 24/32 over its partner count, with the
      share and leave circles — the file's two, no more — pushed to the right
      edge.

      What the file does not draw, and why it is here anyway: a BACK control.
      The file assumes the rail is always present, but this is a route — on a
      phone the rail is a drawer and there is no other way out of a room.
      It sits at the head of row 1 rather than in a strip of its own, so it
      costs no extra height.
    */
    /*
      NOT `ws-head`. That utility paints `var(--color-ground)` — pure #000 —
      and a `white/8` hairline underneath, which drew the header as a BLACK
      SLAB with a line under it, sitting on a #0f0f0f column. Node 112:10421 is
      a plain column frame: no fill, no stroke, part of the same surface as
      everything below it.

      It stays STICKY (the column scrolls and the room's title is what the page
      is about), so it needs an opaque background — the column's own
      `--color-chrome` (#121214 at full opacity), so the header is invisible as
      a band and only the content moves under it.
    */
    <>
    <header
      ref={ref}
      /*
        THE PHONE IS ITS OWN FRAME — 1285:92919 in 1285:92794, a 342 column at
        x=24 (px-6), 24 under the top bar and 24 above Speakers, its rows 16
        apart. Every phone value below is that node's; every `md:` value is the
        desktop file's, unchanged.
      */
      className="sticky top-[var(--ws-topbar-h)] z-30 bg-chrome px-6 pb-6 pt-6 md:px-4 md:pb-6 md:pt-4 xl:px-8 xl:pt-6"
    >
      {/* The file's 24px rhythm is a DESKTOP rhythm. Three rows 24 apart, on
          top of a 24px title that wrapped to three lines, was a phone whose
          first screenful was entirely header — the room it is a header for
          started below the fold. The phone frame spaces its rows 16 apart
          (1285:92919 `itemSpacing`); every value from `md` up is the file's. */}
      <div className="flex flex-col gap-4 md:gap-6">
        {/*
          ── row 0: BACK, LABELLED, ON ITS OWN LINE ──

          369:9158 draws a 20px arrow, 8, then the word "Back" at 16/24 in
          white, above the house row rather than beside it. It was a bare
          icon-only disc sharing row 1 — which is the same control saying less,
          and it left the house's name starting 40px in from the column while
          everything under it started at 0.
        */}
        <button
          onClick={() => (canGoBack() ? router.back() : router.push(sq("/gist-rooms")))}
          /* 1285:92920 on a phone: the 16px `arrow-left` chevron, 8, then
             "Back" at 14/24. The desktop's 20px arrow and 16/24 from `md`. */
          className="ws-press flex w-fit items-center gap-2 text-[14px] leading-6 text-white transition-opacity hover:opacity-80 md:text-[16px]"
        >
          <IconRoomBack className="h-4 w-4 shrink-0 md:hidden" />
          <IconArrowLeft className="hidden h-5 w-5 shrink-0 md:block" />
          Back
        </button>

        {/* ── row 1 ── */}
        <div className="flex items-center gap-4">
          {house && (
            <p className="flex min-w-0 items-center gap-2 text-[14px] leading-6 text-white/50 md:text-[16px]">
              {/* Node 129:11891, the file's own 16px `profile-2user`, in `--color-spotlight` — which is the `#7E3BEB` it is painted with. */}
              <IconHouseGroup className="h-4 w-4 shrink-0 text-spotlight" />
              <span className="truncate">{house}</span>
            </p>
          )}

          {/* NO SPACER. Node 129:11889 is a HUG-width row at gap 16: the pill
              sits immediately beside the house's name, not pushed to the far
              edge of the column. Pushed right it read as page chrome rather
              than as part of the sentence "you are in this house — join it". */}
          {join && join.state !== "seated" && (
            /*
              PURPLE, not white — and this is why the render matters.

              The node's properties report a WHITE fill and a WHITE label,
              which is impossible as drawn, and both are bound to Figma
              variables the API will not resolve for this token. Reading the
              properties alone, two passes shipped a white pill with black ink.
              Exporting the frame and looking at it settles it in one glance:
              it is the spotlight purple with a white label.
            */
            <button
              type="button"
              onClick={join.onJoin}
              disabled={join.state === "pending" || join.reason !== null}
              title={join.reason ?? undefined}
              /* 369:9165 — the create RAMP, not the flat spotlight fill: the
                 pill's own rectangle carries #9F65FD into #5B05E6, which is
                 `ws-btn-welcome`'s 90deg ramp and needs no new colour. 85x24 on
                 4/12 of padding, the label at 600 12/16. The older node painted
                 it flat, which is what shipped. */
              /* 1285:92927 on a phone is 77x24 on 4/8 — the same label on
                 8 of side padding rather than the desktop's 12. */
              className="ws-press ws-btn-welcome shrink-0 rounded-full px-2 py-1 text-[12px] font-semibold leading-4 text-white transition-opacity hover:opacity-90 disabled:opacity-40 md:px-3"
            >
              {join.state === "pending" ? "Asked to join" : "Join House"}
            </button>
          )}
        </div>

        {/* ── row 2 ──
            On a phone it is TWO rows (1285:92930): the title over its count,
            then the share disc and the red pill on a row of their own, 16
            below — the file gives the title the whole 342 rather than
            squeezing it beside two controls. From `md` the desktop's one
            row: title and count on the left, the discs at the right edge. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/*
              20/28 on a phone, the file's 24/32 from `md` up.

              A real room title — "ARKGIST with ARKSTRA" — took THREE lines at
              24px on a 390px screen and read as the page rather than as its
              label. Two things caused that and both are fixed here: the size,
              and the 129px labelled pill on the right that left the title
              roughly 150px of column to wrap inside. Nothing above `md`
              changes; the desktop header is still the file's.
            */}
            {/* 1285:92932 — Bold 16/24 on a phone; the desktop's 24/32 from `md`. */}
            <h1 className="ws-display text-[16px] leading-6 md:text-[24px] md:leading-8">{topic}</h1>
            {/* 129:11900 — 16/24 at `white/50`, stepped down with the title so
                the pair keeps its proportion instead of the subtitle crowding
                a smaller heading. */}
            <p className="text-[14px] leading-5 text-white/50 md:text-[16px] md:leading-6">{meta}</p>
          </div>

          {/* 38px circles, gap 16. `ws-glass-pill` is the file's own material —
              see globals.css for why it is a recessed lens and not a ring. */}
          {/* 1285:92934 — a HUG row on a 16 gap at both widths. */}
          <div className="flex shrink-0 items-center gap-4">
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="Share this gist room"
                className="ws-glass-pill ws-press flex h-[38px] w-[38px] items-center justify-center rounded-full text-body"
              >
                <IconRoomShare className="h-4 w-4" />
              </button>
            )}
            {onLeave && (
              /*
                A LABELLED PILL FROM `md` UP — node 369:9177, 129x38 — AND A
                FILLED RED DISC BELOW IT.

                The label is the right amount of warning for the one
                irreversible control in this header, and on a desktop it costs
                nothing. On a 390px phone it costs 129px of the row, which came
                straight out of the title beside it and wrapped a short room
                name onto three lines. So under `md` the same control collapses
                to the 38px disc the share circle already is.

                A disc that says nothing needs to say it LOUDLY: the mobile one
                is the solid `--color-danger` with a white glyph, not the
                desktop wash, because a 13% tint reads as one more grey circle
                at that size. White on #FF383C is 3.6:1 — over the 3:1 the
                glyph needs, under the 4.5:1 the vanished label would have
                needed, which is the other half of why the label stays wherever
                there is room for it.

                An icon alone is also easier to hit by accident, which is what
                the confirmation below is for.

                NO BORDER: the node reports a #FF0B0B stroke at weight ZERO,
                which renders nothing — the same trap as the share disc beside
                it. What is real is the 13% red wash.

                ONE RED, NOT THREE. The file paints the wash #FF0B0B, the glyph
                #FF383C and the label #FF5454. #FF383C is `--color-danger`
                exactly; the other two have no token, and this slice is asserted
                to hold no hex literal and never to borrow `--color-live`. So
                all three roles render from the one token that already means
                "this destroys something" — a wash, a glyph and a label at the
                same hue rather than three reds a pixel apart.
              */
              /*
                NOW LABELLED AT BOTH WIDTHS. The phone frame (1285:92938) draws
                the pill at 115x38 with its glyph and label — "Close Room" for
                the host — on 8 of padding, the label at 12/20; the title moved
                onto its own row, so the pill no longer costs it anything. The
                solid red disc that stood in for it below `md` is gone with the
                reason for it. The wash, glyph and label all render from the
                one `--color-danger` token (see above), so the phone's `#FF0B0B`
                wash, `#FF383C` glyph and `#FF5454` label are one red here too.

                The visible label IS the accessible name now — the hidden span
                is `display: none`, so only the width's own label is read.
              */
              <button
                ref={leaveRef}
                type="button"
                onClick={() => (confirmBeforeLeave ? setConfirming(true) : onLeave())}
                aria-haspopup={confirmBeforeLeave ? "dialog" : undefined}
                className="ws-press flex h-[38px] w-[115px] shrink-0 items-center justify-center gap-2 rounded-full bg-danger/[0.13] px-2 text-[12px] leading-5 text-danger transition-colors hover:bg-danger/20 md:w-auto md:px-4 md:text-[15px] md:leading-6"
              >
                <IconRoomLeave className="h-4 w-4 shrink-0" />
                <span className="md:hidden">{leaveLabel}</span>
                <span className="hidden md:inline">Leave Room</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>

    {/*
      "ARE YOU SURE" — the other half of the icon-only button.

      Leaving is not undoable: the room does not pause, the seat is handed back,
      and returning is a fresh connection. That was previously one tap away from
      a 38px target in the corner a thumb rests on, which is the mis-tap this
      dialog exists to catch.

      REUSED, NOT REBUILT: `components/ui/sheet` is the app's one modal — bottom
      sheet on a phone, centred dialog on a desktop — and it already carries the
      portal, the backdrop, the scroll lock, `role="dialog" aria-modal`, the
      reduced-motion entrance and Escape-to-close. Every other confirmation in
      the room is that component, so this one is too rather than a second dialog
      with its own half of those behaviours.

      Focus: the safe answer takes it on open and the trigger takes it back on
      close. `Stay` is autofocused deliberately — landing a keyboard or screen
      reader user on the destructive button is the same mis-tap with a keyboard.
    */}
    {onLeave && (
      <Sheet open={confirming} onClose={closeConfirm} title="Leave this gist room?">
        <p className="text-[13px] leading-5 text-body">
          You will drop out of the conversation straight away.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" autoFocus onClick={closeConfirm}>
            Stay
          </Button>
          {/*
            `--color-danger`, the slice's one destructive red, filled rather
            than washed so the committing button is the loudest thing in the
            dialog. Not `Button`'s own `danger` variant: that paints
            `--color-down`, which means a value going down on a price, and
            `features/houses` is asserted never to borrow it.
          */}
          <Button
            className="flex-1 bg-danger text-white hover:bg-danger/90 active:bg-danger/80"
            onClick={() => {
              setConfirming(false);
              onLeave();
            }}
          >
            Leave Room
          </Button>
        </div>
      </Sheet>
    )}
    </>
  );
}
