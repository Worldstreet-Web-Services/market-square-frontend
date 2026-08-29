"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { useCircuit } from "@/lib/api/circuit-store";
import { retryCircuitNow } from "@/lib/api/circuit-store";

/**
 * One honest sentence when the backend is unreachable.
 *
 * The alternative — which is what the app did — is every module discovering
 * the outage separately and each drawing its own red card: the feed, the
 * rails, the badges, the chat. Forty copies of one fact is not feedback, it is
 * noise, and it reads as "the app is broken" rather than "the server is
 * unreachable, we are already handling it".
 *
 * So: the modules keep whatever they have and go quiet, and this speaks for
 * all of them, once. It says three things a reader actually needs — what is
 * wrong, that we are retrying without them, and when — plus a way to force it
 * NOW, because someone who has just fixed their wifi should not have to wait
 * out a cooldown that exists for a different reason.
 *
 * It appears only when the circuit is OPEN, never on a single failed request:
 * a banner that flickers on every dropped packet trains people to ignore it,
 * which is worse than not having one.
 */
export function ConnectionBanner() {
  const circuit = useCircuit();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const down = circuit.state !== "closed";

  // A countdown only ticks while there is one to show. No interval runs in the
  // normal case, which is the whole point of a component about restraint.
  useEffect(() => {
    if (!down) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [down]);

  if (!down) return null;

  const seconds = Math.max(0, Math.ceil((circuit.retryAt - now) / 1000));
  const probing = circuit.state === "half-open" || seconds === 0;

  return (
    <div
      // `polite`, not `alert`: this is a status, and a screen reader should
      // finish the sentence it is on before hearing it.
      role="status"
      aria-live="polite"
      className={cn(
        "ws-glass fixed left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/12 px-4 py-2.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]",
        // Above the phone's tab bar, and out of the desktop corner where the
        // create button lives.
        "bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] md:bottom-6"
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full",
            probing ? "ws-live-dot bg-accent" : "bg-down"
          )}
        />
      </span>
      <p className="text-[13px] leading-4 text-body">
        {probing ? (
          "Reconnecting…"
        ) : (
          <>
            <span className="font-semibold text-heading">Can&apos;t reach Market Square.</span>{" "}
            <span className="tnum text-meta">Retrying in {seconds}s</span>
          </>
        )}
      </p>
      <button
        onClick={() => {
          // Forcing it is a real action, so it does both halves: drop the
          // cooldown, then actually re-ask. Without the refetch the reader
          // would press a button and watch nothing happen until the next poll.
          retryCircuitNow();
          void queryClient.refetchQueries({ type: "active" });
        }}
        className="ws-press shrink-0 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold text-heading transition-colors hover:bg-white/[0.16]"
      >
        Try now
      </button>
    </div>
  );
}
