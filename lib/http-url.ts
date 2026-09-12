/**
 * Is this a URL a public page may put in an `href`?
 *
 * The profile's website (545:47631) is typed by the person and rendered on a
 * page strangers read. The service accepts http(s) only on write, and this
 * re-checks on read rather than trusting it: a stored `javascript:` link
 * would execute under the author's name for everyone who tapped it.
 */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
