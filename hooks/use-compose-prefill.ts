"use client";

import { useQueryParam } from "@/hooks/use-query-param";
import { parseComposePrefill, type ComposePrefill } from "@/lib/compose-prefill";

/**
 * Reads the cross-product share contract off the URL.
 *
 * Mobile home and the desktop timeline both open the composer from
 * `?compose=1`, so both read the draft through this — one parse, one set of
 * rules. Two readers is how a validated parameter becomes an unvalidated one
 * on the surface nobody remembered to update.
 */
export function useComposePrefill(): ComposePrefill {
  const link = useQueryParam("link");
  const label = useQueryParam("label");
  const text = useQueryParam("text");
  return parseComposePrefill({ link, label, text });
}
