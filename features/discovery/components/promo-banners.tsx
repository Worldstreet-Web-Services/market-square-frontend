"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useFitText } from "@/hooks/use-fit-text";

// ─── KASH BANNER ────────────────────────────────────────────────────────────
// Gold ticket promo for Kash+. Scales proportionally from a 515.768x88 artboard.

const KASH_W = 515.768;
const KASH_H = 88;

function kashPct(px: number) {
  return `${((px / KASH_W) * 100).toFixed(4)}%`;
}
function kashCqw(px: number) {
  return `${((px / KASH_W) * 100).toFixed(4)}cqw`;
}

const KASH_FILL = {
  left: `${((21.2416 / KASH_W) * 100).toFixed(4)}%`,
  top: `${((3.0344 / KASH_H) * 100).toFixed(4)}%`,
  width: `${((473.379 / KASH_W) * 100).toFixed(4)}%`,
  height: `${((81.931 / KASH_H) * 100).toFixed(4)}%`,
};

export function KashBanner({ onBuy }: { onBuy: () => void }) {
  const { ref: headlineRef, scale } = useFitText<HTMLSpanElement>("Get Kash+", 0.88);

  return (
    <button
      type="button"
      onClick={onBuy}
      className="@container relative block w-full cursor-pointer overflow-hidden text-left transition-transform active:scale-[0.99]"
      style={{ aspectRatio: `${KASH_W} / ${KASH_H}` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/market/kash-banner-art.svg" alt="" aria-hidden className="pointer-events-none absolute" style={KASH_FILL} />
      {(["left", "right"] as const).map((side) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={side}
          src="/market/kash-banner-scallop.svg"
          alt=""
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 h-full ${side === "left" ? "left-0" : "right-0"}`}
          style={{ width: kashPct(27.2165) }}
        />
      ))}
      <span
        className="absolute top-[35.34%] flex h-[40.166%] items-center"
        style={{
          left: kashPct(216.31),
          right: kashPct(27.2165 + 12),
          gap: kashCqw(7),
        }}
      >
        <span
          ref={headlineRef}
          className="min-w-0 flex-1 whitespace-nowrap font-serif font-bold text-[rgba(108,43,9,0.94)]"
          style={{
            fontSize: `calc(${kashCqw(43.238)} * ${scale.toFixed(4)})`,
            lineHeight: 1,
            letterSpacing: `${(-2.2091 / 43.238).toFixed(6)}em`,
          }}
        >
          Get Kash+
        </span>
        <span aria-hidden className="shrink-0 rounded-full bg-[#FBEAA7]/80" style={{ width: kashCqw(0.8929), height: kashCqw(25.002) }} />
        <span
          className="line-clamp-3 max-h-full shrink-0 font-sans font-bold text-[rgba(108,43,9,0.72)]"
          style={{ width: kashCqw(98), fontSize: `max(6px, ${kashCqw(7.78)})`, lineHeight: `max(7.7px, ${kashCqw(9.94)})` }}
        >
          Earn extra cash every month with Kash+
        </span>
      </span>
    </button>
  );
}

// ─── MARKET SQUARE BANNER ───────────────────────────────────────────────────
// Purple gradient ticket promoting Market Square.

const MSQ_W = 339.9381;
const MSQ_H = 58;

export function MarketSquareBanner({ className }: { className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setScale(entry.contentRect.width / MSQ_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ART = "/market/square-banner";

  return (
    <a
      href="/"
      aria-label="Explore Market Square"
      ref={ref}
      className={cn("relative block w-full overflow-hidden transition-transform active:scale-[0.99]", className)}
      style={{ aspectRatio: `${MSQ_W} / ${MSQ_H}` }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: MSQ_W, height: MSQ_H, transform: `scale(${scale})` }}>
        <div className="absolute overflow-hidden" style={{ left: 14, top: 2, width: 312, height: 54, backgroundImage: "linear-gradient(130.9967deg, #C7A4FF 3.4647%, #7E3BEB 80.657%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/ring.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 14, top: 2.263, width: 109.097, height: 108.742 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/ring.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 113, top: -66.737, width: 109.097, height: 108.742 }} />
          <div aria-hidden className="pointer-events-none absolute" style={{ left: 78, top: 27, width: 45, height: 45, borderRadius: 29, background: "#7E3BEB", filter: "blur(15.85px)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/people.png`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 139.432, top: -14.958, width: 88.233, height: 110.312, transform: "rotate(-9.58deg)" }} />
          {/* Hearts */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/spark-b.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 176, top: 7, width: 5.27, height: 4.57, transform: "rotate(6.61deg)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/spark-a.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 172, top: 11, width: 6.28, height: 6.06, transform: "rotate(-34.16deg)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/spark-c.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 175, top: 17, width: 6.8, height: 6, transform: "rotate(10.4deg)" }} />
          {/* Stickers */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/sticker-warm.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 209.446, top: 17.442, width: 9.2, height: 9.2, transform: "rotate(26.2deg)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/sticker-cool.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 146.047, top: 31.698, width: 9.54, height: 8.87, transform: "rotate(-31.29deg)" }} />
          {/* Chat bubble */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/bubble.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 218, top: -15.826, width: 109.72, height: 81.652, transform: "scaleX(-1)" }} />
          {/* Arrow */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/arrow.svg`} alt="" aria-hidden className="pointer-events-none absolute max-w-none" style={{ left: 183.924, top: 47.726, width: 7.512, height: 5.59, transform: "rotate(-141.72deg) scaleY(-1)" }} />
          {/* Text */}
          <div className="absolute flex flex-col justify-center" style={{ left: 21, top: 29, width: 132.477, transform: "translateY(-50%)", color: "#DDC4FA" }}>
            <p style={{ fontSize: 8.549, lineHeight: "9.865px", fontWeight: 500 }}>
              Discover <span style={{ color: "#F8F2FF", fontWeight: 700 }}>live streams</span>, connect with creators
            </p>
            <p style={{ fontSize: 8.549, lineHeight: "9.865px", fontWeight: 500 }}>
              and explore the <span style={{ color: "#F7F0FF", fontWeight: 600, fontSize: 10.721 }}>Market Square</span>
            </p>
          </div>
          {/* Explore chip */}
          <div aria-hidden className="absolute flex items-center" style={{ left: 283.015, top: 44.0, width: 23.987, height: 6.0, borderRadius: 6.285, background: "#B890FB", border: "0.273px solid #FBEAA7", paddingLeft: 4.767, paddingRight: 3.9, paddingTop: 1.333, paddingBottom: 0.867, gap: 0.867 }}>
            <span className="whitespace-nowrap font-sans text-white uppercase" style={{ fontSize: 2.57, fontWeight: 600, lineHeight: "normal" }}>Explore</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ART}/chip-caret.svg`} alt="" className="max-w-none" style={{ width: 1.632, height: 1.632, transform: "rotate(91.4deg)" }} />
          </div>
        </div>
        {/* Scalloped edges */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/scallop-left.svg`} alt="" aria-hidden className="pointer-events-none absolute top-0 left-0 max-w-none" style={{ width: 17.938, height: MSQ_H }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/scallop-right.svg`} alt="" aria-hidden className="pointer-events-none absolute top-0 max-w-none" style={{ left: 322, width: 17.938, height: MSQ_H }} />
      </div>
    </a>
  );
}

// ─── SET THE STAKE BANNER ───────────────────────────────────────────────────
// Red casino ticket banner.

const STAKE_W = 337;
const STAKE_H = 61;

export function SetTheStakeBanner({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { ref: pitchRef, scale: pitchScale } = useFitText<HTMLParagraphElement>("Set the stake", 0.88);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (width: number) => setScale(width / STAKE_W);
    measure(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ART = "/casino/set-the-stake";

  return (
    <div ref={ref} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${STAKE_W} / ${STAKE_H}` }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: STAKE_W, height: STAKE_H, transform: `scale(${scale})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/ticket-edge.svg`} alt="" className="pointer-events-none absolute top-px left-0 h-[60px] w-[17.938px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${ART}/ticket-edge.svg`} alt="" className="pointer-events-none absolute top-0 left-[319px] h-[60px] w-[17.938px]" />
        <div className="absolute top-[4px] left-[12px] h-[54px] w-[312px] overflow-hidden bg-[#ed2b07]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/glow-right.svg`} alt="" className="pointer-events-none absolute top-[-47.1px] left-[123.44px] size-[287.48px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/glow-left.svg`} alt="" className="pointer-events-none absolute top-[-11.37px] left-[-12.99px] size-[165.667px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ART}/flame.svg`} alt="" className="pointer-events-none absolute top-[5px] left-[12px] h-[64.896px] w-[39.005px]" />
          <div className="absolute inset-y-0 right-[8px] left-[59px] flex items-center gap-[6px]">
            <p ref={pitchRef} className="min-w-0 flex-1 font-serif font-bold leading-none whitespace-nowrap capitalize text-white" style={{ fontSize: `calc(16px * ${pitchScale.toFixed(4)})` }}>
              Set the stake
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ART}/divider.svg`} alt="" className="pointer-events-none h-[15px] w-px shrink-0" />
            <p className="shrink-0 text-[12px] font-medium leading-[1.52] tracking-[-0.24px] whitespace-nowrap capitalize text-white">
              Everyone plays to win
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GET KASH BANNER ────────────────────────────────────────────────────────
// Simple PNG banner button.

export function GetKashBanner({ onBuy }: { onBuy: () => void }) {
  return (
    <button
      type="button"
      onClick={onBuy}
      aria-label="Get Kash+ and start earning extra cash"
      className="block w-full cursor-pointer transition-transform active:scale-[0.99]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kash/get-kash-banner.png" alt="" width={340} height={58} className="block h-auto w-full" />
    </button>
  );
}
