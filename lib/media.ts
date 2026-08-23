// The post payload carries only a mediaUrl; renderers infer video by
// extension (the upload endpoint only issues mp4/webm for video).
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(\?|#|$)/i.test(url) || url.startsWith("data:video/");
}
