"use client";

import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { IconShareFacebook, IconShareTelegram, IconShareWhatsApp, IconShareX } from "@/components/ui/share-icons";
import { IconMsShare } from "@/components/ui/design-icons";
import { IconLink } from "@/components/ui/icons";
import { SHARE_TARGETS, shareUrl, type SharePayload, type ShareTarget } from "@/lib/share-targets";
import { withShareChannel } from "@/lib/utm";

/**
 * SHARE — a post, a profile — to WhatsApp, X, Facebook, Telegram, the
 * clipboard, or the device's own sheet. Shared UI, so every slice shares the
 * same way ("share in the profile should work just like the feed").
 *
 * It used to be one tap: the native sheet where the browser had one, else a
 * silent copy of the link. Desktop browsers mostly have no native sheet, so
 * on a laptop "share" meant "the link is on your clipboard now", and nobody
 * could put a post into a WhatsApp group the way every other social app lets
 * them. This sheet is that: each row hands the post's WORDS and its LINK to
 * the destination's share endpoint (`lib/share-targets`), so the reader lands
 * in that app's composer with both already in place.
 *
 * The native sheet is still offered, first, wherever the browser has one —
 * it reaches apps this list cannot name.
 */
const GLYPH: Record<ShareTarget, React.ComponentType<{ className?: string }>> = {
  whatsapp: IconShareWhatsApp,
  x: IconShareX,
  facebook: IconShareFacebook,
  telegram: IconShareTelegram,
};

export function ShareSheet({
  open,
  onClose,
  payload,
  title = "Share post",
}: {
  open: boolean;
  onClose: () => void;
  payload: SharePayload;
  /** The sheet's heading: "Share post", "Share profile". */
  title?: string;
}) {
  const canNative = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const native = async () => {
    onClose();
    try {
      await navigator.share({ text: payload.text, url: withShareChannel(payload.url, "native_share") });
    } catch {
      /* dismissed share sheets are not errors */
    }
  };

  const copy = async () => {
    onClose();
    try {
      await navigator.clipboard.writeText(withShareChannel(payload.url, "copy_link"));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const row =
    "ws-press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-heading transition-colors hover:bg-white/[0.06]";

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1">
        {canNative && (
          <button type="button" onClick={() => void native()} className={row}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white">
              <IconMsShare className="h-5 w-5" />
            </span>
            Share via…
          </button>
        )}
        {SHARE_TARGETS.map(({ target, label }) => {
          const Glyph = GLYPH[target];
          return (
            <a
              key={target}
              href={shareUrl(target, { ...payload, url: withShareChannel(payload.url, target) })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={row}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white">
                <Glyph className="h-5 w-5" />
              </span>
              {label}
            </a>
          );
        })}
        <button type="button" onClick={() => void copy()} className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white">
            <IconLink className="h-5 w-5" />
          </span>
          Copy link
        </button>
      </div>
    </Sheet>
  );
}
