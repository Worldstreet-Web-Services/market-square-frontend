"use client";

import Link from "next/link";

/**
 * The "Build your audience live" banner.
 *
 * Measured: 707x66 at radius 12, linear gradient #ad46ff → #682a99, the 3D
 * avatar (71x106) overflowing the banner top and bottom with a soft elliptical
 * shadow beneath it, copy at 14px/600 on two lines, and a white pill button.
 *
 * The artwork bleeds past the banner's box, which is the whole reason it reads
 * as an object sitting on the strip rather than a picture inside it — so the
 * container cannot clip, and the banner carries top/bottom margin of its own
 * to make room for the overflow.
 */
export function LiveCta() {
  return (
    <div className="px-4 pb-4 lg:px-6">
      <div className="relative flex h-[66px] items-center rounded-[12px] bg-[linear-gradient(90deg,#ad46ff_0%,#682a99_100%)] pl-[76px] pr-4 sm:pl-[89px] sm:pr-[17px]">
        {/* The shadow is drawn first and separately: it grounds the figure on
            the strip, and the figure itself has no box to cast one. */}
        <span className="pointer-events-none absolute bottom-[9px] left-[30px] h-1 w-7 rounded-[50%] bg-black/25 blur-[1px]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative art, not a responsive photo */}
        <img
          src="/live-go-live-avatar.png"
          alt=""
          width={71}
          height={106}
          aria-hidden
          className="pointer-events-none absolute -top-[18px] left-2 h-[106px] w-[71px] select-none object-contain"
        />

        <p className="min-w-0 flex-1 text-[14px] font-semibold leading-[16.15px] text-white">
          Build your audience live. Stream now and
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
