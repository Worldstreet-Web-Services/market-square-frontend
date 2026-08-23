import { cn } from "@/lib/cn";

// Deterministic monochrome banner for streams and store items with no
// artwork. Seeded by id so a stream keeps its texture everywhere it appears.
export function GradientThumb({
  seed,
  glyph,
  className,
  style,
  children,
}: {
  seed: string;
  glyph?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const a = 18 + (Math.abs(hash) % 20);
  const x = 20 + (Math.abs(hash >> 3) % 60);
  const y = 20 + (Math.abs(hash >> 6) % 50);
  return (
    <div
      className={cn("relative overflow-hidden bg-grey-900", className)}
      style={{
        background: `radial-gradient(120% 120% at ${x}% ${y}%, rgba(212,212,216,0.${a}) 0%, rgba(20,20,22,1) 70%)`,
        ...style,
      }}
    >
      {glyph && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-4xl text-white/25"
        >
          {glyph}
        </span>
      )}
      {children}
    </div>
  );
}
