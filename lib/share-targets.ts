/**
 * WHERE A POST CAN BE SHARED, and the exact link each place wants.
 *
 * The pattern every social app uses: the share is the post's own words plus
 * its permalink, handed to the destination's share endpoint so the person
 * lands in a composer with both already in it — WhatsApp's `wa.me/?text=`,
 * X's tweet intent, Facebook's sharer, Telegram's share URL. Copying the link
 * and the device's native sheet sit beside them.
 *
 * Pure, so the encoding is pinned: a `#hashtag` in the text must survive as
 * `%23`, a newline as `%0A`, and the permalink must arrive whole. Which rows
 * appear is the caller's (native share exists only where the browser says).
 */
export type ShareTarget = "whatsapp" | "x" | "facebook" | "telegram";

export interface SharePayload {
  /** The post's own text, as written. Empty for a media-only post. */
  text: string;
  /** The absolute permalink. */
  url: string;
}

/** The text and link together, the way a chat app wants them pasted. */
export function shareMessage({ text, url }: SharePayload): string {
  const body = text.trim();
  return body ? `${body}\n\n${url}` : url;
}

export function shareUrl(target: ShareTarget, payload: SharePayload): string {
  const text = payload.text.trim();
  switch (target) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(shareMessage(payload))}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodeURIComponent(payload.url)}${
        text ? `&text=${encodeURIComponent(text)}` : ""
      }`;
    case "x":
      return `https://twitter.com/intent/tweet?${text ? `text=${encodeURIComponent(text)}&` : ""}url=${encodeURIComponent(payload.url)}`;
    case "facebook":
      // The sharer takes the URL only; the text comes from the page's own
      // Open Graph tags when it unfurls.
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`;
  }
}

export const SHARE_TARGETS: { target: ShareTarget; label: string }[] = [
  { target: "whatsapp", label: "WhatsApp" },
  { target: "x", label: "X" },
  { target: "facebook", label: "Facebook" },
  { target: "telegram", label: "Telegram" },
];
