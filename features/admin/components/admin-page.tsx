"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { ColumnHeader } from "@/components/layout/column-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import {
  notDeployed,
  useAdminReports,
  useIsAdmin,
  useRoleApplications,
  useVerificationRequests,
} from "@/features/admin/hooks/use-admin";
import {
  ApplicationsSection,
  OverviewSection,
  PeopleSection,
  ReportsSection,
  VerificationSection,
} from "@/features/admin/components/admin-sections";

type Tab = "overview" | "applications" | "verification" | "reports" | "people";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "applications", label: "Applications" },
  { value: "verification", label: "Verification" },
  { value: "reports", label: "Reports" },
  { value: "people", label: "People" },
];

/**
 * The operator console.
 *
 * Authenticates as an ADMIN USER with a normal Privy token — the gateway
 * strips `x-internal-admin-key`, and an admin key must never reach a browser.
 * `me.isAdmin` only decides what is rendered; every route is enforced by the
 * service, so a non-admin who guesses the URL gets a clean refusal here and a
 * 403 from the API regardless.
 */
export function AdminPage() {
  const { ready: authReady, authenticated, login } = useAuth();
  const { ready, isAdmin } = useIsAdmin();
  const [tab, setTab] = useState<Tab>("overview");

  // Queue counts drive both the Overview tiles and the tab badges, so they are
  // read here rather than inside each section.
  const applications = useRoleApplications();
  const verification = useVerificationRequests();
  const reports = useAdminReports();

  const countOf = (
    query: { data?: { pages: Array<{ items: unknown[] }> }; error: unknown },
  ): number | null => {
    if (notDeployed(query.error)) return null;
    if (!query.data) return null;
    return query.data.pages.reduce((total, page) => total + page.items.length, 0);
  };

  const queues = [
    { label: "Creator applications", count: countOf(applications) },
    { label: "Verification requests", count: countOf(verification) },
    { label: "Open reports", count: countOf(reports) },
  ];

  if (authReady && !authenticated) {
    return (
      <>
        <ColumnHeader title="Admin" />
        <div className="p-4">
          <EmptyState
            glyph="○"
            title="Sign in to continue"
            body="The operator console is for Market Square staff."
            action={
              <button
                onClick={login}
                className="ws-btn-silver ws-press rounded-full px-5 py-2 text-[13px] font-bold"
              >
                Sign in
              </button>
            }
          />
        </div>
      </>
    );
  }

  if (!ready) {
    return (
      <>
        <ColumnHeader title="Admin" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </>
    );
  }

  // Not a crash, not a redirect: a plain refusal. The server is the real gate.
  if (!isAdmin) {
    return (
      <>
        <ColumnHeader title="Admin" />
        <div className="p-4">
          <EmptyState
            glyph="○"
            title="Not authorised"
            body="This area is limited to Market Square operators."
            action={
              <Link
                href="/"
                className="ws-press inline-flex rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
              >
                Back to the square
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <ColumnHeader title="Admin" subtitle="Operator console">
        <div className="flex gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((entry) => {
            const badge =
              entry.value === "applications"
                ? queues[0].count
                : entry.value === "verification"
                  ? queues[1].count
                  : entry.value === "reports"
                    ? queues[2].count
                    : null;
            return (
              <button
                key={entry.value}
                onClick={() => setTab(entry.value)}
                aria-current={tab === entry.value ? "true" : undefined}
                className={cn(
                  "ws-press flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors",
                  tab === entry.value
                    ? "bg-accent text-ink"
                    : "border border-white/15 text-meta hover:bg-white/8 hover:text-body"
                )}
              >
                {entry.label}
                {badge !== null && badge > 0 && (
                  <span
                    className={cn(
                      "tnum rounded-full px-1.5 text-[10px]",
                      tab === entry.value ? "bg-ink/15 text-ink" : "bg-featured text-ink"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ColumnHeader>

      <div className="space-y-4 p-4">
        {tab === "overview" && <OverviewSection queues={queues} />}
        {tab === "applications" && <ApplicationsSection />}
        {tab === "verification" && <VerificationSection />}
        {tab === "reports" && <ReportsSection />}
        {tab === "people" && <PeopleSection />}
      </div>
    </>
  );
}
