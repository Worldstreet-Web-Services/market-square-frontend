import { x, y } from "@/components/layout/welcome/welcome-art";

/**
 * THE PALS CAROUSEL — the five cards of `Desktop - 33`, circulating along the
 * arc they are already fanned across.
 *
 * ─── WHAT THE FILE ACTUALLY DRAWS ───────────────────────────────────────────
 * Not five different cards. ONE card at five angles: solving each rotated
 * bounding box back gives 277 x 357 every time, and only the centre one — the
 * featured slot — is taller at 277 x 377. Their centres and angles trace a
 * shallow arc:
 *
 *     -16.86deg   -7.33deg    0deg     +10.63deg   +17.19deg
 *      (80,501)  (392,438)  (706,409)  (1018,447)  (1325,524)
 *
 * That is a carousel drawn at rest. So it moves as one.
 *
 * ─── WHY THE ART HAD TO BE UN-ROTATED ───────────────────────────────────────
 * A Figma export bakes the node's rotation into the pixels, so the five
 * exported cards each carry a fixed tilt. A card that must travel from slot 1
 * to slot 2 has to CHANGE angle, which a baked tilt cannot do. Each export was
 * rotated back upright and cropped to the true 277 x 357, once, offline — so
 * the browser rotates flat art rather than re-rotating already-rotated pixels.
 *
 * ─── THE TRACK, AND WHY IT WRAPS UNDER THE FLOOR ────────────────────────────
 * The circle those five slots sit on is extended to TEN — three more off the
 * left edge, two more off the right — and each slot gets a card. Cards then ride
 * in from one side of the screen and out of the other, which is what the arc was
 * always describing.
 *
 * ─── WHY TEN CARDS AND NOT FIVE ─────────────────────────────────────────────
 * Five cards on five slots leaves no phase for getting from the last slot back
 * to the first, so that return has to be stolen from the visible cycle and one
 * slot is always empty. Shrinking the return to close that gap is worse: it
 * makes the phase spacing uneven, and two cards ended up 12% apart and drove
 * straight into each other.
 *
 * One card per slot, evenly spaced in both time and distance, makes uniform
 * spacing a property of the construction rather than something to tune. Nothing
 * can bunch and nothing can gap.
 *
 * The five faces repeat every five slots and the visible band is five slots
 * wide, so the five people on screen are always five different people.
 *
 * ─── STILLNESS IS THE FILE ──────────────────────────────────────────────────
 * `prefers-reduced-motion` PAUSES this rather than removing it. A paused
 * animation holds the frame its negative delay lands on, so at rest the cards
 * sit on slots 3-7 — the file's own five, in the file's own order, to the pixel.
 * `animation: none` would stack all ten on the anchor.
 *
 * ─── GEOMETRY ───────────────────────────────────────────────────────────────
 * Every offset below is a PERCENTAGE OF THE CARD, not of the stage, because
 * `translate()` percentages resolve against the element's own box. The card is
 * sized as a percentage of the stage, so the whole track scales with the stage
 * and stays correct at any window size. In px it would only be right at 1440.
 */

/** The wrapper every card lives in: the file's 277 x 357, centred on slot 3. */
const CARD_W = 277;
const CARD_H = 357;
/** `Frame 2147230451` — the file's leftmost slot, and the track's anchor. */
const ANCHOR = { cx: 80.32, cy: 501.0 };

/** The five faces, in the file's own left-to-right order. */
const CARDS = [
  { src: "s2-flat-diva", h: 357 },
  { src: "s2-flat-cron", h: 357 },
  { src: "s2-flat-jessica", h: 377 },
  { src: "s2-flat-temi", h: 357 },
  { src: "s2-flat-jamaal", h: 357 },
];

/** Ten slots on the track, so ten cards. See the note above. */
const SLOTS = 10;

/**
 * Which slot the file's first card sits on.
 *
 * The track starts three slots off the left edge, so the file's leftmost card
 * is the fourth. Offsetting the image assignment by this puts Diva, Crón,
 * Jessica, Temi and Jamaal on slots 3-7 at rest — the file's own layout, in the
 * file's own order.
 */
const FIRST_VISIBLE = 3;

/** One full circuit: ten slots at a shade under four seconds each. */
const PERIOD = 38;

export function PalsArc() {
  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => {
        const card = CARDS[(i - FIRST_VISIBLE + SLOTS * CARDS.length) % CARDS.length];
        return (
          <div
            key={i}
            className="ws-pal absolute"
            style={{
              left: x(ANCHOR.cx - CARD_W / 2),
              top: y(ANCHOR.cy - CARD_H / 2),
              width: x(CARD_W),
              height: y(CARD_H),
              animationDuration: `${PERIOD}s`,
              // One slot further along the same track than the card before it.
              animationDelay: `${-(PERIOD / SLOTS) * i}s`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size */}
            <img
              src={`/onboarding/welcome/${card.src}.webp`}
              alt=""
              className="absolute left-0 w-full"
              // The featured card is 20px taller than the rest. It keeps its own
              // height and is centred in the shared wrapper, so the wrapper — and
              // therefore the track — stays identical for all of them.
              style={{
                height: `${(card.h / CARD_H) * 100}%`,
                top: `${((CARD_H - card.h) / 2 / CARD_H) * 100}%`,
              }}
            />
          </div>
        );
      })}
    </>
  );
}
