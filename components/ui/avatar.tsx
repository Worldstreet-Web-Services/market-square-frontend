import { cn } from "@/lib/cn";

// Monochrome initial avatars. Deterministic grey tone per name so a person
// keeps their shade everywhere; no external image dependency in fixture mode.

function toneOf(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const tones = [
    "linear-gradient(135deg,#3c3c3c,#1c1c1c)",
    "linear-gradient(135deg,#5a5a5a,#2a2a2a)",
    "linear-gradient(135deg,#4a4a52,#202024)",
    "linear-gradient(135deg,#2e2e34,#141416)",
    "linear-gradient(135deg,#52524a,#232320)",
  ];
  return tones[Math.abs(hash) % tones.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function Avatar({
  name,
  src,
  size = 40,
  className,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const style = { width: size, height: size };
  const ringClass = ring ? "ring-2 ring-accent/70 ring-offset-2 ring-offset-black" : "";
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
  return (
    <div
      style={{ ...style, background: toneOf(name) }}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full border border-white/10 text-grey-200",
        ringClass,
        className
      )}
      aria-hidden
    >
      <span style={{ fontSize: Math.max(10, size * 0.36) }} className="font-semibold">
        {initials(name)}
      </span>
    </div>
  );
}
