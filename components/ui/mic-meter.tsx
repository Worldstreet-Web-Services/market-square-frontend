import { cn } from "@/lib/cn";
import { IconCheck } from "@/components/ui/icons";

/**
 * "Your microphone is working", said without words.
 *
 * Lifted out of `green-room.tsx` unchanged when Houses' backstage needed the
 * same thing. It was already exactly right — a 6px track, a silver fill, and
 * `motion-reduce:transition-none` so the width snaps rather than eases under
 * the setting — and the alternative was a second meter that would have drifted
 * from this one within a release.
 */
export function MicMeter({ level, className }: { level: number; className?: string }) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}
      aria-label="Microphone level"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-75 motion-reduce:transition-none"
        style={{ width: `${Math.round(level * 100)}%` }}
      />
    </div>
  );
}

/**
 * One line of a pre-flight checklist.
 *
 * Lifted alongside MicMeter, and for the same reason — both green room and
 * backstage answer the same question ("is this ready?") and both must answer it
 * the same way.
 */
export function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      {/* SILVER, not --color-up. The green room painted this tick with the
          value-delta green, which is a token that means "this number went up"
          and nothing else; a readiness tick is not a value delta, and the app's
          rule is that everything outside the five semantic tokens stays on the
          silver ramp. Corrected in the move rather than copied forward. */}
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full",
          ok ? "bg-accent text-ink" : "border border-white/20 text-grey-600"
        )}
      >
        {ok ? <IconCheck className="h-2.5 w-2.5" /> : null}
      </span>
      <span className={ok ? "text-body" : "text-meta"}>{label}</span>
    </li>
  );
}
