"use client";

import Link from "next/link";
import { IconX } from "@/components/ui/icons";
import { useAnnouncements, useDismissAnnouncement } from "@/hooks/use-announcements";
import { useAuth } from "@/hooks/use-auth";
import { isHttpUrl } from "@/lib/http-url";

/**
 * WHAT THE PLATFORM IS SAYING, ABOVE EVERYTHING ELSE.
 *
 * ─── WHY IT IS A BAND AND NOT A POST ─────────────────────────────────────────
 * ogazboiz asked for announcements to come "first". First means first on Home,
 * not first among the posts: a platform message dropped into a ranked lane, or
 * slid sideways among people's posts, makes "why am I seeing this?"
 * unanswerable — and it would inherit replies, likes and an author it does not
 * have. So it sits above the column, in its own band, and never enters the
 * feed or the rail.
 *
 * ─── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
 *  · It never names the admin who made it. An announcement reads as coming
 *    from the platform; naming an operator turns a platform decision into a
 *    person to argue with, and on the shared-key path there IS no name.
 *  · It never renders a post it was not given. `post` is absent rather than a
 *    placeholder when the post was deleted, moderated or has expired, so the
 *    announcement quietly loses its attachment instead of announcing that
 *    something was taken down.
 *  · A signed-out reader gets no close button. Dismissing has to be remembered
 *    for somebody, and a control that 401s is worse than none.
 */
export function AnnouncementBand() {
  const { items, unavailable } = useAnnouncements();
  const dismiss = useDismissAnnouncement();
  const { authenticated } = useAuth();

  // Not deployed, nothing running, or all of it already closed — no band.
  if (unavailable || items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-4 md:px-0">
      {items.map((item) => {
        const body = (
          <span className="flex min-w-0 flex-1 items-center gap-3">
            {/* The announced post's own picture, when it still has one. */}
            {item.post?.mediaKind === "image" && item.post.mediaUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
              <img
                src={item.post.mediaUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-[10px] object-cover"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] leading-5 text-white">{item.body}</span>
              {/* Trust `post`, never `postId`: the id can outlive a post that
                  can no longer be shown. */}
              {item.post?.text && (
                <span className="mt-0.5 block truncate text-[13px] leading-5 text-white/50">
                  {item.post.text}
                </span>
              )}
            </span>
          </span>
        );

        return (
          <div
            key={item.id}
            role="status"
            className="flex items-center gap-3 rounded-[16px] bg-[linear-gradient(90deg,rgba(159,101,253,0.16)_0%,rgba(91,5,230,0.16)_100%)] p-3 shadow-[inset_0_0_0_1px_rgba(159,90,255,0.35)]"
          >
            {/* The post it names beats an external link: a reader would rather
                land on the thing itself. */}
            {item.post ? (
              <Link href={`/p/${item.post.id}`} className="ws-press flex min-w-0 flex-1 items-center">
                {body}
              </Link>
            ) : isHttpUrl(item.linkUrl) ? (
              /* The link is typed by an admin and this band renders to
                 EVERYONE, signed out included, so a stored `javascript:` here
                 would run on our origin for every reader. http(s) only. */
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-press flex min-w-0 flex-1 items-center"
              >
                {body}
              </a>
            ) : (
              body
            )}

            {authenticated && (
              <button
                type="button"
                aria-label="Close announcement"
                onClick={() => dismiss.mutate(item.id)}
                className="ws-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
