"use client";

import { useState } from "react";
import { TopicPicker } from "@/components/ui/topic-picker";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { askedKeyFor, shouldAskInterests } from "@/lib/interest-onboarding";
import { useMyInterests, useTopics } from "@/features/discovery/hooks/use-discovery";

/**
 * The first thing a new account sees: pick what you want to watch.
 *
 * The picker already existed — behind a control in Explore, which a new reader
 * has no reason to open on their first visit. So the feed they landed on was
 * ranked with nothing to rank by, and the one screen that would have fixed it
 * was the one they had not found yet.
 *
 * Mounted once in the shell beside the username gate, so it opens wherever the
 * reader happens to land rather than only on home. It runs SECOND: the
 * username is the identity everything else hangs off, and two modals stacked
 * on a first visit is an obstacle course, not an onboarding.
 *
 * Asked once. Closing counts as answering — a reader who dismisses it has told
 * us something, and asking again on the next navigation would be nagging.
 */
export function InterestGate() {
  const { authenticated } = useAuth();
  const me = useMe();
  const topics = useTopics();
  const saved = useMyInterests();
  const userId = me.data?.id ?? "";

  const [asked, setAsked] = useState(false);
  const alreadyAsked =
    asked ||
    (typeof window !== "undefined" &&
      userId !== "" &&
      window.localStorage.getItem(askedKeyFor(userId)) === "1");

  const open = shouldAskInterests({
    authenticated,
    usernameUnclaimed: Boolean(me.data?.usernameUnclaimed),
    savedTopics: saved.isSuccess ? saved.data.topics : undefined,
    availableTopics: topics.data?.length ?? 0,
    alreadyAsked,
  });

  if (!open) return null;

  return (
    <TopicPicker
      open
      onClose={() => {
        setAsked(true);
        try {
          if (userId) window.localStorage.setItem(askedKeyFor(userId), "1");
        } catch {
          // Storage denied: the prompt returns next session, which is a far
          // better failure than a first visit that never offers it at all.
        }
      }}
    />
  );
}
