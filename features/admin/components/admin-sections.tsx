"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { Spinner } from "@/components/ui/button";
import { IconSearch } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { OrgBadge, Profile } from "@/lib/api/schemas";
import {
  notDeployed,
  useAdminProfiles,
  useAdminReports,
  useAdminStats,
  useResolveReport,
  useResolveRoleApplication,
  useResolveVerificationRequest,
  useRoleApplications,
  useSetProfileOrgBadge,
  useSetProfileVerification,
  useVerificationRequests,
} from "@/features/admin/hooks/use-admin";
import {
  BadgePicker,
  ConfirmAction,
  Panel,
  PanelBody,
  PersonCell,
  Row,
  When,
} from "@/features/admin/components/admin-primitives";

function MoreRows({
  hasNext,
  isFetching,
  onMore,
}: {
  hasNext: boolean;
  isFetching: boolean;
  onMore: () => void;
}) {
  const sentinel = useInfiniteScroll(onMore, hasNext && !isFetching);
  return (
    <>
      <div ref={sentinel} />
      {isFetching && (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5 text-meta" />
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Overview */

const TILES: Array<{ key: string; label: string }> = [
  { key: "profiles", label: "People" },
  { key: "posts", label: "Posts" },
  { key: "streams", label: "Streams" },
  { key: "liveStreams", label: "Live now" },
  { key: "verifiedProfiles", label: "Verified" },
  { key: "storeItems", label: "Store items" },
];

export function OverviewSection({ queues }: { queues: Array<{ label: string; count: number | null }> }) {
  const stats = useAdminStats();
  const missing = notDeployed(stats.error);
  const data = (stats.data ?? {}) as Record<string, number | undefined>;
  // Render only the tiles the service actually sent — a missing metric is
  // omitted, never shown as zero.
  const present = TILES.filter((tile) => typeof data[tile.key] === "number");

  return (
    <div className="space-y-4">
      <Panel title="Queues">
        <div className="grid grid-cols-2 gap-px bg-white/8 sm:grid-cols-3">
          {queues.map((queue) => (
            <div key={queue.label} className="bg-panel px-4 py-3">
              <p className="tnum text-[22px] font-bold text-heading">
                {queue.count === null ? "—" : formatCount(queue.count)}
              </p>
              <p className="text-[12px] text-meta">{queue.label}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Platform">
        {missing ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] font-semibold text-grey-300">Stats aren&apos;t available yet</p>
            <p className="mt-1 text-[12px] text-grey-500">
              Queue counts above are live; platform totals turn on with the endpoint.
            </p>
          </div>
        ) : stats.isPending ? (
          <div className="grid grid-cols-2 gap-px bg-white/8 sm:grid-cols-3">
            {TILES.map((tile) => (
              <div key={tile.key} className="bg-panel px-4 py-3">
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : present.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-meta">No metrics reported.</p>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-white/8 sm:grid-cols-3">
            {present.map((tile) => (
              <div key={tile.key} className="bg-panel px-4 py-3">
                <p className="tnum text-[22px] font-bold text-heading">
                  {formatCount(data[tile.key] as number)}
                </p>
                <p className="text-[12px] text-meta">{tile.label}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------- Creator applications */

export function ApplicationsSection() {
  const applications = useRoleApplications();
  const resolve = useResolveRoleApplication();
  const setBadge = useSetProfileOrgBadge();
  const items = applications.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Panel title="Creator applications" count={items.length}>
      <PanelBody
        isPending={applications.isPending}
        isError={applications.isError}
        error={applications.error}
        missing={notDeployed(applications.error)}
        missingLabel="Creator applications"
        isEmpty={items.length === 0}
        emptyTitle="No pending applications"
        emptyBody="Approved and rejected applications leave this queue."
        onRetry={() => applications.refetch()}
      >
        {items.map((application) => (
          <Row key={application.id}>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <PersonCell profile={application.applicant} fallbackId={application.userId} />
                <When iso={application.createdAt} />
              </div>
              {application.note && (
                <p className="ws-inset mt-2 px-3 py-2 text-[13px] leading-normal text-body">
                  {application.note}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ConfirmAction
                  label="Approve"
                  confirmLabel="Confirm approve"
                  tone="primary"
                  pending={resolve.isPending}
                  onConfirm={() => resolve.mutate({ id: application.id, approve: true })}
                />
                <ConfirmAction
                  label="Reject"
                  confirmLabel="Confirm reject"
                  tone="danger"
                  pending={resolve.isPending}
                  onConfirm={() => resolve.mutate({ id: application.id, approve: false })}
                />
                {/* Approving and badging is one operator flow, so the badge
                    control sits on the same row rather than in another tab. */}
                {application.applicant && (
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] text-meta">Badge</span>
                    <BadgePicker
                      current={application.applicant.orgBadge}
                      pending={setBadge.isPending}
                      onPick={(badge: OrgBadge) =>
                        setBadge.mutate({ profileId: application.applicant!.id, badge })
                      }
                    />
                  </span>
                )}
              </div>
            </div>
          </Row>
        ))}
        <MoreRows
          hasNext={Boolean(applications.hasNextPage)}
          isFetching={applications.isFetchingNextPage}
          onMore={() => applications.fetchNextPage()}
        />
      </PanelBody>
    </Panel>
  );
}

/* ------------------------------------------------------------ Verification */

export function VerificationSection() {
  const requests = useVerificationRequests();
  const resolve = useResolveVerificationRequest();
  const items = requests.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Panel title="Verification requests" count={items.length}>
      <PanelBody
        isPending={requests.isPending}
        isError={requests.isError}
        error={requests.error}
        missing={notDeployed(requests.error)}
        missingLabel="The verification queue"
        isEmpty={items.length === 0}
        emptyTitle="No pending requests"
        emptyBody="Verification is granted proactively — use People to verify someone directly."
        onRetry={() => requests.refetch()}
      >
        {items.map((request) => (
          <Row key={request.id}>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <PersonCell profile={request.applicant} fallbackId={request.userId} />
                <When iso={request.createdAt} />
              </div>
              {request.note && (
                <p className="ws-inset mt-2 px-3 py-2 text-[13px] leading-normal text-body">
                  {request.note}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ConfirmAction
                  label="Approve"
                  confirmLabel="Confirm approve"
                  tone="primary"
                  pending={resolve.isPending}
                  onConfirm={() => resolve.mutate({ id: request.id, approve: true })}
                />
                <ConfirmAction
                  label="Reject"
                  confirmLabel="Confirm reject"
                  tone="danger"
                  pending={resolve.isPending}
                  onConfirm={() => resolve.mutate({ id: request.id, approve: false })}
                />
              </div>
            </div>
          </Row>
        ))}
        <MoreRows
          hasNext={Boolean(requests.hasNextPage)}
          isFetching={requests.isFetchingNextPage}
          onMore={() => requests.fetchNextPage()}
        />
      </PanelBody>
    </Panel>
  );
}

/* ---------------------------------------------------------------- Reports */

export function ReportsSection() {
  const reports = useAdminReports();
  const resolve = useResolveReport();
  const items = reports.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Panel title="Reports" count={items.length}>
      <PanelBody
        isPending={reports.isPending}
        isError={reports.isError}
        error={reports.error}
        missing={notDeployed(reports.error)}
        missingLabel="The report queue"
        isEmpty={items.length === 0}
        emptyTitle="Nothing reported"
        emptyBody="Open reports appear here for review."
        onRetry={() => reports.refetch()}
      >
        {items.map((report) => (
          <Row key={report.id}>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-down/40 bg-down/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-down">
                      {report.reason || "report"}
                    </span>
                    <span className="text-[12px] text-meta">
                      {report.targetType || "content"}
                    </span>
                  </span>
                  {report.note && (
                    <span className="mt-1 block text-[12px] text-grey-400">{report.note}</span>
                  )}
                </span>
                <When iso={report.createdAt} />
              </div>

              {/* The reported content, inline — a moderator should not have to
                  leave the queue to judge it. */}
              <div className="ws-inset mt-2 px-3 py-2.5">
                {report.target ? (
                  <>
                    {report.target.author && (
                      <PersonCell profile={report.target.author} size={24} />
                    )}
                    {report.target.text && (
                      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-normal text-body">
                        {report.target.text}
                      </p>
                    )}
                    {report.target.mediaUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
                      <img
                        src={report.target.mediaUrl}
                        alt=""
                        className="mt-2 max-h-40 rounded-lg object-cover"
                      />
                    )}
                    {!report.target.text && !report.target.mediaUrl && (
                      <p className="text-[12px] text-meta">This content has no preview.</p>
                    )}
                  </>
                ) : (
                  <p className="text-[12px] text-meta">
                    The reported content is no longer available.{" "}
                    <span className="font-mono">{report.targetId}</span>
                  </p>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ConfirmAction
                  label="Remove content"
                  confirmLabel="Confirm remove"
                  tone="danger"
                  pending={resolve.isPending}
                  onConfirm={() => resolve.mutate({ id: report.id, action: "remove" })}
                />
                <ConfirmAction
                  label="Dismiss"
                  confirmLabel="Confirm dismiss"
                  pending={resolve.isPending}
                  onConfirm={() => resolve.mutate({ id: report.id, action: "dismiss" })}
                />
              </div>
            </div>
          </Row>
        ))}
        <MoreRows
          hasNext={Boolean(reports.hasNextPage)}
          isFetching={reports.isFetchingNextPage}
          onMore={() => reports.fetchNextPage()}
        />
      </PanelBody>
    </Panel>
  );
}

/* ----------------------------------------------------------------- People */

function PersonRow({ profile }: { profile: Profile }) {
  const setBadge = useSetProfileOrgBadge();
  const setVerified = useSetProfileVerification();
  const verified = profile.verification === "verified";

  return (
    <Row>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <PersonCell profile={profile} />
          <span className="flex shrink-0 items-center gap-1.5">
            {profile.isAdmin && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                Admin
              </span>
            )}
            <span className="tnum text-[11px] text-meta">
              {formatCount(profile.followerCount)} followers
            </span>
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {/* Direct grant: the platform verifies proactively, so this needs no
              request to approve. */}
          <ConfirmAction
            label={verified ? "Remove verification" : "Verify"}
            confirmLabel={verified ? "Confirm remove" : "Confirm verify"}
            tone={verified ? "danger" : "primary"}
            pending={setVerified.isPending}
            onConfirm={() => setVerified.mutate({ profileId: profile.id, verified: !verified })}
          />
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-meta">Badge</span>
            <BadgePicker
              current={profile.orgBadge}
              pending={setBadge.isPending}
              onPick={(badge: OrgBadge) => setBadge.mutate({ profileId: profile.id, badge })}
            />
          </span>
        </div>
      </div>
    </Row>
  );
}

export function PeopleSection() {
  const [query, setQuery] = useState("");
  const people = useAdminProfiles(query);
  const items = people.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Panel
      title="People"
      action={
        <label className="ws-field flex h-8 w-56 items-center gap-2 px-3">
          <IconSearch className="h-3.5 w-3.5 shrink-0 text-meta" />
          <span className="sr-only">Search people</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or handle"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-heading outline-none"
          />
        </label>
      }
    >
      <PanelBody
        isPending={people.isPending}
        isError={people.isError}
        error={people.error}
        missing={notDeployed(people.error)}
        missingLabel="The people directory"
        isEmpty={items.length === 0}
        emptyTitle={query ? `No matches for “${query}”` : "No people"}
        emptyBody={query ? "Try another name or handle." : undefined}
        onRetry={() => people.refetch()}
      >
        {items.map((profile) => (
          <PersonRow key={profile.id} profile={profile} />
        ))}
        <MoreRows
          hasNext={Boolean(people.hasNextPage)}
          isFetching={people.isFetchingNextPage}
          onMore={() => people.fetchNextPage()}
        />
      </PanelBody>
    </Panel>
  );
}

export const SECTION_CLASS = cn("space-y-4");
