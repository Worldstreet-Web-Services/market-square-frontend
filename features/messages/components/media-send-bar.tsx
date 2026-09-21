"use client";

import { cn } from "@/lib/cn";
import { IconSend } from "@/components/ui/icons";
import { MESSAGE_MAX } from "@/features/messages/lib/types";

/**
 * THE SEND ROW under a full-screen media preview — the camera's review and the
 * gallery's image/video preview share it, so the two never drift.
 *
 * One clean row: the caption field with the view-once mark inside it, then Send.
 * The mark is the "1" glyph — a dashed ring when the shot stays in the chat, a
 * solid white disc with a black 1 when it is seen-once — icon-only on a phone,
 * an icon-plus-label pill from `md` up. It is shown only where view-once applies
 * (`showViewOnce`: an image or clip in a one-to-one), never on a document or in
 * a group.
 *
 * The `min-h` reserves the camera shutter row's height so the media box above
 * keeps the same size in the viewfinder and the review, and the shot never jumps
 * when it is taken.
 */
export function MediaSendBar({
  caption,
  onCaptionChange,
  viewOnce,
  onToggleViewOnce,
  showViewOnce,
  onSend,
  sending,
  autoFocusCaption,
}: {
  caption: string;
  onCaptionChange: (value: string) => void;
  viewOnce: boolean;
  onToggleViewOnce: () => void;
  showViewOnce: boolean;
  onSend: () => void;
  sending?: boolean;
  autoFocusCaption?: boolean;
}) {
  return (
    <div className="flex min-h-[108px] shrink-0 items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/10 px-4 py-3">
        <input
          type="text"
          value={caption}
          onChange={(event) => onCaptionChange(event.target.value.slice(0, MESSAGE_MAX))}
          maxLength={MESSAGE_MAX}
          placeholder="Add a caption..."
          aria-label="Caption"
          autoFocus={autoFocusCaption}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/60"
        />
        {showViewOnce && (
          <button
            type="button"
            onClick={onToggleViewOnce}
            aria-pressed={viewOnce}
            aria-label={viewOnce ? "Seen once — tap to keep in the chat" : "Kept in the chat — tap to make it seen once"}
            title={viewOnce ? "Seen once" : "Kept in the chat"}
            // Icon only on a phone; a labelled pill from md up.
            className="ws-press flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-white md:w-auto md:bg-white/10 md:px-3"
          >
            {viewOnce ? (
              <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 shrink-0">
                <circle cx="12" cy="12" r="10" fill="#fff" />
                <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill="#000">
                  1
                </text>
              </svg>
            ) : (
              <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.3} strokeDasharray="2 2.4" strokeLinecap="round" />
                <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="currentColor">
                  1
                </text>
              </svg>
            )}
            <span className="hidden whitespace-nowrap text-[13px] font-medium md:inline">
              {viewOnce ? "View once" : "Keep in chat"}
            </span>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        aria-label="Send"
        className={cn(
          "ws-btn-create ws-press flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90",
          sending && "opacity-50"
        )}
      >
        <IconSend className="h-5 w-5" />
      </button>
    </div>
  );
}
