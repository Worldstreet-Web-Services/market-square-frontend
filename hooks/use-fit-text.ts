"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useFitText<T extends HTMLElement>(
  text: string,
  initialScale = 1,
) {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(initialScale);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentWidth = parent.clientWidth;
    if (parentWidth <= 0) return;
    // Reset to 1 to measure natural width
    el.style.transform = "scaleX(1)";
    const naturalWidth = el.scrollWidth;
    el.style.transform = "";
    if (naturalWidth <= 0) return;
    setScale(Math.min(1, parentWidth / naturalWidth));
  }, []);

  useEffect(() => {
    measure();
  }, [text, measure]);

  return { ref, scale };
}
