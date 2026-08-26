/**
 * A media box that shows the WHOLE frame and fills the rest with the frame.
 *
 * `object-cover` fills a box by discarding whatever does not fit. In a
 * full-viewport slide that is brutal: a 16:9 photo in a ~9:19 slide loses most
 * of its width, so a scoreboard reads as a cropped digit and a caption loses
 * its first and last words. The author framed the shot; the feed should not
 * re-frame it.
 *
 * `object-contain` alone is not the answer either — it leaves hard black bars,
 * which read as a broken image rather than a deliberate one.
 *
 * So: the media is contained (whole, uncropped, centred) and the leftover space
 * is filled with a scaled, blurred, dimmed copy of the same frame. The slide
 * still fills edge to edge, the colour of the media carries into the letterbox,
 * and nothing is cut. Reels, Shorts and Spotify's canvas all settle here for
 * the same reason: it is the only treatment that respects arbitrary aspect
 * ratios without either cropping or admitting a void.
 *
 * When the ratios already match — a portrait clip in a portrait slide, which is
 * most of them — `contain` and `cover` are identical and the ambient layer is
 * never seen. It costs nothing in the common case and rescues the uncommon one.
 */
export function MediaFrame({
  backdrop,
  className,
  children,
}: {
  /**
   * Frame to blur behind the media: the image itself, or a video's poster.
   *
   * Null is fine and expected — a clip with no thumbnail falls back to the
   * neutral ground rather than decoding a second copy of the video purely to
   * blur it, which would double the decode cost of every slide in the feed.
   */
  backdrop?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#0b0b0c] ${className ?? ""}`}>
      {backdrop && (
        <>
          {/* Scaled past the edges so the blur has real pixels to sample there
              instead of smearing transparent ones inward. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- author-supplied media host is unknown */}
          <img
            src={backdrop}
            alt=""
            aria-hidden
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-3xl saturate-150"
          />
          {/* Held well below the subject: the ambient layer is ground, not
              content, and a bright backdrop competes with the media it frames
              and with the white furniture sitting over it. */}
          <div className="pointer-events-none absolute inset-0 bg-black/55" />
        </>
      )}
      {children}
    </div>
  );
}
