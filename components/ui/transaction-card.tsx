"use client";

import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";

/**
 * THE TRANSACTION RECEIPT CARD — node 1707:17296 / 1669:18450.
 *
 * A shareable "your transaction succeeded" card for a post that carries a
 * transaction: a starry sky, a green verified seal rising from clouds, the
 * amount in large type, and an optional sender foot (handle, wallet, time).
 *
 * ─── DATA-DRIVEN, ONE COMPONENT FOR EVERY VARIANT ────────────────────────────
 * The design has several wordings — a funded wallet, a withdrawal, a buy, a
 * sell — and they are the SAME card with different copy. `variant` picks the
 * preset title + line; `title`/`description` override it for anything bespoke.
 * The caller decides which based on the post, so the post chooses the design.
 *
 * ─── THE ARTWORK IS DRAWN IN CODE ────────────────────────────────────────────
 * The sky (gradient + rays + stars), the green seal, the clouds, the wordmark
 * and the perforated foot are all CSS/SVG here — self-contained, CSP-safe, and
 * visible with no exported assets. It is a faithful build of the file rather
 * than the exact exported illustration; swap in Figma exports later for the
 * last of the pixels.
 *
 * ─── SCALES AS ONE PIECE ─────────────────────────────────────────────────────
 * The file is 742 x 666. Every size is `cqw` off the card's own width and every
 * position a percentage, so it is faithful at any width with no breakpoints.
 *
 * ─── THE ANIMATION (2s, once) ────────────────────────────────────────────────
 * The seal springs in (scale + fade), the amount/title ease up, the sparkles
 * twinkle. Rendered once on mount (a receipt should not pulse forever) and
 * disabled under `prefers-reduced-motion` by motion itself.
 */
export type TransactionVariant =
  | "withdrawal"
  | "deposit"
  | "funded"
  | "buy"
  | "sold"
  | "received";

const VARIANT_COPY: Record<TransactionVariant, { title: string; description: string }> = {
  withdrawal: {
    title: "Your Withdrawal was Successful",
    description: "You'll get an email confirming your withdrawal was successful and sent to your account.",
  },
  deposit: {
    title: "Your Deposit was Successful",
    description: "The funds have landed in your wallet.",
  },
  funded: {
    title: "Your wallet has been funded successfully.",
    description: "Your market buy order has been filled instantly.",
  },
  buy: {
    title: "Your Buy Order was Successful",
    description: "Your market buy order has been filled instantly.",
  },
  sold: {
    title: "Your Sell Order was Successful",
    description: "Your market sell order has been filled instantly.",
  },
  received: {
    title: "You Received a Payment",
    description: "The funds have landed in your wallet.",
  },
};

export interface TransactionCardProps {
  /** Picks the preset copy. Overridden by `title` / `description` when given. */
  variant?: TransactionVariant;
  /** The line above the amount. Falls back to the variant's title. */
  title?: string;
  /** The line under the amount. Falls back to the variant's description. */
  description?: string;
  /** The amount, ALREADY grouped for display (e.g. "5,000,000"). Omitted -> no hero line. */
  amount?: string;
  /** The currency mark, e.g. "N" / "$" (fiat) or "SOL" / "USDC" (token). */
  currency?: string;
  /** Fiat reads as a PREFIX ("N5,000,000"); a token as a SUFFIX ("5.24 SOL"). */
  currencyPosition?: "prefix" | "suffix";
  /** The sender's handle, with the leading @. When absent the foot is not drawn. */
  handle?: string;
  avatarUrl?: string | null;
  avatarSeed?: string;
  /** The shortened wallet, e.g. "0x7f6a...8bdc". */
  wallet?: string;
  /** The stamp, preformatted by the caller. */
  timestamp?: string;
  className?: string;
}

/** A 10-lobe scalloped verified seal with a check — the file's green ramp. */
function Seal() {
  const bumps = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return { cx: 50 + 33 * Math.cos(a), cy: 50 + 33 * Math.sin(a) };
  });
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))" }}>
      <defs>
        <radialGradient id="tx-seal" cx="34%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#83ddab" />
          <stop offset="55%" stopColor="#40bf82" />
          <stop offset="100%" stopColor="#1ea66e" />
        </radialGradient>
      </defs>
      <g fill="url(#tx-seal)">
        {bumps.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r="13.5" />
        ))}
        <circle cx="50" cy="50" r="34" />
      </g>
      <path
        d="M37 51 l9.5 9.5 l17.5 -20.5"
        fill="none"
        stroke="#141414"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A soft cloud made of overlapping discs, filled by the caller. */
function Cloud({ className, fill = "#d6d4cf" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden>
      <g fill={fill}>
        <circle cx="30" cy="38" r="22" />
        <circle cx="58" cy="30" r="28" />
        <circle cx="88" cy="40" r="20" />
        <rect x="26" y="40" width="66" height="20" />
      </g>
    </svg>
  );
}

export function TransactionCard({
  variant = "funded",
  title,
  description,
  amount,
  currency = "",
  currencyPosition = "prefix",
  handle,
  avatarUrl,
  avatarSeed,
  wallet,
  timestamp,
  className,
}: TransactionCardProps) {
  const copy = VARIANT_COPY[variant];
  const heading = title ?? copy.title;
  const sub = description ?? copy.description;

  return (
    <div
      className={`@container relative w-full overflow-hidden rounded-[17px] bg-[#161616] ${className ?? ""}`}
    >
      <div className="relative aspect-742/666 w-full">
        {/* ── SKY (top) — gradient + rays + stars ─────────────────────────── */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-black" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "repeating-conic-gradient(from 90deg at 50% 34%, rgba(255,255,255,0.035) 0deg 2.5deg, transparent 2.5deg 9deg)",
          }}
        />
        {/* stars + twinkling sparkles */}
        <svg viewBox="0 0 742 666" className="absolute inset-0 h-full w-full" aria-hidden>
          {[
            [120, 210], [200, 70], [275, 150], [330, 60], [510, 120], [640, 250], [90, 300], [610, 90], [700, 180],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.6} fill="rgba(255,255,255,0.55)" />
          ))}
          {[
            [255, 168], [520, 80], [640, 195], [190, 66],
          ].map(([x, y], i) => (
            <motion.path
              key={`s${i}`}
              d={`M${x} ${y - 9} C ${x + 1.5} ${y - 1.5} ${x + 1.5} ${y - 1.5} ${x + 9} ${y} C ${x + 1.5} ${y + 1.5} ${x + 1.5} ${y + 1.5} ${x} ${y + 9} C ${x - 1.5} ${y + 1.5} ${x - 1.5} ${y + 1.5} ${x - 9} ${y} C ${x - 1.5} ${y - 1.5} ${x - 1.5} ${y - 1.5} ${x} ${y - 9} Z`}
              fill="#ffffff"
              initial={{ opacity: 0.3 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </svg>

        {/* MARKET wordmark */}
        <div className="absolute left-1/2 top-[6%] -translate-x-1/2 text-center">
          <p className="font-black leading-none tracking-[0.15cqw] text-[3.6cqw] text-transparent [-webkit-text-stroke:0.15cqw_rgba(255,255,255,0.35)]" style={{ WebkitTextStroke: "0.12cqw rgba(210,210,210,0.5)" }}>
            <span className="bg-gradient-to-b from-[#c9c9c9] to-[#6f6f6f] bg-clip-text text-[#c9c9c9]">MAR</span>KET
          </p>
        </div>

        {/* small sky clouds */}
        <Cloud className="absolute left-[-2%] top-[9%] w-[16%]" fill="#dedcd7" />
        <Cloud className="absolute right-[-1%] top-[11%] w-[15%]" fill="#dedcd7" />

        {/* ── SEAL (springs in), rising from the clouds ───────────────────── */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 520, damping: 24, delay: 0.05 }}
          className="absolute left-1/2 top-[17%] w-[24%] -translate-x-1/2"
        >
          <Seal />
        </motion.div>

        {/* ── FRONT CLOUD BANK — light, covers the bottom, over the seal ──── */}
        <svg
          viewBox="0 0 742 340"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-[56%] w-full"
          aria-hidden
        >
          <g fill="#d6d4cf">
            <rect x="0" y="120" width="742" height="220" />
            {[
              [40, 130, 78], [150, 118, 92], [280, 128, 84], [400, 116, 96], [520, 126, 82], [630, 120, 90], [720, 130, 74],
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} />
            ))}
          </g>
        </svg>

        {/* ── TEXT (over the clouds) ──────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="absolute left-1/2 top-[55.4%] w-[86%] -translate-x-1/2 text-center font-semibold leading-tight text-[#5a5a5a] text-[2.4cqw]"
        >
          {heading}
        </motion.p>

        {amount && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.4 }}
            className="tnum absolute left-1/2 top-[60.5%] -translate-x-1/2 whitespace-nowrap text-center font-black leading-none tracking-[-0.4cqw] text-[#1b1b1b] text-[11.93cqw]"
          >
            {currencyPosition === "prefix" ? `${currency}${amount}` : `${amount}${currency ? ` ${currency}` : ""}`}
          </motion.p>
        )}

        {sub && (
          <p className="absolute left-1/2 top-[79%] w-[60%] -translate-x-1/2 text-center font-semibold leading-[1.25] text-[#5a5a5a] text-[1.75cqw]">
            {sub}
          </p>
        )}

        {/* ── FOOT (optional): handle + wallet + time ─────────────────────── */}
        {handle && (
          <div className="absolute left-[8.2%] top-[86%] flex items-center gap-[0.6cqw]">
            <span className="flex aspect-square w-[3cqw] items-center justify-center overflow-hidden rounded-full bg-[#ffe178]">
              <Avatar name={handle} seed={avatarSeed ?? handle} src={avatarUrl} size={22} sizeClassName="h-full w-full" className="rounded-none border-0" />
            </span>
            <span className="whitespace-nowrap font-semibold leading-none text-black text-[1.6cqw]">{handle}</span>
          </div>
        )}
        {wallet && (
          <span className="absolute left-[8.2%] top-[90.5%] whitespace-nowrap font-semibold leading-none text-[#9b9b9b] text-[1.75cqw]">
            {wallet}
          </span>
        )}
        {timestamp && (
          <span className="absolute right-[8.5%] top-[90.5%] whitespace-nowrap leading-none text-[#666] text-[1.62cqw]">
            {timestamp}
          </span>
        )}

        {/* ── PERFORATED FOOT — the dashed rule + the ticket notches ───────── */}
        <div className="absolute inset-x-[9%] bottom-[7.5%] border-t border-dashed border-black/25" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 flex justify-between px-[2%]">
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} className="aspect-square w-[7cqw] translate-y-1/2 rounded-full bg-[#161616]" />
          ))}
        </div>
      </div>
    </div>
  );
}
