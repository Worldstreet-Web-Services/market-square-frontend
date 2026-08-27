/* eslint-disable @next/next/no-img-element -- a fixed local asset, not remote media */

/**
 * The KASH coin, as the designer drew it.
 *
 * Replaces a generic outlined-circle glyph that read as a mathematical symbol
 * rather than as money. On a screen asking somebody to part with an amount,
 * the mark should be the currency they are actually sending.
 *
 * NOTE: the artwork on disk is the platform's Kash+ coin, the only coin asset
 * that exists today. Tips are denominated in plain KASH, so if the tiers need
 * to be told apart visually, this wants a plain-KASH coin from the designer —
 * swapping the file is the whole change.
 */
export function KashCoin({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/kash/kash-coin.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      decoding="async"
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
