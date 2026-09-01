"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPlay } from "@/components/ui/icons";
import { useProfilePosts } from "@/features/profile/hooks/use-profile";
import type { Post } from "@/lib/api/schemas";

/**
 * A person's media, and the thing you slide through.
 *
 * This is the replacement for the reels, and it is the honest half of that
 * trade: pulling the endless river out took browsing away, and this is what
 * gives it back — "if you need to see someone's picture, you have to go to
 * their profile, and then you can slide and see whatever they've got there."
 *
 * The difference is whose it is. A river is an algorithm's; a gallery belongs
 * to a person, and you arrived by choosing them. Same media, opposite posture.
 *
 * A GRID, not a list. Media is the one thing on a profile worth browsing by
 * eye rather than reading, and three columns is what lets a face be
 * recognisable at a glance while still fitting a phone.
 */
export function MediaTab({
  username,
  isMe,
  viewerSlot,
}: {
  username: string;
  isMe: boolean;
  /**
   * The full-screen swipeable viewer, composed by the route — profile never
   * imports the feed slice. It receives the media in grid order, so sliding
   * moves through exactly what was on screen.
   */
  viewerSlot: (items: Post[], openId: string, onClose: () => void) => React.ReactNode;
}) {
  const posts = useProfilePosts(username);
  const [openId, setOpenId] = useState<string | null>(null);

  /*
    Client-side, because the service has no media filter: `GET
    /profiles/{username}/posts` takes a cursor and a limit and nothing else.
    `useProfilePosts` is also a plain query rather than an infinite one, so
    this is the media in the FIRST page of their posts. Honest for a profile
    today and dishonest the day somebody has a thousand posts — that is the
    point at which this wants a `mediaKind` parameter and a paged hook, and
    this comment is the note saying why. Better a gallery that shows the
    recent than a "Load more" that cannot load one.
  */
  const media = useMemo(
    () => (posts.data?.items ?? []).filter((post) => post.mediaUrl),
    [posts.data]
  );

  if (posts.isPending) {
    return (
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    );
  }

  if (posts.isError) {
    return (
      <div className="p-4">
        <ErrorState
          error={posts.error}
          fallback="Couldn't load this gallery."
          onRetry={() => posts.refetch()}
        />
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          glyph="◇"
          title={isMe ? "Nothing here yet" : "No photos or videos"}
          body={
            isMe
              ? "Pictures and clips you post show up here, on your profile."
              : "When they post a picture or a clip, it will be here."
          }
        />
      </div>
    );
  }

  return (
    <>
      <ul className="grid list-none grid-cols-3 gap-0.5 p-0.5">
        {media.map((post) => (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => setOpenId(post.id)}
              aria-label={post.text ? `Open: ${post.text.slice(0, 60)}` : "Open media"}
              className="ws-press group relative block aspect-square w-full overflow-hidden bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <Image
                src={post.thumbnailUrl ?? post.mediaUrl!}
                alt=""
                fill
                sizes="(min-width: 1024px) 200px, 33vw"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
              {isVideo(post) && (
                // The one thing a still frame cannot say about itself.
                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 p-1">
                  <IconPlay className="h-3 w-3 text-white" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>


      {openId && viewerSlot(media, openId, () => setOpenId(null))}
    </>
  );
}

/**
 * The service types its own media; the extension is only a fallback, and a
 * signed CDN link often has no extension at all.
 */
function isVideo(post: Pick<Post, "mediaKind" | "mediaUrl">): boolean {
  if (post.mediaKind) return post.mediaKind === "video";
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(post.mediaUrl ?? "");
}
