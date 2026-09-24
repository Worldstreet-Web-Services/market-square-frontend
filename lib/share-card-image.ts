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
 * ─── THREE OUTCOMES, IN ORDER OF HOW GOOD THEY ARE ──────────────────────────
 *  1. SHARED AS A FILE. `navigator.share({ files })` — the picture goes into
 *     the chooser and the recipient gets an image. Only where the browser both
 *     has the API and says it can take THIS file: `canShare` is checked with
 *     the actual file rather than for the function's existence, because iOS
 *     Safari has `share` but refuses files in some versions and the refusal
 *     arrives as a rejected promise halfway through the gesture.
 *  2. SHARED AS A LINK. No file support: fall back to the URL, which is what
 *     the app did before and is still useful.
 *  3. DOWNLOADED. No share sheet at all — desktop, mostly. The picture is
 *     saved so it can be attached by hand.
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

  if (typeof nav.share === "function") {
    try {
      await nav.share({ url, title, text });
      return "linked";
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
    }
  }

  // No share sheet. Save the picture so it can be attached by hand — which is
  // the desktop story, and is better than copying a link the person did not
  // ask for.
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
      return "failed";
    }
  }

  return "failed";
}
