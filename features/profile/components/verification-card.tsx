"use client";

import { errorCode, errorMessage } from "@/lib/api/envelope";
import { formatDate, formatKash } from "@/lib/format";
import { Pill, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMyVerification,
  useRenewVerification,
  useVerificationRule,
} from "@/features/profile/hooks/use-profile";

/**
 * The owner's verification card.
 *
 * Market Square GRANTS verification — nobody applies for it and nobody buys
 * in. Month one is free; after that a recurring KASH payment keeps the badge
 * current. Letting it lapse pauses the check without touching the grant, so
 * paying restores it instantly with no re-approval.
 *
 * Everything here is billing state, which exists only on `/me/verification`.
 * This card renders on the owner's own profile and nowhere else.
 */

/** Renewal errors belong beside the button that caused them, never as a code. */
function renewalError(error: unknown): string {
  if (errorCode(error) === "PAYMENT_FAILED") {
    return "Not enough KASH to renew — top up and try again.";
  }
  return errorMessage(error, "Couldn't renew right now — try again shortly.");
}

/** The renewal action plus whatever went wrong last time, inline beneath it. */
function RenewAction({
  label,
  canRenew,
  pending,
  error,
  onRenew,
}: {
  label: string;
  canRenew: boolean;
  pending: boolean;
  error: unknown;
  onRenew: () => void;
}) {
  return (
    <div className="space-y-2">
      <Button size="sm" loading={pending} disabled={!canRenew} onClick={onRenew}>
        {label}
      </Button>
      {Boolean(error) && <p className="text-xs text-down">{renewalError(error)}</p>}
      {!canRenew && !error && (
        <p className="text-xs text-grey-500">Renewal isn&apos;t available on this account yet.</p>
      )}
    </div>
  );
}

function Shell({ children, tone }: { children: React.ReactNode; tone?: "featured" }) {
  return (
    <div className={tone === "featured" ? "ws-featured space-y-3 p-5" : "ws-card space-y-3 p-5"}>
      {children}
    </div>
  );
}

export function VerificationCard() {
  const rule = useVerificationRule();
  const mine = useMyVerification();
  const renew = useRenewVerification();

  if (mine.isPending) return <Skeleton className="h-28 w-full rounded-2xl" />;
  if (mine.isError) return null;

  const {
    status,
    verifiedSince,
    daysRemaining,
    priceKash,
    periodDays,
    trialDays,
    canRenew,
    latestRequest,
  } = mine.data;

  // A legacy request still in review keeps its old surface.
  const pending = status === "pending" || latestRequest?.status === "pending";
  const price = formatKash(priceKash);

  // ---- lapsed: paused, not punished. The grant is intact. ----
  if (status === "lapsed") {
    return (
      <Shell tone="featured">
        <div className="flex items-center gap-2">
          <h2 className="ws-display text-base">Your badge is paused</h2>
          <Pill tone="featured">Paused</Pill>
        </div>
        <p className="text-sm text-grey-400">
          Your verification is still yours — the check is just hidden while the subscription is
          unpaid. Restoring it is instant and needs no re-approval.
          {verifiedSince && ` Verified since ${formatDate(verifiedSince)}.`}
        </p>
        <RenewAction
          label={`Restore for ${price}`}
          canRenew={canRenew}
          pending={renew.isPending}
          error={renew.isError ? renew.error : null}
          onRenew={() => renew.mutate()}
        />
      </Shell>
    );
  }

  // ---- verified: show the check plus where the subscription stands. ----
  if (status === "verified") {
    const onTrial = Boolean(daysRemaining !== null && verifiedSince && trialDays > 0 && !mine.data.paidThrough);
    return (
      <Shell>
        <div className="flex items-center gap-2">
          <VerifiedBadge verification="verified" />
          <h2 className="ws-display text-base">Verified</h2>
          <Pill tone="accent">Active</Pill>
        </div>
        {verifiedSince && (
          <p className="text-sm text-grey-400">Verified since {formatDate(verifiedSince)}.</p>
        )}

        <div className="ws-inset px-4 py-3">
          {daysRemaining === null ? (
            <p className="text-sm text-grey-400">
              Your badge is active. Renewal details appear here once the first period starts.
            </p>
          ) : onTrial ? (
            <p className="text-sm text-white">
              <span className="tnum font-semibold">{daysRemaining} days</span> left in your free
              month, then {price} every {periodDays} days.
            </p>
          ) : (
            <p className="text-sm text-white">
              Next payment in <span className="tnum font-semibold">{daysRemaining} days</span> —{" "}
              {price} every {periodDays} days.
            </p>
          )}
          <p className="mt-1 text-xs text-grey-500">
            Renewing early adds to your balance rather than resetting it.
          </p>
        </div>

        <RenewAction
          label={`Renew now · ${price}`}
          canRenew={canRenew}
          pending={renew.isPending}
          error={renew.isError ? renew.error : null}
          onRenew={() => renew.mutate()}
        />
      </Shell>
    );
  }

  // ---- pending: a legacy request still in review. ----
  if (pending) {
    return (
      <Shell>
        <div className="flex items-center gap-2">
          <h2 className="ws-display text-base">Verification</h2>
          <Pill>In review</Pill>
        </div>
        <p className="text-sm text-grey-400">
          Your request is in review. You&apos;ll see the badge here the moment it&apos;s approved.
        </p>
      </Shell>
    );
  }

  // ---- none: granted, never requested. No call to action. ----
  const eligibility = rule.data?.eligibility;
  return (
    <Shell>
      <div className="flex items-center gap-2">
        <h2 className="ws-display text-base">Verification</h2>
      </div>
      <p className="text-sm text-grey-400">
        Verification is granted by Market Square — there&apos;s nothing to apply for. We look for
        accounts that show up consistently and are worth following.
      </p>
      {/* The rule is advisory: state what counts without promising a threshold
          buys the badge, because meeting it does not. */}
      {rule.data?.status === "approved" && eligibility && (
        <div className="ws-inset px-4 py-3">
          <p className="text-xs font-semibold text-white">What we look at</p>
          <p className="mt-1 text-xs leading-relaxed text-grey-500">
            Reach and participation across the square — posting, streaming and hosting all count.
            {eligibility.minFollowers > 0 &&
              ` Accounts we consider generally have at least ${eligibility.minFollowers} followers.`}{" "}
            Meeting any figure doesn&apos;t guarantee the badge.
          </p>
        </div>
      )}
      {verifiedSince === null && trialDays > 0 && (
        <p className="text-xs text-grey-500">
          If you&apos;re granted it, the first {trialDays} days are free — after that it&apos;s{" "}
          {price} every {periodDays} days to keep it.
        </p>
      )}
    </Shell>
  );
}
