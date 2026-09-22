"use client";

import { useCallback, useRef, useState } from "react";

/**
 * The room's one polite live region.
 *
 * ONE, not several. Multiple live regions on a page interleave unpredictably —
 * the order a screen reader speaks them in is not the order they changed — and
 * an audio product used by somebody who cannot hear it has to be legible in
 * exactly the sequence things happened.
 *
 * POLITE, always. `aria-live="assertive"` interrupts whatever is being read,
 * and MDN reserves it for time-critical notification. Nothing in a house is
 * that: a seat opening, a hand going up and a reconnect are all ambient facts,
 * and interrupting somebody mid-sentence to announce one is the accessibility
 * equivalent of a pop-up.
 *
 * What is announced, and what is deliberately not, is listed at the call site
 * in house-room.tsx. The one rule enforced here: joins and leaves never reach
 * this hook at all.
 */
export function useHouseAnnouncer() {
  const [message, setMessage] = useState("");
  const last = useRef("");
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((text: string) => {
    if (!text || text === last.current) return;
    last.current = text;
    setMessage(text);
    // Cleared after a beat so the SAME sentence can be announced again later —
    // "Reconnecting" twice in a session is two real events, and a region whose
    // text never changes is a region that never fires.
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => {
      last.current = "";
      setMessage("");
    }, 4_000);
  }, []);

  return { message, announce };
}
