"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { OrgBadgeChip, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { OrgBadge, Profile } from "@/lib/api/schemas";

/** An operator panel: dense, bordered, its own heading and count. */
export function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ws-card overflow-hidden">
      <header className="ws-hair flex items-center gap-2 border-b px-4 py-3">
        <h2 className="ws-display text-[15px]">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="tnum rounded-full bg-featured px-2 py-0.5 text-[11px] font-bold text-ink">
            {count}
          </span>
        )}
        <div className="ml-auto">{action}</div>
      </header>
      {children}
    </section>
  );
}

/**
 * What a panel shows when its endpoint has not shipped.
 *
 * Deliberately quiet: this is a deployment gap, not an outage, and an operator
 * scanning the console should be able to tell the difference at a glance.
 */
export function NotDeployed({ what }: { what: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-[13px] font-semibold text-grey-300">{what} isn&apos;t available yet</p>
      <p className="mt-1 text-[12px] text-grey-500">
        This panel turns on by itself once the service ships the endpoint.
      </p>
    </div>
  );
}

/** Uniform panel body: skeleton, not-deployed, error, empty, or rows. */
export function PanelBody({
  isPending,
  isError,
  error,
  missing,
  missingLabel,
  isEmpty,
  emptyTitle,
  emptyBody,
  onRetry,
  children,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  missing: boolean;
  missingLabel: string;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (missing) return <NotDeployed what={missingLabel} />;
  if (isPending) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState error={error} fallback="Couldn't load this queue." onRetry={onRetry} />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="p-4">
        <EmptyState glyph="○" title={emptyTitle} body={emptyBody} />
      </div>
    );
  }
  return <>{children}</>;
}

/** Identity cell shared by every queue and the people table. */
export function PersonCell({
  profile,
  fallbackId,
  size = 36,
}: {
  profile: Profile | null;
  /** Shown when the service sent only an id — never invent a name. */
  fallbackId?: string;
  size?: number;
}) {
  if (!profile) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name="?" size={size} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-grey-300">
            Unknown profile
          </span>
          <span className="block truncate font-mono text-[11px] text-meta">
            {fallbackId ?? "—"}
          </span>
        </span>
      </span>
    );
  }
  return (
    <Link href={`/u/${profile.username}`} className="flex min-w-0 items-center gap-2.5">
      <Avatar name={profile.displayName} src={profile.avatarUrl} size={size} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-bold text-heading">{profile.displayName}</span>
          <VerifiedBadge verification={profile.verification} className="h-3 w-3" />
          <OrgBadgeChip orgBadge={profile.orgBadge} />
          <RoleChip role={profile.role} />
        </span>
        <span className="block truncate text-[11px] text-meta">@{profile.username}</span>
      </span>
    </Link>
  );
}

/**
 * A destructive or irreversible action, behind one confirmation.
 *
 * The confirm replaces the button in place rather than opening a dialog: an
 * operator working a queue should never lose their scroll position to a modal.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  tone = "secondary",
  pending,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  tone?: "primary" | "secondary" | "danger";
  pending?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className={cn(
          "ws-press shrink-0 rounded-full border px-3 py-1 text-[12px] font-bold transition-colors",
          tone === "danger"
            ? "border-down/40 text-down hover:bg-down/10"
            : tone === "primary"
              ? "border-transparent bg-accent text-ink hover:bg-white"
              : "border-white/20 text-body hover:bg-white/10"
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Button
        size="sm"
        variant={tone === "danger" ? "secondary" : "primary"}
        loading={pending}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <button
        onClick={() => setArmed(false)}
        className="shrink-0 rounded-full px-2 py-1 text-[12px] text-meta hover:text-body"
      >
        Cancel
      </button>
    </span>
  );
}

/**
 * Badge assignment: MARKET, ARK, or none.
 *
 * Lives wherever a person does — the people table and the approve-a-creator
 * row alike — because "approve them and badge them" is one operator flow.
 */
export function BadgePicker({
  current,
  pending,
  onPick,
}: {
  current: OrgBadge;
  pending?: boolean;
  onPick: (badge: OrgBadge) => void;
}) {
  const options: Array<{ value: OrgBadge; label: string }> = [
    { value: "market", label: "MARKET" },
    { value: "ark", label: "ARK" },
    { value: null, label: "None" },
  ];
  return (
    <span className="flex shrink-0 items-center gap-1" role="group" aria-label="Organisation badge">
      {options.map((option) => {
        const active = current === option.value;
        return (
          <button
            key={option.label}
            disabled={pending || active}
            onClick={() => onPick(option.value)}
            aria-pressed={active}
            className={cn(
              "ws-press rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors disabled:cursor-default",
              active
                ? "border-featured/50 bg-featured/15 text-featured"
                : "border-white/15 text-meta hover:bg-white/10 hover:text-body"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}

/** Row wrapper with the queue's standard padding and divider. */
export function Row({ children }: { children: React.ReactNode }) {
  return <div className="ws-row flex items-start gap-3 px-4 py-3 last:border-b-0">{children}</div>;
}

/** "3h ago" with an absolute title, for audit-trail rows. */
export function When({ iso }: { iso: string }) {
  if (!iso) return null;
  return (
    <span className="shrink-0 text-[11px] text-meta" title={iso}>
      {relativeTime(iso)}
    </span>
  );
}
