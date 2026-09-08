"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IconLocationPin } from "@/components/ui/topbar-icons";
import { IconMsEdit } from "@/components/ui/design-icons";
import { IconRoomShare } from "@/components/ui/room-icons";
import { formatCount, formatDateTime, formatKash } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { useGate } from "@/hooks/use-gate";
import { useMe } from "@/hooks/use-me";
import { LiveBadge, Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconCalendar } from "@/components/ui/icons";
import { ProfileCover } from "@/features/profile/components/profile-cover";
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
} from "@/features/profile/hooks/use-profile";
import { useIsFollowing } from "@/features/profile/lib/follow-state";
import { EditProfileSheet } from "@/features/profile/components/edit-profile-sheet";
import { PersonMoreMenu } from "@/features/profile/components/person-more-menu";
import { WinkButton } from "@/features/profile/components/wink-button";
import { VerificationCard } from "@/features/profile/components/verification-card";
import { CreatorCard } from "@/features/profile/components/creator-card";
import { AccountTabs, type AccountTab } from "@/features/profile/components/account-tabs";
import { MARKET_FLAGS } from "@/lib/market-config";
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
  kashSlot,
  housesSlot,
  giftGallerySlot,
  composeSlot,
  postSlot,
  mediaViewerSlot,
}: {
  username: string;
  /** Composed from outside — profile never imports the messages slice. */
  messageSlot?: (profile: Profile) => React.ReactNode;
  /**
   * The Houses rail (534:15577), also the messages slice's — a house IS a group
   * conversation. Own profile only: `GET /me/conversations` is the only route
   * that answers this, and there is none for the houses somebody ELSE belongs
   * to, so a visitor gets no rail rather than an empty one.
   */
  housesSlot?: React.ReactNode;
  /**
   * The gift gallery — node 492:41810. It counts the viewer's own received
   * tips, so it lives in the tips slice and arrives as a slot; profile and
   * tips never import each other.
   */
  giftGallerySlot?: React.ReactNode;
  /** The balance chip on the cover (435:27523) — the kash slice's, own profile
   *  only, because there is no route for anybody else's balance and there
   *  should not be. */
  kashSlot?: React.ReactNode;
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
  /**
   * The ACCOUNT strip's selection, separate from `tab` above — the two strips
   * are different questions and must not share one value. Gift Gallery is the
   * one the file draws active and the only one with a panel behind it.
   */
  const [accountTab, setAccountTab] = useState<AccountTab>("gifts");
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

  /*
    Share the PROFILE — the same shape the post card uses: the platform sheet
    where there is one, the clipboard where there is not, and a dismissed sheet
    is not an error.
  */
  const onShare = async () => {
    const url = `${window.location.origin}/u/${data.username}`;
    try {
      if (navigator.share) await navigator.share({ text: data.displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed share sheets are not errors */
    }
  };

  return (
    <>
      {/*
        NODE 435:27500 — ONE CARD, not three bands.

        It was X's shape: a ColumnHeader naming the person, a full-bleed banner
        under it, then an avatar hanging off the banner's lower edge into the
        content. The file draws a single 741x473 card at a 20 radius with the
        photograph filling it and the identity laid over its foot — so the name,
        the handle and the actions sit ON the cover rather than in a strip above
        it and a row below it.

        `ProfileCover` owns the card; the actions and the meta row are passed in
        because who you are looking at decides both.
      */}
      <div className="px-8 pt-6">
        <ProfileCover
          profile={data}
          /* 435:27521 — the row beside the handle. The balance chip is the
             kash slice's and arrives as a slot; "Who viewed my profile" is not
             drawn, see the note on `ProfileCover`. */
          meta={isMe ? kashSlot : null}
          actions={
            isMe ? (
              <>
                {/*
                  435:27531 and 435:27534 — a 38.4 disc and a 129x38 pill, and
                  BOTH report a white stroke at weight ZERO, which renders
                  nothing. The material is `ws-glass-pill`, the same recessed
                  lens the room's header and the post's more-menu use, not a
                  hairline ring.
                */}
                <button
                  type="button"
                  onClick={onShare}
                  aria-label="Share this profile"
                  className="ws-glass-pill ws-press flex h-[38px] w-[38px] items-center justify-center rounded-full text-white"
                >
                  <IconRoomShare className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="ws-glass-pill ws-press flex h-[38px] items-center gap-2 rounded-full px-4 text-[15px] leading-6 text-white transition-opacity hover:opacity-90"
                >
                  <IconMsEdit className="h-4 w-4 shrink-0" />
                  Edit Profile
                </button>
              </>
            ) : (
              <>
                <PersonMoreMenu profile={data} size="md" />
                <WinkButton profile={data} size="md" />
                {messageSlot?.(data)}
                <FollowButton profile={data} />
              </>
            )
          }
        />
      </div>

      {/*
        WHAT THE COVER DOES NOT CARRY.

        The name, the handle, the badges and the actions moved ONTO the card
        (435:27503) — this block used to draw all of them a second time, under
        it. What is left is the part 414:24935 puts below the cover: the bio,
        the place, and the two counts.
      */}
      {/*
        NODE 414:24935 — bio, counts, place. 741 wide on a 16 rhythm.

        The name, handle, badges and actions moved ONTO the cover (435:27503);
        this block used to draw all of them a second time underneath. What the
        file leaves here is three lines.
      */}
      <div className="flex flex-col gap-4 px-8 pt-6">
        {/*
          THE FILE PRINTS A LINE WHEN THERE IS NO BIO — "Bio not updated" at
          50% white, where a written one is the same size in full white. Empty
          is a state worth showing on your OWN profile, because it is a thing to
          go and fix; on somebody else's it is just a fact about them. Either
          way it is the person's own words or the absence of them, never a
          placeholder pretending to be either.
        */}
        <p
          className={
            data.bio
              ? "text-[15px] leading-5 text-white"
              : "text-[15px] leading-5 text-white/50"
          }
        >
          {data.bio || "Bio not updated"}
        </p>

        {/* 414:24943 — the count at Geist 600 15/20 in #F7F9F9, its label at
            400 in 50% white, 4 between them and 16 between the pair. The
            separator is the file's own, not a bullet we invented. */}
        <p className="tnum flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] leading-5">
          <span className="flex items-center gap-1">
            <span className="font-semibold text-grey-100">
              {formatCount(data.followingCount)}
            </span>
            <span className="text-white/50">Following</span>
          </span>
          <span aria-hidden className="text-grey-100">
            ·
          </span>
          <span className="flex items-center gap-1">
            <span className="font-semibold text-grey-100">
              {formatCount(data.followerCount)}
            </span>
            <span className="text-white/50">Followers</span>
          </span>
        </p>

        {/*
          THE PLACE THIS PERSON PUBLISHED — 418:25221, a 24px glyph and the
          text at 15/20 in FULL white, not the 13px meta line it was. The file
          gives it the same weight as the bio above it, which is right: it is
          something they said about themselves rather than a caption.

          Rendered only when they said something. Null means "hasn't said",
          which is not a blank to fill with an em-dash or a guess.

          A place, never a distance: there is no "3 km away" here and no field
          for one. See `lib/people-filters.ts`.

          NO LINK ROW. 418:25223 draws a website beside the place, and
          `PublicProfile` carries no URL of any kind — checked against the live
          contract. Requested; the row appears when the field does.
        */}
        {(data.city || data.region || data.gender) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] leading-5 text-white">
            {(data.city || data.region) && (
              <span className="flex items-center gap-2">
                <IconLocationPin className="h-6 w-6 shrink-0 text-create" />
                {/* "Ikeja, Lagos" from whichever halves they gave. */}
                {[data.city, data.region].filter(Boolean).join(", ")}
              </span>
            )}
            {data.gender && <span className="text-white/50">{data.gender}</span>}
          </p>
        )}
      </div>

      {/* 534:15577 — the houses this person keeps, 38 under the block above. */}
      {isMe && housesSlot && <div className="px-8 pt-9">{housesSlot}</div>}

      {/* Own-profile business: creator application and verification live above
          the tabs, where they read as account state rather than content.

          NO RULE ABOVE IT. It carried a full-width `border-t`, which drew a
          line straight across the page between the houses rail and the Creator
          card — the one divider on a page that is otherwise a stack of
          outlined cards on open ground. Both cards already have their own
          border, so the rule was separating things that were separated, and it
          cut the column at a point the file draws nothing.

          `px-8` to match, not `px-4`: every other block on this page — the
          cover, the bio, the houses — is inset 32, so these two cards hung 16px
          wider than the rail directly above them. */}
      {isMe && (
        <div className="space-y-3 px-8 pb-4 pt-9">
          <CreatorCard role={data.role} />
          <VerificationCard />
        </div>
      )}

      {/*
        NODE 492:47030 — the ACCOUNT strip and its panel.

        Own-profile only, and every tab is the reason why: earnings, badges,
        gifts received and your own replays are all statements about your
        account, and the two routes behind any of them (`/me/tips/received`,
        and the KASH engine) are `/me` routes. The same frame in the file also
        carries "Add new house" and "Edit Profile", which are only ever yours.

        THREE OF THE FOUR TABS ARE INERT, and each for a different, checked
        reason rather than because they were awkward:

         · Earnings — `GET /me/tips/received` EXISTS and is real (it is what
           feeds the gallery's counts). What does not exist is a design for the
           panel: this node draws the gift grid, not an earnings view, so the
           tab is held rather than filled with something invented.
         · Badges — no route at all. The served spec's only badge path is
           `/admin/profiles/{id}/org-badge`, which ASSIGNS one; there is
           nothing that lists what somebody has earned.
         · Replays — `MARKET_FLAGS.replays`, off because LiveKit egress and a
           storage bucket are not provisioned, so `replayUrl` is null on every
           stream. The flag makes the surface reappear; it cannot make the
           recordings exist.

        Visible and disabled, per the standing rule — deleting them loses the
        roadmap, leaving them live tells the reader a lie.
      */}
      {isMe && giftGallerySlot && (
        <div className="pt-6">
          <AccountTabs
            tabs={[
              { value: "earnings", label: "Earnings", disabledReason: "No panel for this yet" },
              { value: "badges", label: "Badges", disabledReason: "Not available yet" },
              { value: "gifts", label: "Gift Gallery" },
              {
                value: "replays",
                label: "Replays",
                disabledReason: MARKET_FLAGS.replays ? undefined : "Soon",
              },
            ]}
            value={accountTab}
            onChange={setAccountTab}
          />
          {accountTab === "gifts" && giftGallerySlot}
        </div>
      )}

      {/* Two stickies on one page: the header above pins first, so the tabs
          have to pin BELOW it — the shell's fixed top strip plus the header's
          own measured height. At `top-0` with a lower z-index they stuck
          straight underneath both and vanished, so a scrolled profile had no
          way left to switch tab. */}
      <div className="ws-hair sticky top-[calc(var(--ws-topbar-h)_+_var(--ws-colhead-h))] z-20 border-b bg-chrome">
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