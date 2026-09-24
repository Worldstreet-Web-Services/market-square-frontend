/**
 * SHARE A GENERATED CARD AS A PICTURE — the thing that actually lands in a
 * WhatsApp thread.
 *
 * `shareLink` shares a URL, and a URL in a chat is a grey rectangle somebody
 * has to trust before they tap it. A picture is the invitation: it shows the
 * room's cover, its name, when it starts and who is hosting, and it carries a
 * QR for anyone who sees it over a shoulder. ogazboiz, 2026-09-24: "share by
 * card so they can invite people".
 *
 * ─── THE ORDER IS "KEEP THE PICTURE", NOT "KEEP THE SHARE" ──────────────────
 *  1. SHARED AS A FILE. `navigator.share({ files })` — the picture goes into
 *     the chooser and the recipient gets an image. Only where the browser says
 *     it can take THIS file: `canShare` is asked with the actual file rather
 *     than for the function's existence, because iOS Safari has `share` but
 *     refuses files in some versions.
 *  2. DOWNLOADED. No file support — desktop, mostly. The card is SAVED so it
 *     can be attached by hand.
 *  3. SHARED AS A LINK, last, and only if the picture could not be produced at
 *     all.
 *
 * THE LINK USED TO COME SECOND AND THAT WAS WRONG. A desktop browser has
 * `share` and refuses files, so the fallback fired every time and quietly
 * shared a URL — the one thing this function exists to replace. Worse, it
 * SUCCEEDED, so nothing was said, and the button looked like it had done
 * nothing at all (ogazboiz, 2026-09-24: "why is the share not clicking
 * anymore"). A silent success that does the opposite of what was asked is
 * harder to find than a failure.
 *
 * ─── AND `navigator.share` NEEDS A LIVE GESTURE ─────────────────────────────
 * Awaiting the fetch first spends the transient user activation, so the share
 * call can reject with `NotAllowedError` through no fault of the person who
 * clicked. That is not an error worth showing them; it falls to the download,
 * which needs no activation and still hands them the card.
 *
 * A DISMISSED SHEET IS NOT A FAILURE. `AbortError` means the person changed
 * their mind, and telling them something went wrong when they pressed cancel
 * is the app arguing with them.
 */
export type ShareCardOutcome = "shared" | "linked" | "downloaded" | "cancelled" | "failed";

export async function shareCardImage(
  {
    imageUrl,
    fileName,
    url,
    title,
    text,
  }: {
    /** The generated card, e.g. `/api/room-card?…`. */
    imageUrl: string;
    fileName: string;
    /** Where the card points — the fallback when a file cannot be shared. */
    url: string;
    title?: string;
    text?: string;
  },
  {
    navigatorImpl = typeof navigator === "undefined" ? undefined : navigator,
    fetchImpl = typeof fetch === "undefined" ? undefined : fetch,
    createObjectURL = typeof URL === "undefined" ? undefined : URL.createObjectURL,
  }: {
    navigatorImpl?: Navigator;
    fetchImpl?: typeof fetch;
    createObjectURL?: (blob: Blob) => string;
  } = {}
): Promise<ShareCardOutcome> {
  const nav = navigatorImpl;
  if (!nav || !fetchImpl) return "failed";

  let file: File | null = null;
  try {
    const response = await fetchImpl(imageUrl);
    if (response.ok) {
      const blob = await response.blob();
      file = new File([blob], fileName, { type: blob.type || "image/png" });
    }
  } catch {
    // A card that would not render is not a reason to lose the share: the
    // link below still invites somebody to the same room.
    file = null;
  }

  if (file && typeof nav.share === "function") {
    const payload = { files: [file], title, text, url };
    // `canShare` with the FILE, not with the API — see the note above.
    if (typeof nav.canShare !== "function" || nav.canShare(payload)) {
      try {
        await nav.share(payload);
        return "shared";
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
        // Anything else falls through to the link rather than giving up.
      }
    }
  }

  // The card exists but could not be SHARED as a file: save it, so the person
  // still has the picture to attach. This needs no user activation, which is
  // why it is reachable even when the share call was refused for losing one.
  if (file && createObjectURL && typeof document !== "undefined") {
    try {
      const href = createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName;
      anchor.click();
      // Revoked on the next tick: revoking synchronously races the download in
      // Safari and lands an empty file.
      setTimeout(() => URL.revokeObjectURL(href), 0);
      return "downloaded";
    } catch {
      // Fall through to the link rather than leaving them with nothing.
    }
  }

  // LAST, and only when there is no picture to give. A link is what this
  // function replaced; reaching for it earlier is how the feature disappears.
  if (typeof nav.share === "function") {
    try {
      await nav.share({ url, title, text });
      return "linked";
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
    }
  }

  return "failed";
}
