"use client";

import Link from "next/link";

import { isVideoPost } from "@/lib/media";
import { formatCount } from "@/lib/format";
import type { VideoItem } from "@/lib/video-context";
import { Avatar } from "@/components/ui/avatar";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconChevronRight, IconEye, IconPlay, IconVolume } from "@/components/ui/icons";
import type { Stream } from "@/features/streams/lib/types";

/**
 * Explore's card grid.
 *
 * Widths come from the design (170.1px card, 165.5px thumbnail, 11.03px
 * radius, 12.87px column gap, 21px row gap) but are expressed as a responsive
 * grid rather than a fixed 719px row of four: the mock is a desktop frame, and
 * a phone cannot carry four 170px cards. Columns step 2 → 3 → 4 so a card
 * never falls below the width its avatar and meta row need.
 *
 * The grid carries three kinds of card and they lead three different places:
 * a LIVE stream opens `/live/:id` (a room — chat, tickets, a stage), a
 * recorded video opens the immersive viewer in place, and a picture opens its
 * permalink. That split is the whole point: a broadcast is not a reel, and a
 * still is not something you can scroll a player through.
 */
const CARD_RADIUS = "11.0332px";

export type ExploreItem =
  | { kind: "stream"; stream: Stream }
  | { kind: "media"; post: VideoItem };

/** The View Transition name a card and its opened slide share. */
export const videoMorphName = (postId: string) => `video-${postId}`;

/**
 * A live stream's audience.
 *
 * NOT the design's red/grey pill — that is a LIKE control (confirmed by the
 * designer) and lives on media cards, which are posts and can actually be
 * liked. A stream has no like endpoint, so its card carries the one number it
 * genuinely has: live viewers, with an eye glyph so the two pills can never be
 * mistaken for each other.
 *
 * `viewerCount` ONLY. `peakViewers` is a historical high-water mark; printing
 * it here would present an old number as a current audience.
 */
function ViewerPill({ stream }: { stream: Stream }) {
  const live = stream.status === "live" ? stream.viewerCount : null;
  if (live === null || live <= 0) return null;

  return (
    <span className="flex shrink-0 items-center gap-1 rounded-[5000px] bg-white/[0.09] px-2 py-1">
      <IconEye className="h-4 w-4 text-grey-400" />
      <span className="tnum text-[12px] leading-4 text-white">{formatCount(live)}</span>
    </span>
  );
}

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative aspect-[170/165] w-full overflow-hidden"
      style={{ borderRadius: CARD_RADIUS }}
    >
      {children}
    </div>
  );
}

function StreamCard({ stream }: { stream: Stream }) {
  const owner = stream.owner;

  return (
    <Link href={`/live/${stream.id}`} className="group flex flex-col gap-[7.36px]">
      <CardFrame>
        {/* A missing thumbnail gets the seeded gradient, never a blank tile. */}
        <GradientThumb seed={stream.id} className="absolute inset-0 h-full w-full">
          {stream.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
            <img
              src={stream.thumbnailUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </GradientThumb>

        {/* Creator avatar, inset from the top-left as the design places it. */}
        {owner && (
          <span className="absolute left-[11px] top-[11px]">
            <Avatar name={owner.displayName} seed={owner.id} src={owner.avatarUrl} size={36} />
          </span>
        )}

        {/* Audio indicator. The design's own glyph could not be fetched, so
            this is the house speaker icon at the spec's size and position. */}
        {stream.status === "live" && (
          <span className="absolute bottom-[11px] right-[11px] flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-sm">
            <IconVolume className="h-3 w-3 text-white" />
          </span>
        )}
      </CardFrame>

      <div className="flex h-6 items-center gap-[10px]">
        {/* Never a fabricated name: with no hydrated owner the slot stays empty
            rather than printing an id or a placeholder. */}
        <span className="min-w-0 flex-1 truncate text-[11.0332px] font-bold leading-[15px] text-white">
          {owner?.displayName ?? ""}
        </span>
        <ViewerPill stream={stream} />
      </div>
    </Link>
  );
}

function MediaCard({
  post,
  onOpen,
  renderLike,
  /**
   * The card holds the morph name whenever its video is NOT open, and the
   * opened slide holds it while it is. That single rule gives the View
   * Transition a clean hand-off in both directions — card → slide on open,
   * slide → card on close — without any extra state, and without ever letting
   * two elements share one name, which aborts the transition outright.
   */
  named,
}: {
  post: VideoItem;
  onOpen: (post: VideoItem) => void;
  named: boolean;
  /** The like control, from the feed slice — slices never import each other. */
  renderLike: (post: VideoItem) => React.ReactNode;
}) {
  const author = post.author;
  const isVideo = isVideoPost(post);

  const art = (
    <>
      <CardFrame>
        <div
          className="absolute inset-0"
          style={named && isVideo ? { viewTransitionName: videoMorphName(post.id) } : undefined}
        >
          {/* A missing thumbnail gets the seeded gradient, never a blank tile.
              A picture is its own artwork; a clip falls back to its poster. */}
          <GradientThumb seed={post.id} className="absolute inset-0 h-full w-full">
            {(post.thumbnailUrl ?? (isVideo ? null : post.mediaUrl)) && (
              // eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown
              <img
                src={post.thumbnailUrl ?? post.mediaUrl ?? ""}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </GradientThumb>
        </div>

        {author && (
          <span className="absolute left-[11px] top-[11px]">
            <Avatar name={author.displayName} seed={author.id} src={author.avatarUrl} size={36} />
          </span>
        )}

        {/* Only a clip reads as playable — a still must not promise a player. */}
        {isVideo && (
          <span className="absolute bottom-[11px] right-[11px] flex h-[21px] w-[21px] items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-sm">
            <IconPlay className="h-3 w-3 text-white" />
          </span>
        )}
      </CardFrame>

      {/* Meta row: 24px tall, 10px gap. The name flex-grows and truncates;
          the like pill takes its natural width and never shrinks. */}
      <div className="flex h-6 items-center gap-[10px]">
        {/* Never a fabricated name: with no hydrated author the slot stays
            empty rather than printing an id or a placeholder. */}
        <span className="min-w-0 flex-1 truncate text-[11.0332px] font-bold leading-[15px] text-white">
          {author?.displayName ?? ""}
        </span>
        {renderLike(post)}
      </div>
    </>
  );

  // A still has no scroll list to join, so it opens its permalink rather than
  // a player that would have nothing to play.
  if (!isVideo) {
    return (
      <Link href={`/p/${post.id}`} className="group flex flex-col gap-[7.36px]">
        {art}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      // The close scrolls the grid back to this card, so it needs a handle.
      data-explore-card={post.id}
      className="group flex flex-col gap-[7.36px] text-left"
      aria-label={post.text ? `Play video: ${post.text}` : "Play video"}
    >
      {art}
    </button>
  );
}

export function ExploreGrid({
  items,
  onOpenVideo,
  openVideoId,
  renderLike,
  onMore,
}: {
  items: ExploreItem[];
  onOpenVideo: (post: VideoItem) => void;
  /** The like control, injected by the screen from the feed slice. */
  renderLike: (post: VideoItem) => React.ReactNode;
  /** The video currently open in the viewer, if any — see `named` below. */
  openVideoId?: string | null;
  /** Renders the More pill when there is another page to ask for. */
  onMore?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-[21px]">
      <div className="grid grid-cols-2 gap-x-[12.87px] gap-y-[21px] sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) =>
          item.kind === "stream" ? (
            <StreamCard key={`stream-${item.stream.id}`} stream={item.stream} />
          ) : (
            <MediaCard
              key={`media-${item.post.id}`}
              post={item.post}
              onOpen={onOpenVideo}
              named={openVideoId !== item.post.id}
              renderLike={renderLike}
            />
          )
        )}
      </div>

      {onMore && (
        <button
          onClick={onMore}
          className="flex h-6 w-[70px] items-center justify-center gap-1 self-center rounded-[20000px] bg-[rgba(121,114,114,0.13)] text-[10px] font-medium text-[#5A5A5A] transition-colors hover:bg-white/10"
        >
          More
          <IconChevronRight className="h-4 w-4 rotate-90" />
        </button>
      )}
    </div>
  );
}
