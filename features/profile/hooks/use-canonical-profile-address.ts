"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/api/schemas";

/**
 * ONCE THE PERSON IS KNOWN, THE ADDRESS BAR SAYS WHO THEY ARE NOW.
 *
 * In-app links open a profile by its id (`lib/profile-href.ts`), and an old
 * link may carry a username the person has since changed. Either way the page
 * loads the right person — the service resolves an id, and a released name for
 * its owner — and then this swaps the URL to their CURRENT username, keeping
 * the sub-page (`/following`, `/settings`) and any `#hash`.
 *
 * `replace`, never `push`: the id address was never somewhere the reader chose
 * to be, and Back must not walk them through it.
 *
 * The profile is seeded under the new key BEFORE the swap. The query is keyed
 * on whatever the URL holds, so without this the page would drop to a skeleton
 * for a request whose answer is already on screen.
 */
export function useCanonicalProfileAddress(requested: string, profile: Profile | undefined, subpage?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile) return;
    const current = profile.username;
    if (!current || current === requested) return;
    queryClient.setQueryData(["ms", "profile", current], profile);
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    router.replace(`/u/${current}${subpage ? `/${subpage}` : ""}${hash}`, { scroll: false });
  }, [profile, requested, subpage, router, queryClient]);
}
