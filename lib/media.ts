// Older payloads carry only a mediaUrl; renderers infer video by extension
// (the upload endpoint only issues mp4/webm for video).
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(\?|#|$)/i.test(url) || url.startsWith("data:video/");
}

/**
 * Is this post's media a clip?
 *
 * The backend types its own media through `mediaKind` now, so that is the
 * truth when it is present. Extension sniffing stays as the fallback for
 * payloads written before the field existed.
 */
export function isVideoPost(post: {
  mediaUrl?: string | null;
  mediaKind?: string | null;
}): boolean {
  if (!post.mediaUrl) return false;
  if (post.mediaKind) return post.mediaKind.toLowerCase().startsWith("video");
  return isVideoUrl(post.mediaUrl);
}
