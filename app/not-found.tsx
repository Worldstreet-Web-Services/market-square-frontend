import { sq } from "@/lib/square-path";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="ws-display text-5xl text-grey-700">404</p>
      <p className="ws-display text-xl">This page doesn&apos;t exist</p>
      <p className="max-w-sm text-[15px] text-meta">
        That corner of the square isn&apos;t here. Try the timeline, or search for what you wanted.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={sq("/")}
          className="ws-press rounded-full bg-accent px-5 py-2 text-[15px] font-bold text-ink transition-colors hover:bg-white"
        >
          Back to the feed
        </Link>
        <Link
          href={sq("/discover")}
          className="ws-press rounded-full border border-white/20 px-5 py-2 text-[15px] font-bold text-body transition-colors hover:bg-white/10"
        >
          Explore
        </Link>
      </div>
    </div>
  );
}
