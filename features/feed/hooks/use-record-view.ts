"use client";

import { useEffect, useRef } from "react";
import { msApi } from "@/lib/api/service";

/**
 * A view is recorded when a post is actually WATCHED, not when it mounts.
 *
 * Mounting is not watching. A feed prefetches and renders cards above and
 * below the fold, and counting those would make the number mean "how many
 * cards the client drew", which is not a number anybody wants. So a view needs
 * the card to be genuinely on screen, and to stay there.
 *
 * The dwell threshold is what separates reading from scrolling past. A card
 * that flashes by during a fast flick was not watched, and counting it inflates
 * every author's numbers equally, which is the same as counting nothing.
 */
const VISIBLE_FRACTION = 0.5;
const DWELL_MS = 1000;

/**
 * Posts this browser tab has already reported.
 *
 * The service deduplicates per viewer and is the authority, so this is purely
 * about not firing an obviously pointless request every time a card scrolls
 * back into view. It is per-tab and deliberately not persisted: it is an
 * optimisation, not a correctness mechanism, and treating it as the latter is
 * how a client ends up "remembering" a view the server never recorded.
 */
const reported = new Set<string>();

/**
 * Report one view, once per tab. The dwell observer below calls it for a
 * post; a CLIP calls it the moment it actually starts playing, so a video's
 * number means "how many played it" and not "how many scrolled past it".
 * The service still deduplicates per viewer.
 */
export function reportView(postId: string) {
  if (reported.has(postId)) return;
  // Optimistic: mark before the request, so a slow network cannot let it
  // fire twice for one card.
  reported.add(postId);
  // A failed view is not worth telling anybody about. It is not an action
  // they took, there is nothing for them to retry, and an error toast for a
  // number they did not ask about is noise. It also must never reject
  // unhandled.
  void msApi.post(`/posts/${postId}/views`, {}).catch(() => {
    // Let it be retried if the card comes back.
    reported.delete(postId);
  });
}

/**
 * `enabled` is false for a clip: its view is the play, reported by the
 * player through `reportView`, and a clip that autoplayed muted for a second
 * while the reader scrolled past is not a play.
 */
export function useRecordView(postId: string, enabled = true) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || reported.has(postId)) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => reportView(postId), DWELL_MS);
        } else if (timer) {
          // Left before the dwell elapsed: scrolled past, not watched.
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: VISIBLE_FRACTION }
    );

    observer.observe(node);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [postId, enabled]);

  return ref;
}
