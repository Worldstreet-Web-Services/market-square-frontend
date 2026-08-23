"use client";

import { useState } from "react";
import Link from "next/link";
import { errorCode } from "@/lib/api/envelope";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/states";
import { useApplyCreator, useCreatorApplication } from "@/features/profile/hooks/use-profile";
import type { ProfileRole } from "@/lib/api/schemas";

// Own-profile card: citizens and ambassadors apply to become creators;
// creators see the chip and a way into the Studio. Anchored (#creator) so the
// Studio empty-state can deep-link straight here.
export function CreatorCard({ role }: { role: ProfileRole }) {
  const application = useCreatorApplication();
  const apply = useApplyCreator();
  const [note, setNote] = useState("");

  if (role === "worldstreet") return null;

  if (role === "creator") {
    return (
      <div id="creator" className="ws-card flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Pill tone="accent">Creator</Pill>
          <p className="text-sm text-grey-400">You can host streams and schedule sessions.</p>
        </div>
        <Link
          href="/studio"
          className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-white"
        >
          Open Studio
        </Link>
      </div>
    );
  }

  if (application.isPending) {
    return (
      <div id="creator">
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  const pending =
    application.data?.status === "pending" || errorCode(apply.error) === "CONFLICT";

  return (
    <div id="creator" className="ws-card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <h2 className="ws-display text-base">Become a creator</h2>
        {pending && <Pill>Application pending review</Pill>}
      </div>
      {pending ? (
        <p className="text-sm text-grey-400">
          Your application is in review. You&apos;ll be able to open the Studio the moment it&apos;s
          approved.
        </p>
      ) : (
        <>
          <p className="text-sm text-grey-400">
            Creators host live streams, sell tickets in KASH, and schedule sessions on the square.
            Tell us what you&apos;d bring.
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="What will you stream? (optional)"
            className="ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600"
          />
          {apply.isError && errorCode(apply.error) !== "CONFLICT" && (
            <InlineError error={apply.error} fallback="Couldn't send the application." />
          )}
          <Button
            size="sm"
            loading={apply.isPending}
            onClick={() => apply.mutate(note.trim() || undefined)}
          >
            Apply to be a creator
          </Button>
        </>
      )}
    </div>
  );
}
