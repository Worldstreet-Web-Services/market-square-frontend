"use client";

import Image from "next/image";
import { PanePlaceholder } from "@/components/ui/pane-placeholder";

/**
 * What the thread pane shows before a conversation is opened.
 *
 * The design's own illustration and copy, in `PanePlaceholder` — the shape this
 * surface established and which the gist rooms page now shares. Centred in the
 * pane rather than pinned to the file's absolute y: 322 of 948 is optical
 * centring for one fixed height, and this pane is whatever height the viewport
 * gives it.
 */
export function ThreadPlaceholder() {
  return (
    <PanePlaceholder
      art={
        <Image
          src="/messages/empty-illustration.svg"
          alt=""
          width={200}
          height={200}
          priority
        />
      }
      title="Pick up where you left"
      body="Click on any chats to continue chatting with them."
    />
  );
}
