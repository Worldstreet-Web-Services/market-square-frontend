"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SquareLockup, SquareMark } from "@/components/ui/square-mark";
import { cn } from "@/lib/cn";
import { GistCard, LiveOnPill } from "@/components/layout/welcome/gist-card";
import { PalsArc } from "@/components/layout/welcome/pals-arc";
import { Communities } from "@/components/layout/welcome/communities";
import { isWelcomeSurface } from "@/lib/welcome-surface";
import {
  ART_COMMUNITIES,
  ART_GIST_ROOMS,
  ART_REAL_PALS,
  ART_WELCOME,
  SPARKLES_COMMUNITIES,
  SPARKLES_GIST_ROOMS,
  SPARKLES_REAL_PALS,
  WelcomeFrame,
  WelcomeStage,
  WelcomeWash,
  prefetchArt,
  type ArtPiece,
  type Sparkle,
} from "@/components/layout/welcome/welcome-art";

/**
 * THE WELCOME SEQUENCE — Desktop 35 -> 33 -> 36 -> 34, then the sign-in card.
 *
 * The file lays these four out left to right at y=24327 in exactly this order,
 * which is what settles it: none of the four carries a prototype interaction,
 * so the layout IS the sequence.
 *
 * ─── THREE CAROUSEL SCREENS AND A FINALE ────────────────────────────────────
 * 35, 33 and 36 share one chassis — lockup at the top, artwork, a three-dot
 * stepper, a two-tone headline, a line of copy, Continue and Skip. 34 is
 * deliberately NOT that: no stepper, no Skip, no header lockup, and the mark
 * moves into the middle at twice the size. It is the hand-off, not a fourth
 * page of pitch, so it gets one way forward.
 *
 * ─── FOUR THINGS THE FILE GETS WRONG, AND WHAT I DID ────────────────────────
 * 1. THE STEPPER ON SCREEN 3 IS STILL ON DOT 2. Screens 1, 2 and 3 read 1, 2, 2
 *    — the third was never updated. Three dots with steps 1, 2, 2 is not a
 *    reading of anything, so the stepper is driven by the index here.
 * 2. THE INACTIVE DOTS ARE 19 AND 17 WIDE. Two pixels apart, in a row where
 *    they are meant to be identical. Both kept, by SLOT, because that is what
 *    holds the row at the file's exact 96 — see `Stepper`.
 * 3. `Continue with Google` SITS 14px LEFT OF THE CARD'S CENTRE on Desktop 40,
 *    with 113px to its left and 141px to its right. Centred here.
 * 4. (Not a defect — a call I got wrong first time.) THE SUB-COPY IS ROBOTO,
 *    where every other string in all five frames is Geist. I read that as a
 *    leftover Figma default and set it in Geist. Measuring the two renders
 *    against each other proved otherwise: screen 1's copy came out 389px wide
 *    against the file's 372, enough to move where it wraps. It is Roboto now,
 *    loaded for these four lines only.
 *
 * ─── WHO SEES IT ────────────────────────────────────────────────────────────
 * See `useShowWelcome` at the bottom. Short version: signed-out, first visit,
 * and only when the reader arrived at the app's front door. A shared link to a
 * post or a profile opens that post or profile.
 */

/* The design's own numbers, at the design's own size. Every one of these is
   scaled down at the two breakpoints below it — the file has no mobile frame
   for any of these five screens, so the phone layout is mine. */
const HEADLINE = "text-[32px] leading-[0.78] @sm:text-[40px] @lg:text-[49.11px]";
/**
 * The sub-copy. Roboto 400 at 14.644067764282227/21.966102600097656, which is
 * the file's, loaded in `app/layout.tsx` for these four lines and nothing else.
 *
 * It was Geist first, on the reasoning that Roboto is Figma's substitution font
 * and a fractional size like that comes from a scaled frame. Measuring settled
 * it: the two lines came out 389px wide against the file's 372, which is enough
 * to move the wrap. The design says Roboto, and it is 4.5% narrower.
 */
const SUB =
  "font-[family-name:var(--font-roboto)] text-center text-[14px] leading-[1.5] text-white/50 @sm:text-[14.644px] @sm:leading-[21.966px]";

/**
 * A two-tone headline.
 *
 * THE GRADIENT BELONGS TO THE WHOLE HEADING, NOT TO THE COLOURED WORDS. The
 * file paints it across the entire text box — flat `--color-create` for the
 * first 84.6%, darkening to #5F3C97 over the last sixth — and the accent run
 * simply shows whatever part of it falls under those characters.
 *
 * That distinction is the entire behaviour. Screen 1 breaks as
 * "Join live Gist Rooms" / "Conversations", so it is ROOMS that ends near the
 * box's right edge and darkens, while Conversations — centred and shorter —
 * sits inside the flat region and stays uniform. Putting the gradient on the
 * accent SPAN instead inverts it exactly: an inline span's background is laid
 * across its fragments end to end, so "Rooms" became the start of the ramp and
 * "Conversations" the end. Checked against the render, both ways round.
 *
 * So: the gradient goes on the block, `background-clip: text` lets it through,
 * and the leading run opts out with `-webkit-text-fill-color`, which paints
 * over the ancestor's clipped background. `w-fit` is load-bearing too — the
 * file's text box is shrink-to-fit around the longest line, and a full-width
 * heading would move 84.6% somewhere else entirely.
 */
function Headline({
  white,
  accent,
  boxWidth,
  className,
  style,
}: {
  white: string;
  accent: string;
  /** The file's own text-box width. See the note above — it sets the ramp. */
  boxWidth: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <h1
      className={cn(
        HEADLINE,
        className,
        "mx-auto max-w-full bg-clip-text text-center font-medium whitespace-pre-line text-transparent [-webkit-background-clip:text]"
      )}
      style={{
        width: boxWidth,
        backgroundImage:
          "linear-gradient(90deg, var(--color-create) 84.6%, #5F3C97 100%)",
        ...style,
      }}
    >
      {/*
        THE SEAM BETWEEN THE TWO COLOURS MUST NOT BREAK.

        Screen one is white "Join live Gist " followed by accent
        "Rooms\nConversations", and the file sets its box at 468. On a 390
        phone "Join live Gist Rooms" does not fit, so the line broke at the
        last space that did — between "Gist" and "Rooms" — and the product's
        own name came out as "Join live Gist / Rooms / Conversations", split
        down the middle across a colour change.

        The words either side of that seam belong together on every screen, not
        just this one: "Gist Rooms", "Real Pals". So the last word of the white
        part and the first word of the accent are welded into one `nowrap`
        span, and the line breaks BEFORE the pair instead of through it. The
        two keep their own colours inside it.

        Skipped when the accent opens with the file's own newline (screen 3),
        because there the break is deliberate and there is no seam to protect.
      */}
      {(() => {
        const joins = !accent.startsWith("\n");
        if (!joins) {
          return (
            <>
              <span className="[-webkit-text-fill-color:#fff]">{white}</span>
              {accent}
            </>
          );
        }
        // `white` ends in a space, so the last word is the one before it.
        const whiteWords = white.split(" ");
        const lastWhite = whiteWords.filter(Boolean).pop() ?? "";
        const whiteHead = white.slice(0, white.lastIndexOf(lastWhite));
        const breakAt = accent.indexOf("\n");
        const firstAccentEnd = accent.indexOf(" ") === -1 ? breakAt : Math.min(...[accent.indexOf(" "), breakAt].filter((n) => n > -1));
        const firstAccent = firstAccentEnd > -1 ? accent.slice(0, firstAccentEnd) : accent;
        const accentTail = firstAccentEnd > -1 ? accent.slice(firstAccentEnd) : "";
        return (
          <>
            <span className="[-webkit-text-fill-color:#fff]">{whiteHead}</span>
            <span className="whitespace-nowrap">
              <span className="[-webkit-text-fill-color:#fff]">{lastWhite} </span>
              {firstAccent}
            </span>
            {accentTail}
          </>
        );
      })()}
    </h1>
  );
}

/**
 * `Frame 2147230430` — 96 wide, 8 tall, 5px gaps, active `--color-spotlight`,
 * inactive #D9D9D9.
 *
 * The widths are the file's and they are not uniform: 50 active, then 19 for
 * the first two slots and 17 for the third. That asymmetry is what makes the
 * row exactly 96 in both states the file actually draws (50+5+19+5+17 and
 * 19+5+50+5+17), so it is kept by slot rather than averaged away.
 */
function Stepper({ step, count = 3 }: { step: number; count?: number }) {
  return (
    <div className="flex h-2 items-center gap-[5px]" role="presentation">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-[25px]",
            i === step ? "bg-spotlight" : "bg-[#D9D9D9]"
          )}
          style={{ width: i === step ? 50 : i === count - 1 ? 17 : 19 }}
        />
      ))}
    </div>
  );
}

/** `Frame 2147225004` and `Frame 2147225680` — 439x49 and 440x49, both pills. */
function Continue({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ws-btn-welcome ws-press h-[49px] w-full rounded-full text-[16px] font-medium transition-opacity hover:opacity-90"
    >
      Continue
    </button>
  );
}

function Skip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ws-btn-skip ws-press h-[49px] w-full rounded-full text-[16px] font-medium transition-opacity hover:opacity-90"
    >
      Skip
    </button>
  );
}

interface Screen {
  art: ArtPiece[];
  sparkles: Sparkle[];
  /** The white run, then the gradient run — the file's own character split. */
  headline: [string, string];
  sub: string;
  /** The file's own text-box width, which is what decides where copy wraps. */
  subWidth: number;
  /** The headline's box width, from the file. Sets where the accent ramp falls. */
  headWidth: number;
  /**
   * Distance from the buttons' bottom edge to the frame's, from the file.
   *
   * Not a constant: screens 1 and 2 end their content at y=966 and screen 3 at
   * 977. The buttons are what the whole stack hangs from, so getting this wrong
   * moved the stepper, headline, copy AND both buttons on screen 3 together.
   */
  padBottom: number;
  /**
   * Space between the stepper and the headline.
   *
   * PER SCREEN, because the file PINS the stepper at y=641 on all three while
   * the headline block moves: 673, 732, 670. So the gap between them is 24, 83
   * and 21 in the file. Treating it as one constant put screen 2's stepper 61px
   * low.
   */
  dotsGap: number;
  /**
   * Headline-to-copy and copy-to-buttons. The file gives 20 and 45 on every
   * screen; these are those numbers less a per-screen correction of one or two
   * pixels, arrived at by measuring both renders.
   *
   * The correction has to be per-screen because Figma reports a TEXT BOX at cap
   * height while CSS lays out a LINE BOX with the font's full ascender and
   * descender, so the two disagree by a fixed amount PER LINE — and these
   * screens do not have the same number of lines. Screen 1 is a two-line
   * headline over two lines of copy; screen 2 is one over one; screen 3 is two
   * over two but at a different leading. Calibrated as one constant, whichever
   * screen it was tuned on came out right and the others sat one to four pixels
   * off.
   */
  subGap: number;
  buttonsGap: number;
  /** Screen 3's headline is the only one at a normal leading (51/49.11). */
  headlineClass?: string;
}

const SCREENS: Screen[] = [
  {
    art: ART_GIST_ROOMS,
    sparkles: SPARKLES_GIST_ROOMS,
    headline: ["Join live Gist ", "Rooms\nConversations"],
    headWidth: 468,
    padBottom: 58,
    dotsGap: 23,
    subGap: 18,
    buttonsGap: 44,
    sub: "Jump into rooms with friends gisting about stuff you care about. Just listen or hop on stage to talk.",
    subWidth: 417,
  },
  {
    art: ART_REAL_PALS,
    sparkles: SPARKLES_REAL_PALS,
    headline: ["Connect with Real ", "Pals"],
    headWidth: 531,
    padBottom: 58,
    dotsGap: 82,
    subGap: 19,
    buttonsGap: 45,
    sub: "Your next friendship starts here on Square.",
    subWidth: 481,
  },
  {
    art: ART_COMMUNITIES,
    sparkles: SPARKLES_COMMUNITIES,
    /*
      The break before "Communities" is EXPLICIT here and implicit in the file.
      The file's string carries no newline; Figma wraps it because at its metrics
      the line comes out 588 wide against a 587 box — a one-pixel overflow. Our
      Geist renders the same string at 555, so it did not wrap and the headline
      came out one line, which dragged the copy and both buttons up with it.
      A layout that depends on a 0.2% metric coincidence is not a layout, so the
      break the file's own render shows is stated outright.
    */
    headline: ["Connect With", "\nCommunities"],
    headWidth: 587,
    padBottom: 47,
    dotsGap: 14,
    subGap: 12,
    buttonsGap: 45,
    sub: "Flow houses and people who share your Interests.\nBuild meaningful connections through voice.",
    subWidth: 481,
    headlineClass: "leading-[1.038]",
  },
];

/**
 * One screen of the sequence, as a pure view.
 *
 * Split from the flow below so the thing that DRAWS has no state in it: the
 * step is an input, which is what lets any single screen be rendered on its own
 * to be checked against the file. A four-step wizard whose screens can only be
 * reached by clicking through it is a four-step wizard nobody verifies.
 *
 * `step === SCREENS.length` is the finale, Desktop 34.
 */
export function WelcomeScreen({
  step,
  onContinue,
  onSkip,
}: {
  step: number;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const finale = step === SCREENS.length;
  const screen = SCREENS[step];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0F0F0F] text-white">
      {/* Ground, sized off the viewport rather than the frame — see WelcomeWash. */}
      <WelcomeWash />
      <WelcomeFrame>
        <WelcomeStage
          pieces={finale ? ART_WELCOME : screen.art}
          sparkles={finale ? [] : screen.sparkles}
        >
          {/* Screen 1's card is built from its parts so its insides can move;
              the pill is the frame's last child and stays on top of it. */}
          {step === 0 && (
            <>
              <GistCard />
              <LiveOnPill />
            </>
          )}
          {/* Screen 2's five cards circulate along the arc the file fans them
              across; see pals-arc.tsx. */}
          {step === 1 && <PalsArc />}
          {/* Screen 3's tiles swing around the hub they are arranged about;
              see communities.tsx. */}
          {step === 2 && <Communities />}
        </WelcomeStage>

        {finale ? (
        /* Desktop 34. The content block sits at y=364 in a 1024 frame, which is
           86px below centre — `pt` of twice that with `justify-center` puts it
           exactly there and still centres on any other height. */
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pt-[86px] @lg:pt-[172px]">
          <div className="ws-welcome-mark w-[140px] @sm:w-[170px] @lg:w-[202.9px]">
            <SquareMark width={202.9} className="h-auto w-full" />
          </div>
          {/* Base weight is 900 and the file overrides only "Welcome to" down to
              500 — so the emphasis is on the NAME, not the greeting. */}
          <h1 className="mt-9 text-center text-[38px] font-black leading-[0.78] @sm:text-[46px] @lg:text-[57.69px]">
            <span className="font-medium">Welcome to</span> Square
          </h1>
          <p className={cn(SUB, "mt-5")} style={{ maxWidth: 481 }}>
            Join conversations, create rooms, go live, and connect with communities to
            share and chat with people who matter to you.
          </p>
          <div className="mt-[127px] w-full max-w-[440px]">
            <Continue onClick={onContinue} />
          </div>
        </div>
      ) : (
        <div
          className="ws-welcome-bottom relative z-10 flex flex-1 flex-col items-center px-5 pt-10 pb-8 @md:pt-[79px]"
          style={{ ["--ws-pad-b" as string]: `${screen.padBottom}px` }}
        >
          <SquareLockup className="[--lockup-mark:72px] @lg:[--lockup-mark:103.1px]" />
          {/* The artwork lives in this gap. On a scaled frame it is the only
              flexible space, so the bottom stack keeps the file's rhythm at
              every height; on a reflowed one it is a fixed band and the give
              moves to `ws-welcome-spring` below. See globals.css. */}
          <div className="ws-welcome-art-gap" />
          <Stepper step={step} />
          {/* `whitespace-pre-line` because the file's own line breaks are part
              of the headline and the copy — screen 3 breaks its two clauses
              deliberately, and screen 1 breaks mid-accent. */}
          <Headline
            white={screen.headline[0]}
            accent={screen.headline[1]}
            boxWidth={screen.headWidth}
            className={screen.headlineClass}
            style={{ marginTop: screen.dotsGap }}
          />
          <p
            className={cn(SUB, "whitespace-pre-line")}
            style={{ maxWidth: screen.subWidth, marginTop: screen.subGap }}
          >
            {screen.sub}
          </p>
          {/* Reflowed screens only — holds the pair against the bottom edge
              while everything above packs up under the wordmark. */}
          <div className="ws-welcome-spring" />
          <div
            className="flex w-full max-w-[440px] flex-col gap-[13px]"
            style={{ marginTop: screen.buttonsGap }}
          >
            <Continue onClick={onContinue} />
            <Skip onClick={onSkip} />
            </div>
          </div>
        )}
      </WelcomeFrame>
    </div>
  );
}

export function WelcomeFlow({
  onDone,
}: {
  /** Both Continue past the last screen and Skip land here: the sign-in card. */
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);

  // Decode the NEXT screen's pictures while this one is being read, so Continue
  // is never followed by a screen assembling itself out of blank rectangles.
  useEffect(() => {
    const next = SCREENS[step + 1]?.art ?? (step < SCREENS.length ? ART_WELCOME : null);
    if (next) prefetchArt(next);
  }, [step]);

  return (
    <WelcomeScreen
      step={step}
      onContinue={() => (step === SCREENS.length ? onDone() : setStep((s) => s + 1))}
      onSkip={onDone}
    />
  );
}

/* ── Who sees this, and once ───────────────────────────────────────────────── */

const SEEN_KEY = "ms.welcome.seen";

/**
 * "Has this browser seen the welcome" is a tiny external store, read through
 * `useSyncExternalStore`, for the reason every other browser-storage flag in
 * this app is: `localStorage` DOES NOT EXIST ON THE SERVER, so reading it in a
 * state initialiser renders one thing on the server and another on the client.
 * Reading it in an effect instead is worse — the first client paint is then the
 * welcome screen, over the app, for somebody who dismissed it months ago.
 *
 * The server snapshot is `true` — "seen". A default of `false` would flash the
 * whole sequence during hydration on every load; the cost of `true` is that a
 * genuine newcomer sees it a beat after hydration rather than before, which
 * nobody can perceive because the splash is still on top at that point.
 */
let listeners: (() => void)[] = [];
let cache: boolean | null = null;

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // A private window throws on access. Treat it as seen: a welcome screen
    // must never be the thing that stands between a reader and the app.
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Cached because `useSyncExternalStore` requires a snapshot that is stable
// between renders — returning a fresh read every time is an infinite loop.
const getSnapshot = () => (cache ??= readSeen());
const getServerSnapshot = () => true;

/** Remember it was seen, and tell every mounted reader at once. */
export function markWelcomeSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* Unavailable: it shows again next visit. Not worth an error. */
  }
  cache = true;
  for (const l of listeners) l();
}

/**
 * Whether to show the welcome sequence: signed out, never seen in this browser,
 * and standing at one of the two front doors above.
 */
export function useShowWelcome(
  pathname: string,
  returnTo: string | null,
  authenticated: boolean,
  ready: boolean
) {
  const seen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    show: ready && !authenticated && !seen && isWelcomeSurface(pathname, returnTo),
    dismiss: markWelcomeSeen,
  };
}
