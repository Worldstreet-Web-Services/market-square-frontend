import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The Market Square identity, in one place.
 *
 * The brand lockup is bespoke artwork — it is never redrawn in markup. Both
 * shapes come from one source file so they can never drift apart:
 *  - `Wordmark`  — the full lockup (mark + type, 148x45), for anywhere with
 *                  real horizontal room.
 *  - `LogoMark`  — the mark alone (60x45), cut from the same artwork, for the
 *                  collapsed icon rail where the type would be illegible.
 *
 * Both are SVG, so they stay crisp at any size and on any DPR. Neither is a
 * square: the mark is ~4:3, so it is sized by HEIGHT and left to find its own
 * width. Forcing width === height would squash the artwork.
 */
// The lockup carries its own purple (the spotlight stop) and white type, so it
// needs a dark ground — every surface using it has one.
const WORDMARK_SRC: string | null = "/logo.svg";
// The mark alone, cut from the same file rather than drawn twice.
const MARK_SRC: string | null = "/logo-mark.svg";
// Intrinsic ratios, so a caller can size either by height alone.
const MARK_RATIO = 60 / 45;

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  if (MARK_SRC) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- brand asset, intrinsic ratio
      <img
        src={MARK_SRC}
        alt=""
        height={size}
        width={Math.round(size * MARK_RATIO)}
        className={cn("shrink-0", className)}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className={cn(
        "ws-display flex shrink-0 items-center justify-center rounded-xl bg-accent text-ink",
        className
      )}
      aria-hidden
    >
      M
    </span>
  );
}

export function Wordmark({ height = 18, className }: { height?: number; className?: string }) {
  if (WORDMARK_SRC) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- brand asset, intrinsic ratio
      <img
        src={WORDMARK_SRC}
        alt="Market Square"
        style={{ height }}
        className={cn("w-auto max-w-full", className)}
      />
    );
  }
  return (
    <span className={cn("ws-display whitespace-nowrap", className)} style={{ fontSize: height }}>
      Market <span className="text-accent">Square</span>
    </span>
  );
}

/** Home link wearing the mark, the wordmark, or both. */
export function BrandLink({
  variant = "lockup",
  href = "/",
  className,
  markSize,
  wordmarkHeight,
  label = "Market Square home",
}: {
  variant?: "mark" | "wordmark" | "lockup";
  href?: string;
  className?: string;
  markSize?: number;
  wordmarkHeight?: number;
  label?: string;
}) {
  return (
    <Link href={href} aria-label={label} title="Market Square" className={cn("ws-press", className)}>
      {variant !== "wordmark" && <LogoMark size={markSize} />}
      {variant !== "mark" && <Wordmark height={wordmarkHeight} />}
    </Link>
  );
}
