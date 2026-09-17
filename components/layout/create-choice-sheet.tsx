"use client";

import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { IconMic, IconPlus } from "@/components/ui/icons";
import { sq } from "@/lib/square-path";

/**
 * WHAT ARE YOU MAKING — a post, or a gist room.
 *
 * QA: "When users click on the plus (create) icon in the menu docker, there
 * should be a pop up for them to select whether they want to create a post or
 * gistroom." The dock's plus used to open the post composer outright, so
 * starting a room from the dock meant knowing to go to Home's banner or the
 * rooms page first.
 *
 * Both choices go to what already exists rather than to a second copy of it:
 * a post opens the shell's one composer in place (the page underneath is
 * kept), and a room goes to `/gist-rooms?open=1`, the same address the
 * sidebar's "Start Gistroom" uses, which opens the room
 * sheet on arrival. Composed here in `components/layout` because it joins the
 * shell's composer to the rooms route, which no slice may do.
 */
export function CreateChoiceSheet({
  open,
  onClose,
  onPost,
}: {
  open: boolean;
  onClose: () => void;
  /** Opens the post composer. Supplied by the shell, which owns it. */
  onPost: () => void;
}) {
  const router = useRouter();
  // The share sheet's row recipe, so the two pop-ups read as one family.
  const row =
    "ws-press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.06]";
  const disc = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white";

  return (
    <Sheet open={open} onClose={onClose} title="Create">
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className={row}
          onClick={() => {
            onClose();
            onPost();
          }}
        >
          <span className={disc}>
            <IconPlus className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-heading">Post</span>
            <span className="text-[13px] text-meta">Share an update, a photo or a video</span>
          </span>
        </button>
        <button
          type="button"
          className={row}
          onClick={() => {
            onClose();
            router.push(sq("/gist-rooms?open=1"));
          }}
        >
          <span className={disc}>
            <IconMic className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-heading">Gist room</span>
            <span className="text-[13px] text-meta">Talk live with whoever drops in</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
