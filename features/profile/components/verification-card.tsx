"use client";

import { formatKash } from "@/lib/format";
import { Pill, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMyVerification,
  useRequestVerification,
  useVerificationRule,
} from "@/features/profile/hooks/use-profile";

// Shown only on the owner's profile: the eligibility rule, current status,
// and the request action. Backend shapes: rule = { eligibility, paid,
// economics }, mine = { current, latestRequest }.
export function VerificationCard() {
  const rule = useVerificationRule();
  const mine = useMyVerification();
  const request = useRequestVerification();

  if (rule.isPending || mine.isPending) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }
  if (rule.isError || mine.isError) return null;

  const current = mine.data.current;
  const pending = current === "pending" || mine.data.latestRequest?.status === "pending";
  const verified = current === "earned" || current === "paid";
  const { minFollowers, minParticipationScore } = rule.data.eligibility;

  return (
    <div className="ws-card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <VerifiedBadge verification="earned" />
        <h2 className="ws-display text-base">Verification</h2>
        {verified && <Pill tone="accent">Verified</Pill>}
        {pending && !verified && <Pill>Request pending</Pill>}
      </div>
      {!verified && !pending && (
        <>
          <p className="text-sm text-grey-400">
            Earned verification needs at least {minFollowers} followers and a participation score of{" "}
            {minParticipationScore}. Post, stream and host to qualify.
          </p>
          <Button size="sm" loading={request.isPending} onClick={() => request.mutate()}>
            Request verification
          </Button>
        </>
      )}
      {pending && !verified && (
        <p className="text-sm text-grey-400">
          Your request is in review. You&apos;ll see the badge here the moment it&apos;s approved.
        </p>
      )}
      {verified && (
        <p className="text-sm text-grey-400">Your account carries the silver check everywhere on the square.</p>
      )}
      {rule.data.paid && (
        <div className="ws-inset flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Supporter badge</p>
            <p className="text-xs text-grey-500">{formatKash(rule.data.paid.priceKash)}</p>
          </div>
          {/* economics: "proposed" — not purchasable yet, rendered honestly. */}
          {rule.data.economics === "proposed" && <Pill>Coming soon</Pill>}
        </div>
      )}
    </div>
  );
}
