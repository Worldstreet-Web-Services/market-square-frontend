"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCount, formatDateTime, formatKash } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, OrgBadgeChip, Pill, RoleChip, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCalendar, IconFlag, IconShield } from "@/components/ui/icons";
import { IconMsMore } from "@/components/ui/design-icons";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { RowSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { MediaTab } from "@/features/profile/components/media-tab";
import type { Post, Profile } from "@/lib/api/schemas";
import {
  useFollow,
  useProfile,
  useProfileActivities,
  useProfilePosts,
  useProfileStreams,
  useProfileSafety,
} from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";
import { EditProfileSheet } from "@/features/profile/components/edit-profile-sheet";
import { VerificationCard } from "@/features/profile/components/verification-card";
import { CreatorCard } from "@/features/profile/components/creator-card";
import { useMarketView } from "@/lib/analytics";

/*
  Media is a tab, not a section inside Posts.

  It is the replacement for the reels, and it only works if it is somewhere a
  person GOES: "if you need to see someone's picture, you have to go to their
  profile, and then you can slide". Buried under a timeline it would be a
  scroll away and nobody would find it.

  Second, not first. A profile answers "who is this" before "what have they
  posted", and Posts carries the words that answer it.
*/
type Tab = "posts" | "media" | "streams" | "activities";

function FollowButton({ profile }: { profile: Profile }) {
  const follow = useFollow(profile);
  const gate = useGate();
  const isFollowing = useIsFollowing(profile);
  return (
    <Button
      variant={isFollowing ? "secondary" : "primary"}
      size="sm"
      aria-pressed={isFollowing}
      onClick={() => gate(() => follow.mutate(!isFollowing))}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}

/**
 * Report and block, behind the same "more" disc a post uses.
 *
 * They were two full-width text buttons in the header row, which on a phone
 * left four actions and a 112px avatar fighting over ~343px of content width —
 * Follow ended up jammed against the right edge. Safety actions are also the
 * two nobody is reaching for on a normal visit, so the row keeps the actions a
 * visitor came to use (Message, Follow) and puts these behind the menu.
 */
function SafetyActions({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const safety = useProfileSafety(profile);
  const gate = useGate();
  const blockDisabled = safety.blockUnavailable || safety.block.isPending;
  return (
    <div className="relative">
      <button
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ws-press flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-grey-100 transition-colors hover:bg-white/10"
      >
        <IconMsMore className="h-5 w-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="ws-popover ws-popover-enter absolute right-0 z-20 mt-1 w-48 rounded-2xl p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                gate(() => safety.report.mutate());
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-body transition-colors hover:bg-white/10"
            >
              <IconFlag className="h-4 w-4" /> Report
            </button>
            {/* Once the service has answered "no such route", the entry stops
                offering an action it cannot perform. */}
            <button
              disabled={blockDisabled}
              title={safety.blockUnavailable ? "Blocking isn't available yet" : undefined}
              onClick={() => {
                setOpen(false);
                gate(() => safety.block.mutate(!profile.isBlocked));
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-down transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconShield className="h-4 w-4" /> {profile.isBlocked ? "Unblock" : "Block"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** The action under an empty profile tab — own profile only. */
function TabCta({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="ws-press inline-flex rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
    >
      {label}
    </Link>
  );
}

function PostsTab({
  username,
  isMe,
  composeSlot,
  postSlot,
}: {
  username: string;
  isMe: boolean;
  /** Composed from outside — profile never imports the feed slice. */
  composeSlot?: React.ReactNode;
  /** The feed slice's post card, composed in by the route. */
  postSlot: (post: Post) => React.ReactNode;
}) {
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
        <EmptyState
          glyph="◌"
          title={isMe ? "You haven't posted yet" : "No posts yet"}
          body={
            isMe
              ? "Your updates show up here and in your followers' feeds."
              : "When they post, it shows up here."
          }
          // Opens the composer in place when the shell supplies it; the
          // link is the signed-out/unslotted fallback and still works.
          action={isMe ? (composeSlot ?? <TabCta href="/?compose=1" label="Create a post" />) : undefined}
        />
      </div>
    );
  // The real post card, composed in by the route: the profile slice cannot
  // import the feed slice. This row used to be hand-rolled here, and its heart
  // was a <span> with no handler, so liking a post from somebody's profile did
  // nothing at all. It also dropped the media, the author, the arkmark and the
  // repost, which is why a post read differently here than anywhere else.
  return (
    <ul>
      {posts.data.items.map((post) => (
        <li key={post.id}>{postSlot(post)}</li>
      ))}
    </ul>
  );
}

function StreamsTab({ username, isMe }: { username: string; isMe: boolean }) {
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
        <EmptyState
          glyph="◉"
          title={isMe ? "You haven't streamed yet" : "No streams yet"}
          body={
            isMe
              ? "Sessions you host show up here once you've gone live."
              : "Sessions they host will show up here."
          }
          action={isMe ? <TabCta href="/studio" label="Go live" /> : undefined}
        />
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

function ActivitiesTab({ username, isMe }: { username: string; isMe: boolean }) {
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
        <EmptyState
          glyph="◇"
          title={isMe ? "Nothing scheduled" : "No activities yet"}
          body={
            isMe
              ? "Schedule a stream or an event and it appears here for your followers."
              : "Scheduled games, streams and events show here."
          }
          action={isMe ? <TabCta href="/schedule" label="Schedule one" /> : undefined}
        />
      </div>
    );
  return (
    <ul>
      {activities.data.items.map((activity) => {
        const cta = resolveCta(activity.deepLink);
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
  composeSlot,
  postSlot,
  mediaViewerSlot,
}: {
  username: string;
  /** Composed from outside — profile never imports the messages slice. */
  messageSlot?: (profile: Profile) => React.ReactNode;
  /** Composed from outside — profile never imports the feed slice. */
  composeSlot?: React.ReactNode;
  postSlot: (post: Post) => React.ReactNode;
  /**
   * The full-screen swipeable viewer, composed by the route: profile never
   * imports the feed slice, and the viewer lives there.
   */
  mediaViewerSlot: (items: Post[], openId: string, onClose: () => void) => React.ReactNode;
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
          <Skeleton className="relative z-10 -mt-16 h-28 w-28 rounded-full border-4 border-black" />
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

      <GradientThumb seed={data.username} className="h-32 w-full sm:h-44" />

      <div className="px-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* `relative z-10` is what makes it VISIBLE, not decoration. The
              cover above is `relative` (positioned), and within one stacking
              context positioned elements paint above in-flow block boxes — so
              an unpositioned avatar pulled up over the cover had its top half
              painted over by it.

              88px on a phone, 112 from `sm` up: at 112 the disc plus its ring
              ate 120 of ~343px of content width and squeezed the action row
              into the right edge. Sized by class, not by `size`, because the
              inline width/height `size` writes would beat the breakpoint. */}
          <div className="relative z-10 -mt-11 rounded-full border-4 border-black sm:-mt-16">
            <Avatar
              name={data.displayName}
              seed={data.id}
              src={data.avatarUrl}
              size={112}
              sizeClassName="h-22 w-22 sm:h-28 sm:w-28"
            />
          </div>
          {/* `flex-wrap` with `justify-end` is the last-resort escape: a long
              Message label or a future action drops onto a second line rather
              than shrinking every pill into its own text. */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
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
          <h1 className="ws-display flex flex-wrap items-center gap-x-2 text-xl">
            <span className="min-w-0 break-words">{data.displayName}</span>
            <VerifiedBadge verification={data.verification} className="h-5 w-5" />
            <OrgBadgeChip orgBadge={data.orgBadge} />
            <RoleChip role={data.role} />
          </h1>
          {/* An unclaimed member's username is their Privy DID — 40-odd
              unbroken characters. Without a wrap rule it runs past the column
              on a phone; `break-all` is the only break this string offers. */}
          <p className="break-all text-[15px] text-meta">@{data.username}</p>
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

      {/* Two stickies on one page: the header above pins first, so the tabs
          have to pin BELOW it — the shell's fixed top strip plus the header's
          own measured height. At `top-0` with a lower z-index they stuck
          straight underneath both and vanished, so a scrolled profile had no
          way left to switch tab. */}
      <div className="ws-hair sticky top-[calc(var(--ws-topbar-h)_+_var(--ws-colhead-h))] z-20 border-b bg-ground">
        <ColumnTabs
          tabs={[
            { value: "posts" as Tab, label: "Posts" },
            { value: "media" as Tab, label: "Media" },
            { value: "streams" as Tab, label: "Streams" },
            { value: "activities" as Tab, label: "Activities" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "posts" && (
        <PostsTab username={username} isMe={isMe} composeSlot={composeSlot} postSlot={postSlot} />
      )}
      {tab === "media" && (
        <MediaTab username={username} isMe={isMe} viewerSlot={mediaViewerSlot} />
      )}
      {tab === "streams" && <StreamsTab username={username} isMe={isMe} />}
      {tab === "activities" && <ActivitiesTab username={username} isMe={isMe} />}

      {isMe && <EditProfileSheet me={data} open={editOpen} onClose={() => setEditOpen(false)} />}
    </>
  );
}