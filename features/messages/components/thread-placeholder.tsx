"use client";

import Image from "next/image";

/**
 * What the thread pane shows before a conversation is opened.
 *
 * The design's own illustration and copy. Centred in the pane rather than
 * pinned to the file's absolute y — 322 of 948 is optical centring for one
 * fixed height, and this pane is whatever height the viewport gives it.
 *
 * ─── WHY THIS IS NOT `EmptyPanel` ───────────────────────────────────────────
 * They look alike and they are not the same object. `EmptyPanel` (543:45867) is
 * the app's empty state: a 120 illustration, a 20/23.44 title and a primary
 * action, for a surface that has nothing on it yet. This is the resting state
 * of a two-pane layout — the list beside it is full, nothing has gone wrong,
 * and there is no action to offer because the action is "pick one of those".
 * So it is bigger and quieter: 200 illustration, 24/32, no button.
 *
 * They share the artwork, at two sizes, and that is the design's own doing —
 * `/messages/empty-illustration.svg` and `/empty-illustration.svg` are the same
 * mark exported at 200 and 120.
 */
export function ThreadPlaceholder() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-6">
      <div className="flex w-[352px] max-w-full flex-col items-center gap-10">
        <Image
          src="/messages/empty-illustration.svg"
          alt=""
          width={200}
          height={200}
          priority
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[24px] font-bold leading-8 tracking-[0.01em] text-white">
            Pick up where you left
          </h2>
          <p className="text-[16px] font-normal leading-6 text-white/50">
            Click on any chats to continue chatting with them.
          </p>
        </div>
      </div>
    </div>
  );
}
