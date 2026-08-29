"use client";

import { useState } from "react";
import { TipSheet } from "@/features/tips";
import type { Profile } from "@/lib/api/schemas";

/**
 * The post tip sheet on its own.
 *
 * Reaching it for real needs a post by somebody else, signed in, with tipping
 * deployed — three conditions a laptop rarely has at once. This renders it
 * against a stand-in recipient so the design can be read rather than trusted.
 */
export function TipPreview() {
  const [open, setOpen] = useState(true);

  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-sm text-meta">Post tip sheet — dev only.</p>
        <button
          onClick={() => setOpen(true)}
          className="ws-btn-create ws-press mt-4 rounded-full px-5 py-2.5 text-sm font-bold"
        >
          Open the sheet
        </button>
      </div>
      <TipSheet
        open={open}
        onClose={() => setOpen(false)}
        target={{
          kind: "post",
          id: "preview-post",
          // A stand-in profile, cast because this page exists to look at the
          // sheet rather than to exercise the schema.
          recipient: {
            id: "preview-user",
            username: "creator",
            displayName: "A Creator",
            avatarUrl: null,
          } as unknown as Profile,
        }}
      />
    </main>
  );
}
