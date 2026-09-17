"use client";

import { cn } from "@/lib/cn";
import { ARK_BACK_FALLBACK, arkBackAction } from "@/lib/ark-links";
import { SQUARE_BASE } from "@/lib/square-path";

/**
 * Ark's wordmark — the mobile app's home-tab artwork (tsion
 * `components/home/TabIcons.tsx`, `HomeTabIcon`), the same five paths on the
 * same 40 x 8 box, so the way back reads as Ark on every surface. It takes
 * `currentColor`, as that icon takes a colour.
 */
export function ArkWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 8" fill="currentColor" aria-hidden className={className}>
      <path d="M29.7611 4.63013L28.1143 5.60864L31.4794 7.92366H34.2718L29.7611 4.63013Z" />
      <path d="M24.3435 7.97131V5.41763C27.8566 2.87826 36.2448 0.747808 39.9998 0C33.5463 1.77565 28.1621 4.90848 26.2767 6.25295V7.97131H24.3435Z" />
      <path d="M24.3912 4.82097V0.978516H26.2766V3.77086L24.3912 4.82097Z" />
      <path d="M12.8161 7.9237H14.6299V2.19581H19.3793C19.8934 2.19581 20.3101 2.61254 20.3101 3.12659C20.3101 3.64065 19.8934 4.05738 19.3793 4.05738H15.6562L20.501 7.9237H22.8399L19.3554 5.25069H20.2504C21.4169 5.25069 22.3626 4.30504 22.3626 3.13853V3.07886C22.3626 1.9453 21.4437 1.02637 20.3101 1.02637H12.8161V7.9237Z" />
      <path d="M2.24342 7.92352L5.84722 2.74455L7.99518 5.70396H4.15272L9.02143 7.11207L9.71355 7.92352H11.7422L6.56321 1.05005H4.98804L0 7.92352H2.24342Z" />
    </svg>
  );
}

/** The back chevron the mobile pill draws: 10px, a 3-weight stroke, round ends. */
export function ArkChevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Leave the Square for Ark by the mobile app's rule (`lib/ark-links`): back if Ark is behind us, else Market. */
export function goBackToArk(): void {
  const action = arkBackAction({
    referrer: document.referrer,
    origin: window.location.origin,
    base: SQUARE_BASE,
  });
  if (action === "history" && window.history.length > 1) window.history.back();
  else window.location.assign(ARK_BACK_FALLBACK);
}

/**
 * THE PHONE'S WAY BACK TO ARK — the mobile app's `BackToArk`, to its numbers:
 * a 30-tall pill at a 15 radius with 10 of side padding, a hairline ring, the
 * 10px chevron and Ark's wordmark 6 apart. It is a real link to Ark's Market,
 * so it works with no script and opens in a new tab on a long-press; a plain
 * tap takes the history rule instead.
 */
export function BackToArk({ className }: { className?: string }) {
  return (
    <a
      href={ARK_BACK_FALLBACK}
      aria-label="Back to Ark"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        goBackToArk();
      }}
      className={cn(
        "ws-press flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-2.5 text-white transition-colors hover:bg-white/5",
        className
      )}
    >
      <ArkChevron className="h-2.5 w-2.5" />
      <ArkWordmark className="h-[6.16px] w-[30.8px]" />
    </a>
  );
}
