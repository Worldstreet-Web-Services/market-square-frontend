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
export function Avatar({
  name,
  seed,
  src,
  size = 40,
  className,
  ring = false,
}: {
  name: string;
  /** Stable identity — `profile.id` (Privy DID), else `username`. */
  seed?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const style = { width: size, height: size };
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
        className={cn("shrink-0 rounded-full object-cover", ringClass, className)}
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
        className={cn("shrink-0 rounded-full object-cover", ringClass, className)}
      />
    );
  }

  return (
    <div
      style={style}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full border border-white/10 bg-grey-700 text-grey-200",
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
