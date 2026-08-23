"use client";

import { useEffect, useRef } from "react";

// Calls onReach when the sentinel div scrolls into view. Attach the returned
// ref to an element below the list.
export function useInfiniteScroll(onReach: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onReach);

  useEffect(() => {
    callback.current = onReach;
  }, [onReach]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}
