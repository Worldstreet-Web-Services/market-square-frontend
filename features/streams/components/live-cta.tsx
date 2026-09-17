"use client";

import { useRouter } from "next/navigation";
import { useGate } from "@/hooks/use-gate";
import { asset, sq } from "@/lib/square-path";

/**
 * "CREATE YOUR GISTROOM NOW" — node 1305:149178, the first section of the
 * 2026-09-12 Home.
 *
 * This REPLACES the 938 x 168 banner from 647:17219. It is a different
 * composition at a different size, not a restyle: 573 x 102 at radius 10, the
 * mascot overhanging the top edge, two arcs, a white pill, and four pager dots
 * 9 below it.
 *
 * ─── THE FILE'S NUMBERS, READ FROM THE RAW NODE ──────────────────────────────
 *   · the ground: `linear-gradient(126deg, #AD46FF 0%, #682A99 82%)`, radius 10;
 *   · TWO arcs (1295:147719 under, 1295:147727 over), each exported with its
 *     own `opacity 0.25` and `mix-blend-mode: soft-light` already in the file —
 *     so they are dropped in as images rather than re-drawn as paths;
 *   · the mascot 98.96 x 96.29 at (5, -12), whose top 12 the banner CLIPS
 *     (`clipsContent: true` on 1295:147718 — the arcs run far outside it too),
 *     over a 42.39 x 6.06 black/25 ellipse at (28.74, 100.63) under a 6.056
 *     layer blur (CSS takes half);
 *   · the copy at (103.55, 27.76): ONE text node in two runs, per its
 *     `characterStyleOverrides` — "Create your Gistroom now" in Manrope Bold
 *     24/32.784 white, then the rest in Geist Medium 10 at #E9CEFF;
 *   · the button 90 x 38 at (458, 32): white, radius full, a 2px INSIDE stroke
 *     at rgba(194,160,250,0.55), `0 6 6.2 rgba(0,0,0,0.25)`, the label
 *     "Host Room" at 12.44/16.59 in #682A98 (Geist, not the file's Roboto —
 *     this repo's standing rule);
 *   · the dots 9 under the banner: 27.08 active in #7E3BEB, then 10.29, 9.21,
 *     9.21 in #D9D9D9, all 4.33 tall at radius 13.54, spaced 2.708.
 *
 * ─── HOW IT SCALES ───────────────────────────────────────────────────────────
 * `--u` is 1/573rd of the banner's own width, so the whole composition holds
 * its proportions in this column and in any other. Below `md` the numbers would
 * put the headline near 15px on a phone, which is the one place the file's
 * artboard cannot simply shrink into — so the phone keeps the compact strip,
 * with the file's own words and its button.
 *
 * ─── WHO SEES IT ─────────────────────────────────────────────────────────────
 * EVERYONE (ogazboiz, 2026-09-12). It was signed-in only, on the reasoning that
 * a control opening a login wall is bait — but this is the strongest invitation
 * on the page and it was showing to nobody who had not already joined. A
 * signed-out reader is gated into sign-in on the tap instead.
 */
const W = 573;
/** A length on the file's 573-wide banner, as a share of its width. */
const u = (px: number) => `${((px / W) * 100).toFixed(4)}cqw`;

const HEADLINE = "Create your Gistroom now";
const SUBLINE = "Host live GistTalk sessions and watch your community thrive instantly.";
/** 1295:147729 — the four dots, the file's own widths. */
const DOTS = [27.08, 10.29, 9.21, 9.21];

export function LiveCta() {
  const gate = useGate();
  const router = useRouter();
  // A client navigation: a full load here tore down the gist room the reader
  // had minimised on /live. The page opens the sheet off `?open=1` on arrival.
  const open = () => gate(() => router.push(sq("/gist-rooms?open=1")));

  return (
    <>
      {/* The phone strip: the file gives no phone frame, and its artboard at
          360 would set the headline near 15px against a 99px mascot. */}
      <div className="relative flex h-[66px] items-center rounded-[12px] bg-[linear-gradient(126deg,#AD46FF_0%,#682A99_82%)] pl-[72px] pr-4 md:hidden">
        <span className="pointer-events-none absolute bottom-[9px] left-[30px] h-1 w-7 rounded-[50%] bg-black/25 blur-[1px]" />
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size decorative art */}
        <img
          src={asset("/home/banner-mascot.png")}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute bottom-0 left-4 h-[62px] w-[58px] select-none object-contain"
        />
        <p className="min-w-0 flex-1 text-[13px] font-bold leading-[16px] text-white">
          {HEADLINE}
        </p>
        <button
          type="button"
          onClick={open}
          className="ws-press ml-3 flex h-7 shrink-0 items-center rounded-full bg-white px-3 text-[12px] font-bold leading-none text-[#682A98] transition-opacity hover:opacity-90"
        >
          Host Room
        </button>
      </div>

      <div className="hidden md:block">
        <div className="@container mx-auto w-full max-w-[573px]">
          {/* CLIPPED, as the frame is (`clipsContent: true`): both arcs run
              well outside the box and the mascot's top 12 is cut. Without this
              the arcs paint onto the page around the banner. */}
          <div
            className="relative overflow-hidden bg-[linear-gradient(126deg,#AD46FF_0%,#682A99_82%)]"
            style={{ height: u(102), borderRadius: u(10) }}
          >
            {/* 1295:147719 — the arc under everything. Its opacity and
                soft-light blend are baked into the export. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export */}
            <img
              src={asset("/home/banner-arc-left.svg")}
              alt=""
              aria-hidden
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: u(-24.83), top: u(-55.71), width: u(271.28), height: u(114.84) }}
            />

            {/* 1295:147725 — the shadow the mascot stands on. */}
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-[50%] bg-black/25"
              style={{ left: u(33.74), top: u(88.63), width: u(42.39), height: u(6.06), filter: `blur(${u(3.03)})` }}
            />
            {/* 1295:147726 — the fill is STRETCH under imageTransform
                [[1,0,0],[0,0.6486,0]], i.e. the source's TOP 64.86% stretched
                into the box. So the image is drawn at its full height
                (96.29 / 0.6486 = 148.46) and the box clips the rest. */}
            <span
              aria-hidden
              className="pointer-events-none absolute overflow-hidden"
              style={{ left: u(5), top: u(-12), width: u(98.96), height: u(96.29) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the file's own art */}
              <img
                src={asset("/home/banner-mascot.png")}
                alt=""
                draggable={false}
                className="max-w-none select-none"
                style={{ width: u(98.96), height: u(148.46) }}
              />
            </span>

            {/* 1295:147720 — one text node, two runs. */}
            <p
              className="absolute flex flex-col justify-center"
              style={{ left: u(103.55), top: u(27.76), width: u(329), height: u(44) }}
            >
              <span
                className="font-[family-name:var(--font-heading)] font-bold text-white"
                style={{ fontSize: u(24), lineHeight: u(32.784) }}
              >
                {HEADLINE}
              </span>
              <span className="font-medium text-[#E9CEFF]" style={{ fontSize: u(10), lineHeight: u(14.51) }}>
                {SUBLINE}
              </span>
            </p>

            {/* 1295:147727 — the arc over everything. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- the file's own export */}
            <img
              src={asset("/home/banner-arc-right.svg")}
              alt=""
              aria-hidden
              className="pointer-events-none absolute max-w-none select-none"
              style={{ left: u(211.33), top: u(1.82), width: u(389.36), height: u(164.83) }}
            />

            {/* 1295:147721 — Host Room. */}
            <button
              type="button"
              onClick={open}
              className="ws-press absolute flex items-center justify-center rounded-full bg-white font-bold text-[#682A98] transition-opacity hover:opacity-90"
              style={{
                left: u(458),
                top: u(32),
                width: u(90),
                height: u(38),
                fontSize: u(12.445),
                lineHeight: u(16.593),
                boxShadow: `inset 0 0 0 ${u(2)} rgba(194,160,250,0.55), 0 ${u(6)} ${u(6.2)} rgba(0,0,0,0.25)`,
              }}
            >
              Host Room
            </button>
          </div>

          {/* 1295:147729 — the pager dots, 9 under the banner. */}
          <div
            aria-hidden
            className="flex items-center justify-center"
            style={{ paddingTop: u(9), gap: u(2.708) }}
          >
            {DOTS.map((width, index) => (
              <span
                key={index}
                className={index === 0 ? "bg-[#7E3BEB]" : "bg-[#D9D9D9]"}
                style={{ width: u(width), height: u(4.33), borderRadius: u(13.54) }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
