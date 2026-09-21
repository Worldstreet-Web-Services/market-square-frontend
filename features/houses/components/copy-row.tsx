"use client";

import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { IconCopy, IconCopyBulk, IconLink } from "@/components/ui/icons";
import { groupRoomCode } from "@/lib/room-code";

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

/**
 * THE SPOKEN CODE, in the same row idiom as the links beside it.
 *
 * A separate component rather than a flag on `CopyRow`, because almost nothing
 * about the row survives the change: a code is READ ALOUD, so it is set large
 * and grouped and must never truncate, where a link is set small and always
 * truncates. Sharing one signature between those would be a `url` that is not
 * a url and a branch in every line of the body.
 *
 * WHAT IS SHOWN AND WHAT IS COPIED ARE DIFFERENT STRINGS, deliberately. The
 * service stores and matches the code unseparated; `bcd-fghj-km` is grouping
 * for the eye, which `lib/room-code.ts` is explicit is "display only; never
 * sent back". So the dashes go on screen and the bare code goes to the
 * clipboard — paste it into the join field and it resolves, which it would not
 * if we copied what was drawn.
 */
export function CopyCodeRow({ label, hint, code }: { label: string; hint?: string; code: string }) {
  return (
    <div className="py-2">
      <p className="text-[13px] font-semibold text-heading">{label}</p>
      {hint && <p className="mb-1.5 mt-0.5 text-[11px] leading-4 text-meta">{hint}</p>}
      <button
        onClick={() =>
          void navigator.clipboard.writeText(code).then(() => toast.success("Code copied"))
        }
        className="ws-inset flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <span className="tnum min-w-0 flex-1 text-[15px] font-semibold tracking-[0.08em] text-white">
          {groupRoomCode(code)}
        </span>
        <IconCopy className="h-4 w-4 shrink-0 text-grey-500" />
      </button>
    </div>
  );
}

/**
 * THE CODE INLINE, where a room's own header already says who is in it.
 *
 * A row in a sheet is one tap too deep for the thing a listener wants while
 * sitting in a room ("they cant see it in the gist room"), so the code also sits
 * on the header's line. Tapping it copies — and like `CopyCodeRow` it copies the
 * BARE code while showing the grouped one, because grouping is display only and
 * a copied `bcd-fghj-km` would fail in the join field.
 *
 * It stops the click from reaching anything around it: this sits inside
 * surfaces that are themselves tappable.
 */
export function CopyCodeChip({ code, className }: { code: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(code).then(() => toast.success("Code copied"));
      }}
      aria-label={`Copy room code ${groupRoomCode(code)}`}
      className={cn(
        // 1775:20269 — the code text and the copy glyph on an 8px gap, the icon
        // in the file's 24px box (a 16px glyph centred), inheriting the meta
        // line's muted colour and brightening with the rest on hover.
        "ws-press inline-flex items-center gap-2 rounded-md transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
    >
      <span>
        Code{" "}
        <span className="tnum font-semibold tracking-[0.08em] text-white">{groupRoomCode(code)}</span>
      </span>
      <IconCopyBulk className="h-6 w-6 shrink-0" />
    </button>
  );
}
