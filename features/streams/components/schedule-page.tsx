"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DeepLink } from "@/lib/api/schemas";
import { LinkTargetPicker } from "@/components/ui/link-target-picker";
import { buildCreateActivityBody } from "@/lib/activity-payload";
import { formatDateTime } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { IconCalendar } from "@/components/ui/icons";
import { ColumnHeader } from "@/components/layout/column-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, InlineError } from "@/components/ui/states";
import {
  useActivities,
  useCancelActivity,
  useCreateActivity,
  useMyActivities,
  useUpdateActivity,
} from "@/features/streams/hooks/use-streams";
import type { Activity } from "@/features/streams/lib/types";

const TYPES: Array<{ value: Activity["type"]; label: string }> = [
  { value: "stream", label: "Stream" },
  { value: "game", label: "Game" },
  { value: "event", label: "Event" },
];

function CreateActivityForm() {
  const create = useCreateActivity();
  const [type, setType] = useState<Activity["type"]>("stream");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  // Replaced a raw "Link ref (stream id, game id)" text box: nobody knows
  // what a stream id is, and nothing in the product shows one.
  const [link, setLink] = useState<DeepLink | null>(null);
  const [linkLabel, setLinkLabel] = useState<string | null>(null);

  // deepLink is REQUIRED by POST /activities (createActivityBodySchema:
  // `deepLink: deepLinkSchema`, with no .optional()). The form used to label
  // it optional and send undefined, which the service rejected with
  // "deepLink: Invalid input: expected object, received undefined" — so every
  // activity created without a link silently failed to persist.
  const ready = Boolean(title.trim() && startsAt && link);

  const submit = () => {
    if (!ready) return;
    create.mutate(
      // The wire shape lives in lib/activity-payload.ts, pinned against the
      // service's own validator by lib/activity-contract.test.ts.
      buildCreateActivityBody({ type, title, localStartsAt: startsAt, deepLink: link }),
      {
        onSuccess: () => {
          setTitle("");
          setStartsAt("");
          setLink(null);
          setLinkLabel(null);
        },
      }
    );
  };

  return (
    <div className="ws-hair space-y-4 border-b px-4 py-5 lg:px-6">
      <h2 className="text-[17px] font-bold text-heading">Schedule an activity</h2>
      <div className="ws-inset flex gap-1 p-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-semibold transition-colors",
              type === t.value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Title"
        className="ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none"
          aria-label="Starts at"
        />
      </div>
      <div className="space-y-1.5">
        <span className="block text-xs font-semibold text-grey-400">
          What is this about? <span className="font-normal text-down">Required</span>
        </span>
        <LinkTargetPicker
          value={link}
          label={linkLabel}
          onChange={(next, nextLabel) => {
            setLink(next);
            setLinkLabel(nextLabel);
          }}
        />
      </div>
      {create.isError && <InlineError error={create.error} fallback="Couldn't schedule that." />}
      {/* Say WHY the button is disabled — a dead control with no explanation
          is how the missing link went unnoticed in the first place. */}
      {title.trim() && startsAt && !link && (
        <p className="text-xs text-grey-500">Choose what this activity is about to schedule it.</p>
      )}
      <Button onClick={submit} disabled={!ready} loading={create.isPending}>
        Schedule
      </Button>
    </div>
  );
}

function ActivityRow({ activity, mine }: { activity: Activity; mine: boolean }) {
  const cancel = useCancelActivity();
  const update = useUpdateActivity(activity.id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [startsAt, setStartsAt] = useState(() => activity.startsAt.slice(0, 16));
  const cta = resolveCta(activity.deepLink);
  return (
    <li className="ws-row flex flex-wrap items-center gap-4 px-4 py-3 lg:px-6">
      <span className="ws-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-body">
        <IconCalendar className="h-5 w-5" />
      </span>
      <div className="min-w-[220px] flex-1">
        {editing ? <div className="grid gap-2 sm:grid-cols-2"><input value={title} onChange={(event) => setTitle(event.target.value)} className="ws-inset px-3 py-2 text-sm outline-none" aria-label="Activity title" /><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="ws-inset px-3 py-2 text-sm outline-none" aria-label="Activity start" /></div> : <>
        <p className="truncate text-[15px] font-bold text-heading">{activity.title}</p>
        <p className="text-[13px] text-meta">
          {activity.type} · {formatDateTime(activity.startsAt)}
        </p>
        </>}
      </div>
      {cta && (
        <Link
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noreferrer" : undefined}
          className="ws-press shrink-0 rounded-full border border-white/20 px-3.5 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
        >
          {cta.label}
        </Link>
      )}
      {mine && (
        <div className="flex gap-2">
          {editing ? <><Button size="sm" loading={update.isPending} onClick={() => update.mutate({ title: title.trim(), startsAt: new Date(startsAt).toISOString() }, { onSuccess: () => setEditing(false) })}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Close</Button></> : <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          {!editing && <Button size="sm" variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(activity.id)}>Cancel</Button>}
        </div>
      )}
    </li>
  );
}

function SectionFrame({
  title,
  query,
  mineIds,
  empty,
}: {
  title: string;
  query: ReturnType<typeof useActivities>;
  mineIds: Set<string>;
  empty: { title: string; body: string };
}) {
  return (
    <section>
      <h2 className="ws-hair border-b px-4 py-3 text-[17px] font-bold text-heading lg:px-6">{title}</h2>
      {query.isPending && [0, 1].map((i) => <RowSkeleton key={i} />)}
      {query.isError && (
        <div className="p-4">
          <ErrorState error={query.error} fallback="Couldn't load activities." onRetry={() => query.refetch()} />
        </div>
      )}
      {query.isSuccess && query.data.items.length === 0 && (
        <div className="p-4">
          <EmptyState glyph="◇" title={empty.title} body={empty.body} />
        </div>
      )}
      <ul>
        {query.data?.items.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} mine={mineIds.has(activity.id)} />
        ))}
      </ul>
    </section>
  );
}

export function SchedulePage() {
  const me = useMe();
  const mine = useMyActivities();
  const upcoming = useActivities("scheduled");
  const myIds = new Set((me.data && mine.data?.items.map((a) => a.id)) ?? []);

  return (
    <>
      <ColumnHeader title="Schedule" subtitle="Streams, games and events across the square" />
      <CreateActivityForm />
      <SectionFrame
        title="My activities"
        query={mine}
        mineIds={myIds}
        empty={{ title: "Nothing on your calendar", body: "Schedule a stream, game or event above." }}
      />
      <SectionFrame
        title="Upcoming on the square"
        query={upcoming}
        mineIds={myIds}
        empty={{ title: "Nothing scheduled yet", body: "Community activities appear here." }}
      />
    </>
  );
}
