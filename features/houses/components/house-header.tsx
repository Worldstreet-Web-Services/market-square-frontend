"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft } from "@/components/ui/icons";
// The file's own glyphs, exported from it. See components/ui/room-icons.tsx.
import { IconHouseGroup, IconRoomLeave, IconRoomShare } from "@/components/ui/room-icons";
import { canGoBack } from "@/lib/nav-history";

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
  /** The header's red logout circle — leaving the room. */
  onLeave?: () => void;
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
}) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);

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
    <header
      ref={ref}
      className="sticky top-[var(--ws-topbar-h)] z-30 bg-chrome px-4 pb-6 pt-4 xl:px-8 xl:pt-6"
    >
      <div className="flex flex-col gap-6">
        {/*
          ── row 0: BACK, LABELLED, ON ITS OWN LINE ──

          369:9158 draws a 20px arrow, 8, then the word "Back" at 16/24 in
          white, above the house row rather than beside it. It was a bare
          icon-only disc sharing row 1 — which is the same control saying less,
          and it left the house's name starting 40px in from the column while
          everything under it started at 0.
        */}
        <button
          onClick={() => (canGoBack() ? router.back() : router.push("/gist-rooms"))}
          className="ws-press flex w-fit items-center gap-2 text-[16px] leading-6 text-white transition-opacity hover:opacity-80"
        >
          <IconArrowLeft className="h-5 w-5 shrink-0" />
          Back
        </button>

        {/* ── row 1 ── */}
        <div className="flex items-center gap-4">
          {house && (
            <p className="flex min-w-0 items-center gap-2 text-[16px] leading-6 text-white/50">
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
              className="ws-press ws-btn-welcome shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold leading-4 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {join.state === "pending" ? "Asked to join" : "Join House"}
            </button>
          )}
        </div>

        {/* ── row 2 ── */}
        <div className="flex items-center gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="ws-display text-[24px] leading-8">{topic}</h1>
            {/* 129:11900 — 16/24 at `white/50`. */}
            <p className="text-[16px] leading-6 text-white/50">{meta}</p>
          </div>

          {/* 38px circles, gap 16. `ws-glass-pill` is the file's own material —
              see globals.css for why it is a recessed lens and not a ring. */}
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
                A LABELLED PILL, NOT A GLYPH — node 369:9177, 129x38.

                It was a 38px disc carrying only the logout mark. Leaving a room
                you are audible in is the one irreversible thing in this header,
                and an unlabelled glyph is the wrong amount of warning for it.

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
              <button
                type="button"
                onClick={onLeave}
                className="ws-press flex h-[38px] shrink-0 items-center gap-2 rounded-full bg-danger/[0.13] px-4 text-[15px] leading-6 text-danger transition-colors hover:bg-danger/20"
              >
                <IconRoomLeave className="h-4 w-4 shrink-0" />
                Leave Room
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
