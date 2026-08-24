import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The Market Square identity, in one place.
 *
 * The brand wordmark is a bespoke lockup (~12.8:1) — it is never redrawn in
 * markup. Point `WORDMARK_SRC` at the real asset once it is in `public/` and
 * every surface below picks it up; until then these render the type lockup.
 *
 * Two shapes, because the wordmark cannot serve both:
 *  - `Wordmark`  — full lockup, for anywhere with real horizontal room.
 *  - `LogoMark`  — the square monogram, for the 68px collapsed icon rail
 *                  where the wordmark would land about 5px tall.
 */
const WORDMARK_SRC: string | null = null;
const MARK_SRC: string | null = null;

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  if (MARK_SRC) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- brand asset, fixed dimensions
      <img
        src={MARK_SRC}
        alt=""
        width={size}
        height={size}
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
