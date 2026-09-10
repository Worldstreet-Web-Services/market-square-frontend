/**
 * SHARE A URL THE WAY THE DEVICE PREFERS.
 *
 * `navigator.share` opens the phone's own sheet — WhatsApp, Messages, AirDrop
 * — which on a phone is the only sharing anybody actually wants. It does not
 * exist on most desktop browsers, so the fallback copies the link and says so.
 *
 * Extracted at the FIFTH call site, not the second: the stream room, the
 * cockpit, the green room and a chat thread each wrote this out, and the wink
 * card would have been the fifth. Four copies of a browser-capability check is
 * exactly the shape that drifts — one of them silently doing nothing on a
 * desktop because somebody forgot the `else`.
 *
 * ─── A CANCELLED SHARE IS NOT AN ERROR ──────────────────────────────────────
 * Dismissing the share sheet rejects the promise with `AbortError`. Reporting
 * that would tell somebody their deliberate "no thanks" had failed. Only a
 * genuine failure falls through to the copy, and if the clipboard is refused
 * too — Safari does that without a user gesture — the caller is told, because
 * at that point nothing has happened and silence would be a lie.
 */
export async function shareLink(
  { url, title, text }: { url: string; title?: string; text?: string },
  {
    onCopied,
    onFailed,
    navigatorImpl = typeof navigator === "undefined" ? undefined : navigator,
  }: {
    onCopied?: () => void;
    onFailed?: () => void;
    /** Injected so the branches can be pinned without a browser. */
    navigatorImpl?: Pick<Navigator, "share" | "clipboard"> | undefined;
  } = {}
): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const nav = navigatorImpl;
  if (!nav) return "failed";

  if (typeof nav.share === "function") {
    try {
      await nav.share({ url, title, text });
      return "shared";
    } catch (error) {
      // The person closed the sheet. Nothing failed and nothing should be said.
      if ((error as { name?: string } | null)?.name === "AbortError") return "cancelled";
      // Anything else falls through to the clipboard rather than giving up.
    }
  }

  try {
    await nav.clipboard.writeText(url);
    onCopied?.();
    return "copied";
  } catch {
    onFailed?.();
    return "failed";
  }
}
