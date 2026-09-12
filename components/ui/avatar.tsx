import Image from "next/image";

import { artworkForSeed, initialsOf, resolveSeed } from "@/lib/avatar-seed";
import { cn } from "@/lib/cn";

/**
 * Avatar with a deterministically seeded default.
 *
 * Three tiers, in order:
 *   1. `src` — the user's own upload. Always wins.
 *   2. Seeded artwork — one of the nine ARK mascots in `public/avatar/`,
 *      picked by a stable hash of `seed`.
 *   3. Initials — only when nothing identifies this row at all.
 *
 * `seed` must be a STABLE identifier (the Privy DID `profile.id`, falling back
 * to `username`). It deliberately is not the display name: seeding on a name
 * re-rolled a person's avatar every time they renamed themselves, and collided
 * every unnamed member onto one image, because the schema turns a null name
 * into the formulaic "Member ·A1B2". See lib/avatar-seed.ts.
 */
/**
 * A PICTURE IS A ROUNDED SQUARE, NEVER A CIRCLE — ogazboiz, 2026-09-12:
 * "we are using Square, so anything that is a circle image, make it like
 * the way our avatar is, just like a square shape" — after seeing every
 * face in search come up as a disc. The shape is the house plate's
 * (1381:37629 / 1373:3990: 12.32 on 49.89, i.e. a quarter of the side), so
 * a 24 face rounds at 6 and a 88 one at 22, and every surface that used to
 * clip this to `rounded-full` — rings, plates, the faces stacked on a house
 * card — now takes the same quarter. The file's own nodes still draw some
 * of these as discs; the product decision overrides them, on purpose.
 */
export function Avatar({
  name,
  seed,
  src,
  size = 40,
  sizeClassName,
  className,
  ring = false,
}: {
  name: string;
  /** Stable identity — `profile.id` (Privy DID), else `username`. */
  seed?: string | null;
  src?: string | null;
  size?: number;
  /**
   * Sizing by CLASS instead of the inline `width`/`height`, for the one case
   * `size` cannot express: an avatar that changes size at a breakpoint. Inline
   * styles beat utilities, so a responsive class on `className` alone would
   * never win — this replaces the inline pair rather than fighting it. `size`
   * is still required and still feeds the intrinsic dimensions and the
   * initials' font size; pass the larger of the two.
   */
  sizeClassName?: string;
  className?: string;
  ring?: boolean;
}) {
  const style = sizeClassName ? undefined : { width: size, height: size };
  const ringClass = ring ? "ring-2 ring-accent/70 ring-offset-2 ring-offset-black" : "";

  // The display name is the last resort, so a caller with no id still gets a
  // consistent avatar rather than falling all the way through to initials.
  const resolved = resolveSeed({ id: seed, name });

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar hosts are unknown at build time
      <img
        src={src}
        alt={name}
        style={style}
        className={cn("shrink-0 rounded-[25%] object-cover", sizeClassName, ringClass, className)}
      />
    );
  }

  const artwork = artworkForSeed(resolved);
  if (artwork) {
    return (
      <Image
        src={artwork}
        // Decorative: the artwork carries no identity of its own, and the
        // author's name is always rendered in the adjacent text.
        alt=""
        aria-hidden
        width={size}
        height={size}
        style={style}
        className={cn("shrink-0 rounded-[25%] object-cover", sizeClassName, ringClass, className)}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-[25%] border border-white/10 bg-grey-700 text-grey-200",
        sizeClassName,
        ringClass,
        className
      )}
      aria-hidden
    >
      <span style={{ fontSize: Math.max(10, size * 0.36) }} className="font-semibold">
        {initialsOf(name)}
      </span>
    </div>
  );
}
