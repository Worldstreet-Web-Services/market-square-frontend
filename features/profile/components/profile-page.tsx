"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime, formatKash, relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconHeart, IconComment } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Profile } from "@/lib/api/schemas";
import {
  useFollow,
  useProfile,
  useProfileActivities,
  useProfilePosts,
  useProfileStreams,
} from "@/features/profile/hooks/use-profile";
import { EditProfileSheet } from "@/features/profile/components/edit-profile-sheet";
import { VerificationCard } from "@/features/profile/components/verification-card";
import { CreatorCard } from "@/features/profile/components/creator-card";

type Tab = "posts" | "streams" | "activities";

function FollowButton({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  return (
    <Button
      variant={profile.isFollowing ? "secondary" : "primary"}
      size="sm"
      onClick={() => gate(() => follow.mutate(!profile.isFollowing))}
    >
      {profile.isFollowing ? "Following" : "Follow"}
    </Button>
  );
}

function PostsTab({ username }: { username: string }) {
  const posts = useProfilePosts(username);
  if (posts.isPending)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  if (posts.isError)
    return <ErrorState error={posts.error} fallback="Couldn't load posts." onRetry={() => posts.refetch()} />;
  if (posts.data.items.length === 0)
    return <EmptyState glyph="◌" title="No posts yet" body="Updates land here when they post." />;
  return (
    <ul className="space-y-3">
      {posts.data.items.map((post) => {
        const cta = post.deepLink ? resolveDeepLink(post.deepLink) : null;
        return (
          <li key={post.id} className="ws-card p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-grey-100">{post.text}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-grey-500">
              <span className={cn("flex items-center gap-1", post.likedByMe && "text-like")}>
                <IconHeart className="h-3.5 w-3.5" filled={post.likedByMe} /> {formatCount(post.likeCount)}
              </span>
              <span className="flex items-center gap-1">
                <IconComment className="h-3.5 w-3.5" /> {formatCount(post.commentCount)}
              </span>
              <span>{relativeTime(post.createdAt)}</span>
              {cta && (
                <Link href={cta.href} className="ml-auto font-semibold text-accent hover:underline">
                  {cta.label} →
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StreamsTab({ username }: { username: string }) {
  const streams = useProfileStreams(username);
  if (streams.isPending)
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  if (streams.isError)
    return <ErrorState error={streams.error} fallback="Couldn't load streams." onRetry={() => streams.refetch()} />;
  if (streams.data.items.length === 0)
    return <EmptyState glyph="◉" title="No streams" body="Hosted sessions show up here." />;
  return (
    <ul className="space-y-3">
      {streams.data.items.map((stream) => (
        <li key={stream.id}>
          <Link href={`/live/${stream.id}`} className="ws-card flex items-center gap-3 p-4 transition-colors hover:bg-white/8">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{stream.title}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-grey-500">
                {stream.status === "live" ? (
                  <LiveBadge className="px-2 py-0 text-[9px]" />
                ) : (
                  <span className="capitalize">{stream.status}</span>
                )}
                {stream.category && <span>· {stream.category}</span>}
                {stream.scheduledAt && <span>· {formatDateTime(stream.scheduledAt)}</span>}
              </p>
            </div>
            <Pill>{stream.ticketPriceKash ? formatKash(stream.ticketPriceKash) : "Free"}</Pill>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActivitiesTab({ username }: { username: string }) {
  const activities = useProfileActivities(username);
  if (activities.isPending)
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  if (activities.isError)
    return (
      <ErrorState error={activities.error} fallback="Couldn't load activities." onRetry={() => activities.refetch()} />
    );
  if (activities.data.items.length === 0)
    return <EmptyState glyph="◇" title="No activities" body="Scheduled games, streams and events show here." />;
  return (
    <ul className="space-y-3">
      {activities.data.items.map((activity) => {
        const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
        return (
          <li key={activity.id} className="ws-card flex items-center gap-4 p-4">
            <span className="ws-inset flex h-10 w-10 shrink-0 items-center justify-center text-grey-300">
              <IconCalendar className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{activity.title}</p>
              <p className="text-xs text-grey-500">
                {activity.type} · {formatDateTime(activity.startsAt)}
              </p>
            </div>
            {cta && (
              <Link href={cta.href} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                {cta.label} →
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProfilePage({ username }: { username: string }) {
  const profile = useProfile(username);
  const me = useMe();
  const [tab, setTab] = useState<Tab>("posts");
  const [editOpen, setEditOpen] = useState(false);
  // The backend has no isMe flag — ownership is the viewer's id matching.
  const isMe = Boolean(profile.data && me.data && profile.data.id === me.data.id);

  if (profile.isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 lg:px-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (profile.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-6">
        <ErrorState error={profile.error} fallback="Couldn't load this profile." onRetry={() => profile.refetch()} />
      </div>
    );
  }

  const data = profile.data;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={data.displayName} src={data.avatarUrl} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="ws-display flex items-center gap-2 text-xl">
            {data.displayName}
            <VerifiedBadge verification={data.verification} className="h-5 w-5" />
            <RoleChip role={data.role} />
          </h1>
          <p className="text-sm text-grey-500">@{data.username}</p>
          <p className="tnum mt-1 text-xs text-grey-400">
            <span className="font-semibold text-white">{formatCount(data.followerCount)}</span> followers ·{" "}
            <span className="font-semibold text-white">{formatCount(data.followingCount)}</span> following
          </p>
        </div>
        {isMe ? (
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Edit profile
          </Button>
        ) : (
          <FollowButton profile={data} />
        )}
      </header>

      {data.bio && <p className="text-sm leading-relaxed text-grey-300">{data.bio}</p>}

      {isMe && <CreatorCard role={data.role} />}
      {isMe && <VerificationCard />}

      <div className="ws-inset flex gap-1 p-1">
        {(["posts", "streams", "activities"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-colors",
              tab === value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "posts" && <PostsTab username={username} />}
      {tab === "streams" && <StreamsTab username={username} />}
      {tab === "activities" && <ActivitiesTab username={username} />}

      {isMe && <EditProfileSheet me={data} open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
