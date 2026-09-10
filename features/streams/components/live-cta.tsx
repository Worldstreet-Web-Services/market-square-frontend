"use client";

import Link from "next/link";

/**
 * THE GO LIVE BANNER — node 647:17219, directly under Home's topic row (live
 * file, updated 2026-09-10), and the Live page's prompt.
 *
 * ─── FROM md UP: THE FILE'S ARTBOARD, SCALED AS ONE PICTURE ─────────────────
 * The file draws it 938 x 168, and Home's column is 600. Reflowing a two-line
 * 20.77px headline around a 138px figure and a 149px button in that width
 * breaks the composition, so every length below is the file's own number
 * written as a share of 938 (`u()`, container units): the banner is the
 * artboard at whatever width it is given, never a rearrangement of it. It is
 * capped at the file's 938 so a wide page never draws it past its own size.
 *
 * From the node:
 *   · the ground: the file's gradient handles projected onto the real 938 x
 *     168 box, 92deg from #AD46FF at -16.3% to #682A99 at 82%. The MCP summary's
 *     "126deg 0% -> 82%" is the angle in the unit square, not on this box.
 *   · two white strokes (647:17220 under everything, 647:17227 over it) at 25%
 *     in SOFT-LIGHT, drawn from the file's own outlined stroke geometry at their
 *     node transforms (the second is turned 180deg), clipped by the banner.
 *   · the figure (647:17226): the exported image stretched to its 137.72 x 134
 *     box at (18, -16), whose top the banner clips, over a 59 x 8.43 ellipse of
 *     25% black at (58, 131) under the file's 8.43 layer blur (4.21 in CSS).
 *   · the copy: Geist SemiBold 20.77 / 23.96, white, with the file's own line
 *     break, centred in its 407 x 39 box at (171, 64).
 *   · the button: a white full pill, 149 x 41.7 at (756, 63), "Go Live" in bold
 *     20.55 / 27.4 #682A98 (Geist, not the file's Roboto), under the file's two
 *     soft shadows.
 *
 * ─── BELOW md: THE COMPACT STRIP ─────────────────────────────────────────────
 * No phone frame was given, and the artboard at a phone's width would set the
 * headline near 8px. Phones keep the compact strip this banner was before.
 */
const DESIGN_W = 938;
const DESIGN_H = 168;
/** A length on the file's 938-wide artboard, as a share of the banner's width. */
const u = (px: number) => `${((px / DESIGN_W) * 100).toFixed(4)}cqw`;

export function LiveCta() {
  return (
    <>
      <div className="relative flex h-[66px] items-center rounded-[12px] bg-[linear-gradient(90deg,#ad46ff_0%,#682a99_100%)] pl-[72px] pr-4 sm:pr-[17px] md:hidden">
        {/* The shadow is drawn separately: it grounds the figure on the strip,
            and the figure itself has no box to cast one. */}
        <span className="pointer-events-none absolute bottom-[9px] left-[30px] h-1 w-7 rounded-[50%] bg-black/25 blur-[1px]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative art, not a responsive photo */}
        <img
          src="/live-go-live-avatar.png"
          alt=""
          width={47}
          height={49}
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 h-[49px] w-[47px] -translate-y-1/2 select-none object-contain"
        />
        <p className="min-w-0 flex-1 text-[14px] font-semibold leading-[16.15px] text-white">
          Build your audience live Stream now and
          <br className="hidden sm:inline" /> watch your community grow instantly.
        </p>
        <Link
          href="/studio"
          className="ws-press ml-3 flex h-6 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-bold leading-none text-black transition-opacity hover:opacity-90"
        >
          Go Live
        </Link>
      </div>

      <div className="hidden md:block">
        <div className="@container mx-auto w-full max-w-[938px]">
          <div
            className="relative overflow-hidden bg-[linear-gradient(92deg,#AD46FF_-16.3%,#682A99_82%)]"
            style={{ height: u(DESIGN_H), borderRadius: u(12) }}
          >
            {/* 647:17220 — the first stroke, under everything. */}
            <svg
              aria-hidden
              viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ mixBlendMode: "soft-light" }}
            >
              <g opacity={0.25} transform="matrix(1 0 0 1 -41 -92)">
                <path d="M179.947 136.641L177.187 144.376L179.947 136.641ZM60.5234 129.262L63.2901 136.996C89.3418 127.675 126.357 126.241 177.187 144.376L179.947 136.641L182.707 128.905C129.225 109.824 88.2063 110.635 57.7567 121.529L60.5234 129.262ZM179.947 136.641L177.187 144.376C254.615 172.002 320.16 150.27 368.121 114.976C415.7 79.9627 446.671 31.1528 455.824 2.49928L448 0L440.176 -2.49928C432.156 22.6072 403.393 68.6243 358.385 101.745C313.76 134.585 253.865 154.293 182.707 128.905L179.947 136.641ZM83.0689 159.119L86.5961 166.537C109.518 155.636 131.192 142.572 144.781 127.931C151.615 120.568 156.877 112.305 158.802 103.234C160.789 93.8752 159.052 84.4307 153.247 75.4387L146.347 79.8933L139.446 84.348C143.043 89.9193 143.765 94.9648 142.734 99.823C141.641 104.968 138.409 110.649 132.741 116.756C121.325 129.056 101.958 141.042 79.5417 151.702L83.0689 159.119ZM60.5234 129.262L57.7567 121.529C47.5145 125.193 40.026 130.816 36.4294 138.121C32.6601 145.778 33.8706 153.919 38.4623 160.158C47.3692 172.262 66.8853 175.91 86.5961 166.537L83.0689 159.119L79.5417 151.702C64.3704 158.916 54.4299 154.142 51.6925 150.422C50.4622 148.75 50.3037 147.13 51.1669 145.377C52.2028 143.273 55.3484 139.837 63.2901 136.996L60.5234 129.262Z" fill="#FFFFFF" />
              </g>
            </svg>

            <p
              className="absolute flex items-center whitespace-nowrap font-semibold text-white"
              style={{ left: u(171), top: u(64), width: u(407), height: u(39), fontSize: u(20.769), lineHeight: u(23.965) }}
            >
              <span>
                Build your audience live Stream now and
                <br />
                watch your community grow instantly.
              </span>
            </p>

            <Link
              href="/studio"
              className="ws-press absolute flex items-center justify-center rounded-full bg-white font-bold text-[#682A98] transition-opacity hover:opacity-90"
              style={{
                left: u(756),
                top: u(63),
                width: u(149),
                height: u(41.7),
                fontSize: u(20.552),
                lineHeight: u(27.402),
                boxShadow: `0 ${u(1.713)} ${u(3.425)} ${u(-1.713)} rgba(0,0,0,0.1), 0 ${u(1.713)} ${u(5.138)} 0 rgba(0,0,0,0.1)`,
              }}
            >
              Go Live
            </Link>

            {/* 677:18734 — the figure over its blurred shadow. */}
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-[50%] bg-black/25"
              style={{ left: u(58), top: u(131), width: u(59), height: u(8.43), filter: `blur(${u(4.21)})` }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative art scaled with the banner */}
            <img
              src="/live/go-live-mascot.png"
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: u(18), top: u(-16), width: u(137.72), height: u(134) }}
            />

            {/* 647:17227 — the second stroke, turned 180deg, over everything. */}
            <svg
              aria-hidden
              viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              style={{ mixBlendMode: "soft-light" }}
            >
              <g opacity={0.25} transform="matrix(-1 0 0 -1 992 275.203125)">
                <path d="M258.272 196.116L254.504 206.677L254.504 206.677L258.272 196.116ZM81.0401 187.741L76.8506 177.34L81.0401 187.741ZM113.601 231.015L108.899 220.836L113.601 231.015ZM81.0401 187.741L85.2295 198.141C123.045 182.909 177.902 179.346 254.504 206.677L258.272 196.116L262.04 185.555C181.62 156.863 120.94 159.58 76.8506 177.34L81.0401 187.741ZM258.272 196.116L254.504 206.677C365.415 246.248 459.292 215.127 528.012 164.557C596.21 114.371 640.583 44.4131 653.681 3.41197L643 0L632.319 -3.41197C620.768 32.7469 579.408 98.8916 514.72 146.495C450.553 193.715 364.39 222.072 262.04 185.555L258.272 196.116ZM113.601 231.015L118.303 241.194C152.443 225.423 185.042 206.385 205.653 185.045C216.003 174.329 224.025 162.327 227.113 149.157C230.303 135.555 227.97 121.758 219.467 108.587L210.047 114.668L200.626 120.75C206.004 129.08 207.007 136.674 205.28 144.037C203.451 151.834 198.304 160.374 189.523 169.466C171.873 187.74 142.367 205.375 108.899 220.836L113.601 231.015ZM81.0401 187.741L76.8506 177.34C63.0154 182.913 53.0825 191.088 48.5144 201.372C43.7639 212.066 45.6734 223.203 52.0305 231.75C64.425 248.415 91.1764 253.726 118.303 241.194L113.601 231.015L108.899 220.836C88.156 230.418 74.1713 223.943 70.0248 218.367C68.1114 215.795 67.7993 213.198 69.0086 210.476C70.4004 207.343 74.609 202.419 85.2295 198.141L81.0401 187.741Z" fill="#FFFFFF" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
