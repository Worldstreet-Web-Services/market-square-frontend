import { notFound } from "next/navigation";
import { TipPreview } from "@/app/dev/tip/preview";

/**
 * The tip tray, on its own, for looking at.
 *
 * The real path to this sheet is a live stream room with `liveGifts` switched
 * on, which is three conditions a laptop rarely has at once — so reviewing the
 * design meant either faking a stream or taking a screenshot's word for it.
 *
 * DEV ONLY, and enforced rather than intended: in production this route is a
 * 404, so the page cannot become a door into the product that nobody
 * remembered to close.
 */
export default function TipPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TipPreview />;
}
