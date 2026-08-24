"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime, formatKash, relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, OrgBadgeChip, Pill, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconHeart, IconComment } from "@/components/ui/icons";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Profile } from "@/lib/api/schemas";
import {
  useFollow,
  useProfile,
  useProfileActivities,
  useProfilePosts,
  useProfileStreams,
  useProfileSafety,
} from "@/features/profile/hooks/use-profile";
import { EditProfileSheet } from "@/features/profile/components/edit-profile-sheet";
import { VerificationCard } from "@/features/profile/components/verification-card";
import { CreatorCard } from "@/features/profile/components/creator-card";
import { useMarketView } from "@/lib/analytics";

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

function SafetyActions({ profile }: { profile: Profile }) {
  const safety = useProfileSafety(profile);
  const gate = useGate();
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => gate(() => safety.report.mutate())}>Report</Button>
      <Button variant={profile.isBlocked ? "secondary" : "danger"} size="sm" onClick={() => gate(() => safety.block.mutate(!profile.isBlocked))}>
        {profile.isBlocked ? "Unblock" : "Block"}
      </Button>
    </div>
  );
}

function PostsTab({ username }: { username: string }) {
  const posts = useProfilePosts(username);
  if (posts.isPending) return <>{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</>;
  if (posts.isError)
    return (
      <div className="p-4">
        <ErrorState error={posts.error} fallback="Couldn't load posts." onRetry={() => posts.refetch()} />
      </div>
    );
  if (posts.data.items.length === 0)
    return (
      <div className="p-4">
        <EmptyState glyph="◌" title="No posts yet" body="Updates land here when they post." />
      </div>
    );
  return (
    <ul>
      {posts.data.items.map((post) => {
        const cta = post.deepLink ? resolveDeepLink(post.deepLink) : null;
        return (
          <li key={post.id} className="ws-row px-4 py-3">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-normal text-body">{post.text}</p>
            <div className="mt-2 flex items-center gap-5 text-[13px] text-meta">
              <span className={cn("tnum flex items-center gap-1.5", post.likedByMe && "text-like")}>
                <IconHeart className="h-4 w-4" filled={post.likedByMe} /> {formatCount(post.likeCount)}
              </span>
              <span className="tnum flex items-center gap-1.5">
                <IconComment className="h-4 w-4" /> {formatCount(post.commentCount)}
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
  if (streams.isPending) return <>{[0, 1].map((i) => <RowSkeleton key={i} />)}</>;
  if (streams.isError)
    return (
      <div className="p-4">
        <ErrorState error={streams.error} fallback="Couldn't load streams." onRetry={() => streams.refetch()} />
      </div>
    );
  if (streams.data.items.length === 0)
    return (
      <div className="p-4">
        <EmptyState glyph="◉" title="No streams" body="Hosted sessions show up here." />
      </div>
    );
  return (
    <ul>
      {streams.data.items.map((stream) => (
        <li key={stream.id}>
          <Link href={`/live/${stream.id}`} className="ws-row flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-heading">{stream.title}</p>
              <p className="mt-0.5 flex items-center gap-2 text-[13px] text-meta">
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
  if (activities.isPending) return <>{[0, 1].map((i) => <RowSkeleton key={i} />)}</>;
  if (activities.isError)
    return (
      <div className="p-4">
        <ErrorState error={activities.error} fallback="Couldn't load activities." onRetry={() => activities.refetch()} />
      </div>
    );
  if (activities.data.items.length === 0)
    return (
      <div className="p-4">
        <EmptyState glyph="◇" title="No activities" body="Scheduled games, streams and events show here." />
      </div>
    );
  return (
    <ul>
      {activities.data.items.map((activity) => {
        const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
        return (
          <li key={activity.id} className="ws-row flex items-center gap-3 px-4 py-3">
            <span className="ws-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-body">
              <IconCalendar className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-heading">{activity.title}</p>
              <p className="text-[13px] text-meta">
                {activity.type} · {formatDateTime(activity.startsAt)}
              </p>
            </div>
            {cta && (
              <Link href={cta.href} className="shrink-0 text-[13px] font-semibold text-accent hover:underline">
                {cta.label} →
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ProfilePage({
  username,
  messageSlot,
}: {
  username: string;
  /** Composed from outside — profile never imports the messages slice. */
  messageSlot?: (profile: Profile) => React.ReactNode;
}) {
  const profile = useProfile(username);
  const me = useMe();
  const [tab, setTab] = useState<Tab>("posts");
  const [editOpen, setEditOpen] = useState(false);
  // The backend has no isMe flag — ownership is the viewer's id matching.
  const isMe = Boolean(profile.data && me.data && profile.data.id === me.data.id);
  useMarketView("profile_viewed", { surface: "profile", entityType: "profile", entityId: profile.data?.id }, Boolean(profile.data));

  if (profile.isPending) {
    return (
      <>
        <ColumnHeader title="Profile" back />
        <div className="ws-skeleton h-40 rounded-none" />
        <div className="space-y-3 px-4 pt-3">
          <Skeleton className="-mt-16 h-28 w-28 rounded-full border-4 border-black" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-full" />
        </div>
      </>
    );
  }
  if (profile.isError) {
    return (
      <>
        <ColumnHeader title="Profile" back />
        <div className="p-4">
          <ErrorState error={profile.error} fallback="Couldn't load this profile." onRetry={() => profile.refetch()} />
        </div>
      </>
    );
  }

  const data = profile.data;

  return (
    <>
      {/* X's profile header: a back arrow with the identity beside it, then a
          banner the avatar hangs off. The banner has no upload yet, so it is
          the same seeded gradient the rest of the square uses for artwork. */}
      <ColumnHeader
        title={data.displayName}
        subtitle={`${formatCount(data.followerCount)} followers`}
        back
      />

      <GradientThumb seed={data.username} className="h-36 w-full sm:h-44" />

      <div className="px-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="-mt-14 rounded-full border-4 border-black sm:-mt-16">
            <Avatar name={data.displayName} src={data.avatarUrl} size={112} />
          </div>
          <div className="flex items-center gap-2 pt-3">
            {isMe ? (
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                Edit profile
              </Button>
            ) : (
              <>
                <SafetyActions profile={data} />
                {messageSlot?.(data)}
                <FollowButton profile={data} />
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h1 className="ws-display flex items-center gap-2 text-xl">
            {data.displayName}
            <VerifiedBadge verification={data.verification} className="h-5 w-5" />
            <OrgBadgeChip orgBadge={data.orgBadge} />
            <RoleChip role={data.role} />
          </h1>
          <p className="text-[15px] text-meta">@{data.username}</p>
        </div>

        {data.bio && <p className="mt-3 text-[15px] leading-normal text-body">{data.bio}</p>}

        <p className="tnum mt-3 flex gap-4 text-[15px] text-meta">
          <span>
            <span className="font-bold text-heading">{formatCount(data.followingCount)}</span> Following
          </span>
          <span>
            <span className="font-bold text-heading">{formatCount(data.followerCount)}</span> Followers
          </span>
        </p>
      </div>

      {/* Own-profile business: creator application and verification live above
          the tabs, where they read as account state rather than content. */}
      {isMe && (
        <div className="ws-hair space-y-3 border-t px-4 py-4">
          <CreatorCard role={data.role} />
          <VerificationCard />
        </div>
      )}

      <div className="ws-hair sticky top-0 z-20 border-b bg-black/72 backdrop-blur-md">
        <ColumnTabs
          tabs={[
            { value: "posts" as Tab, label: "Posts" },
            { value: "streams" as Tab, label: "Streams" },
            { value: "activities" as Tab, label: "Activities" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "posts" && <PostsTab username={username} />}
      {tab === "streams" && <StreamsTab username={username} />}
      {tab === "activities" && <ActivitiesTab username={username} />}

      {isMe && <EditProfileSheet me={data} open={editOpen} onClose={() => setEditOpen(false)} />}
    </>
  );
}