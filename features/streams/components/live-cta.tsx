"use client";

import Link from "next/link";

/**
 * The "Build your audience live" banner.
 *
 * Measured: 707x66 at radius 12, linear gradient #ad46ff → #682a99, copy at
 * 14px/600 on two lines, and a white pill button 17 from the right edge.
 *
 * The figure is sized to what the design actually SHOWS — a ~47px orb centred
 * in the strip — not to the 71x106 image rect that carries it. That rect is
 * mostly transparent padding around the artwork, so building it literally drew
 * a half-size orb floating in an oversized box. The asset ships cropped to the
 * orb and is placed at the size it reads at, with its shadow drawn separately.
 */
export function LiveCta() {
  return (
    <div className="px-4 lg:px-6">
      <div className="relative flex h-[66px] items-center rounded-[12px] bg-[linear-gradient(90deg,#ad46ff_0%,#682a99_100%)] pl-[72px] pr-4 sm:pr-[17px]">
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
    </div>
  );
}
