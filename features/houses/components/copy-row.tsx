"use client";

import { toast } from "sonner";
import { IconCopy, IconLink } from "@/components/ui/icons";

/**
 * A labelled link somebody can copy.
 *
 * Invite links are named IN WORDS rather than hidden inside a chair, because
 * a host inviting a specific person is doing something deliberate and needs to
 * know which of the two links they just copied. The green room's row idiom,
 * with a label added — there, the surrounding screen already said what the
 * link was for; here there are two of them side by side.
 */
export function CopyRow({ label, hint, url }: { label: string; hint?: string; url: string }) {
  return (
    <div className="py-2">
      <p className="text-[13px] font-semibold text-heading">{label}</p>
      {hint && <p className="mb-1.5 mt-0.5 text-[11px] leading-4 text-meta">{hint}</p>}
      <button
        onClick={() =>
          void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))
        }
        className="ws-inset flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <IconLink className="h-4 w-4 shrink-0 text-grey-500" />
        <span className="min-w-0 flex-1 truncate text-xs text-grey-300">{url}</span>
        <IconCopy className="h-4 w-4 shrink-0 text-grey-500" />
      </button>
    </div>
  );
}
