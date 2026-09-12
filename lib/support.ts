/**
 * The official support account on Square — "TsionArk Support"
 * (@tsionarksupport, verified on production).
 *
 * Settings → Help Centre → Contact us opens a chat with it. It is named by
 * USERNAME and resolved through the public profile read, never by a hard-coded
 * id: ids differ between environments, and a server without the account just
 * leaves the row inert.
 */
export const SUPPORT_USERNAME = "tsionarksupport";

/**
 * Support's email — the address the official support account publishes in its
 * own bio on production ("📧 Support: support@tsionark.com"), so it is theirs
 * to state, not ours to guess.
 */
export const SUPPORT_EMAIL = "support@tsionark.com";
