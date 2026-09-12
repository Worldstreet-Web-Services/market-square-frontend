"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { Spinner } from "@/components/ui/button";
import { IconSearch } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { OrgBadge, Profile } from "@/lib/api/schemas";
import { DateTimeField } from "@/components/ui/date-time-field";
import {
  notDeployed,
  useAdminAnnouncements,
  useAdminProfiles,
  useAdminReports,
  useAdminStats,
  useCreateAnnouncement,
  useEndAnnouncement,
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

/**
 * ANNOUNCEMENTS — the one place a banner is written for everybody.
 *
 * An announcement is deliberately NOT a post: it carries copy, a window and a
 * dismissal, and no replies, likes or author. So it is published here rather
 * than by pinning something on Home, and the band above the column is the
 * only place it renders.
 *
 * EVERY ANNOUNCEMENT ENDS. The service requires an end and this form does
 * too, rather than defaulting to one — a banner with no end is one somebody
 * has to remember to take down, and the operator choosing the end is the
 * whole point. The start is left to the service's "now" unless it is set.
 *
 * ANNOUNCING A POST REFERENCES IT. The post is never copied, so its author
 * deleting or hiding it empties the band in the same moment; the service
 * refuses a post it cannot show, and that refusal is surfaced rather than
 * publishing a band that would render empty.
 */
export function AnnouncementsSection() {
  const announcements = useAdminAnnouncements();
  const create = useCreateAnnouncement();
  const end = useEndAnnouncement();
  const items = announcements.data?.pages.flatMap((page) => page.items) ?? [];

  const [body, setBody] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [postId, setPostId] = useState("");

  // The clock is STATE, ticked, never read during render: reading Date.now()
  // while rendering makes the same props produce two different screens, which
  // is exactly what react-hooks/purity exists to stop. A minute is plenty —
  // this only decides whether an end the operator typed has gone stale.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // "Running now" must mean it. The service returns ended announcements too,
  // and counting them as running sends an operator looking for a banner that
  // is on nobody's screen.
  const live = items.filter((item) => Date.parse(item.endsAt) > now);
  const ended = items.filter((item) => !(Date.parse(item.endsAt) > now));

  const endsAtMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  // The button says WHY it is off, rather than sitting dead beside a grey
  // line — the same rule every other disabled control in this app follows.
  const refusal = !body.trim()
    ? "Write the announcement first"
    : !endsAt
      ? "Choose when it ends"
      : Number.isNaN(endsAtMs) || endsAtMs <= now
        ? "The end has to be in the future"
        : null;

  const publish = () => {
    if (refusal) return;
    // Re-checked against the REAL clock at the moment of the press: the
    // ticked value above decides the button's LABEL, never permission.
    if (Number.isNaN(endsAtMs) || endsAtMs <= Date.now()) return;
    create.mutate(
      {
        body: body.trim(),
        endsAt: new Date(endsAt).toISOString(),
        linkUrl: linkUrl.trim() || undefined,
        postId: postId.trim() || undefined,
      },
      {
        onSuccess: () => {
          setBody("");
          setEndsAt("");
          setLinkUrl("");
          setPostId("");
        },
      }
    );
  };

  const field =
    "w-full rounded-2xl border border-white/12 bg-black/35 px-3 py-2 text-[14px] text-white outline-none placeholder:text-meta focus:border-white/25";

  return (
    <div className="space-y-3">
      <Panel title="New announcement">
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-meta">
              What it says
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              placeholder="One paragraph, in the platform's voice."
              className={field}
            />
          </label>

          <DateTimeField label="When it ends" value={endsAt} onChange={setEndsAt} />

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-meta">
              Link (optional)
            </span>
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              inputMode="url"
              placeholder="https://…  — leave empty and the band is not tappable"
              className={field}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-meta">
              Announce a post (optional)
            </span>
            <input
              value={postId}
              onChange={(event) => setPostId(event.target.value)}
              placeholder="Post id — referenced, never copied"
              className={field}
            />
          </label>

          <button
            type="button"
            onClick={publish}
            disabled={Boolean(refusal) || create.isPending}
            title={refusal ?? undefined}
            className="ws-btn-create ws-press w-full rounded-full px-5 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending ? "Publishing…" : (refusal ?? "Publish to everybody")}
          </button>
        </div>
      </Panel>

      <Panel title="Running now" count={live.length}>
        <PanelBody
          isPending={announcements.isPending}
          isError={announcements.isError}
          error={announcements.error}
          missing={notDeployed(announcements.error)}
          missingLabel="Announcements"
          isEmpty={items.length === 0}
          emptyTitle="Nothing announced"
          emptyBody="Published announcements appear here until they end."
          onRetry={() => announcements.refetch()}
        >
          {live.map((announcement) => (
            <Row key={announcement.id}>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-white">{announcement.body}</p>
                <p className="mt-1 text-[12px] text-meta">
                  Ends <When iso={announcement.endsAt} />
                  {announcement.post ? " · announcing a post" : ""}
                  {announcement.linkUrl ? " · links out" : ""}
                </p>
              </div>
              <ConfirmAction
                label="End"
                confirmLabel="End it now"
                tone="danger"
                pending={end.isPending}
                onConfirm={() => end.mutate(announcement.id)}
              />
            </Row>
          ))}

          {/*
            ENDED ONES ARE STILL LISTED, BUT NOT AS RUNNING.

            The service returns them and that is useful — an operator wants to
            see what went out. What it must not do is count them under
            "Running now": a band that ended ten hours ago is not on anybody's
            screen, and saying it is sends an operator hunting for a banner no
            reader can see. They carry no End action either; there is nothing
            left to end.
          */}
          {ended.length > 0 && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-meta">
                Already ended
              </p>
              <div className="space-y-2">
                {ended.map((announcement) => (
                  <div key={announcement.id} className="flex items-start gap-2 opacity-60">
                    <p className="min-w-0 flex-1 text-[13px] text-white">
                      {announcement.body}
                      <span className="mt-0.5 block text-[12px] text-meta">
                        Ended <When iso={announcement.endsAt} />
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
