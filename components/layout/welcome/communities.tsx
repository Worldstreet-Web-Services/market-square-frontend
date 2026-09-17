import { cn } from "@/lib/cn";
import { x, y } from "@/components/layout/welcome/welcome-art";
import { asset } from "@/lib/square-path";

/**
 * SCREEN 3'S CONSTELLATION — the tiles of `Desktop - 36`.
 *
 * ─── WHAT THE LAYOUT IS ─────────────────────────────────────────────────────
 * A hub and four satellites. Measuring their centres against the big centre
 * tile gives radii of 277 to 371 at roughly the four diagonals — the file has
 * drawn people arranged around a community, which is what the screen says.
 *
 * So they ORBIT it. Each satellite swings around the hub's centre rather than
 * drifting on its own axis, because a tile that rotates in place reads as a
 * loose photo while a tile that arcs around a point reads as belonging to it.
 *
 * ─── WHY IT IS A SWING AND NOT A REVOLUTION ─────────────────────────────────
 * A full orbit is the obvious idea and it is wrong here. The hub sits at
 * y=428 and the outermost satellite is 371 away, so the bottom of that circle
 * is y=799 — right through the headline and the copy. Carrying photographs of
 * people across a line of text is not ambient, it is a distraction with a
 * period.
 *
 * Each tile instead swings a few degrees either side of where the file puts it,
 * on its own amplitude and its own clock. It never leaves its quadrant, never
 * reaches the copy, and the arrangement the file drew stays legible at every
 * moment of the loop.
 *
 * Because the swing is symmetric about zero, the RESTING state is the file's
 * own layout exactly — no pausing trick needed, `animation: none` under
 * reduced motion simply leaves every tile where it was drawn.
 *
 * The hub itself only breathes: 2.5% of scale over eight and a half seconds. It
 * is the thing everything else is arranged around, so it should be the calmest
 * object on the screen, not the busiest.
 */

/** Centre of `Group 1000002776`, the hub every satellite turns around. */
const HUB = { cx: 696.9, cy: 428.45 };

const HERO = { src: "s3-tile-hero", left: 559, top: 279, width: 275.8 };

/**
 * The four satellites, in the file's own back-to-front order.
 *
 * No two amplitudes and no two periods match, and none of the periods divide
 * into another — with a shared beat, four tiles swinging together stop reading
 * as a constellation and start reading as one object wobbling.
 */
const SATELLITES = [
  { src: "s3-tile-a", left: 283, top: 481, width: 167.3, swing: 3.2, dur: 13, delay: -2.1 },
  { src: "s3-tile-b", left: 888, top: 231, width: 154.1, swing: 2.6, dur: 16, delay: -7.4 },
  { src: "s3-tile-c", left: 959, top: 473, width: 168.5, swing: 3.6, dur: 11, delay: -4.8 },
  { src: "s3-tile-d", left: 371, top: 238, width: 145.2, swing: 2.9, dur: 18, delay: -11.3 },
];

export function Communities() {
  return (
    <>
      {SATELLITES.map((t) => (
        /*
          The wrapper spans the whole stage so its `transform-origin` percentage
          resolves against the stage, letting the tile turn about a point far
          outside itself. `inset-0` is also what keeps the tile's own percentage
          position meaningful once the wrapper carries a transform — a
          transformed element becomes the containing block for its absolutely
          positioned children.
        */
        <div
          key={t.src}
          className="ws-orbit absolute inset-0"
          style={{
            transformOrigin: `${(HUB.cx / 1440) * 100}% ${(HUB.cy / 1024) * 100}%`,
            animationDuration: `${t.dur}s`,
            animationDelay: `${t.delay}s`,
            ["--ws-swing" as string]: `${t.swing}deg`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size */}
          <img
            src={asset(`/onboarding/welcome/${t.src}.webp`)}
            alt=""
            className="absolute"
            style={{ left: x(t.left), top: y(t.top), width: x(t.width) }}
          />
        </div>
      ))}

      {/* eslint-disable-next-line @next/next/no-img-element -- static art, intrinsic size */}
      <img
        src={asset(`/onboarding/welcome/${HERO.src}.webp`)}
        alt=""
        className={cn("ws-hub absolute")}
        style={{ left: x(HERO.left), top: y(HERO.top), width: x(HERO.width) }}
      />
    </>
  );
}
