"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { IconCalendar } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, InlineError } from "@/components/ui/states";
import {
  useActivities,
  useCancelActivity,
  useCreateActivity,
  useMyActivities,
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
  const [linkRef, setLinkRef] = useState("");

  const submit = () => {
    if (!title.trim() || !startsAt) return;
    create.mutate(
      {
        type,
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        deepLink: linkRef.trim()
          ? { kind: type === "game" ? "game" : "stream", ref: linkRef.trim() }
          : undefined,
      },
      {
        onSuccess: () => {
          setTitle("");
          setStartsAt("");
          setLinkRef("");
        },
      }
    );
  };

  return (
    <div className="ws-card space-y-4 p-5">
      <h2 className="ws-display text-lg">Schedule an activity</h2>
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
        <input
          value={linkRef}
          onChange={(e) => setLinkRef(e.target.value)}
          placeholder="Link ref (stream id, game id — optional)"
          className="ws-inset w-full bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-grey-600"
        />
      </div>
      {create.isError && <InlineError error={create.error} fallback="Couldn't schedule that." />}
      <Button onClick={submit} disabled={!title.trim() || !startsAt} loading={create.isPending}>
        Schedule
      </Button>
    </div>
  );
}

function ActivityRow({ activity, mine }: { activity: Activity; mine: boolean }) {
  const cancel = useCancelActivity();
  const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
  return (
    <li className="ws-card flex items-center gap-4 p-4">
      <span className="ws-inset flex h-11 w-11 shrink-0 items-center justify-center text-grey-300">
        <IconCalendar className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{activity.title}</p>
        <p className="text-xs text-grey-500">
          {activity.type} · {formatDateTime(activity.startsAt)}
        </p>
      </div>
      {cta && (
        <Link
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noreferrer" : undefined}
          className="shrink-0 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-grey-200 transition-colors hover:bg-white/10"
        >
          {cta.label}
        </Link>
      )}
      {mine && (
        <Button size="sm" variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(activity.id)}>
          Cancel
        </Button>
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
      <h2 className="ws-display mb-3 text-lg">{title}</h2>
      {query.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
      {query.isError && (
        <ErrorState error={query.error} fallback="Couldn't load activities." onRetry={() => query.refetch()} />
      )}
      {query.isSuccess && query.data.items.length === 0 && (
        <EmptyState glyph="◇" title={empty.title} body={empty.body} />
      )}
      <ul className="space-y-3">
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
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 lg:px-6">
      <h1 className="ws-display text-2xl">Schedule</h1>
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
    </div>
  );
}
