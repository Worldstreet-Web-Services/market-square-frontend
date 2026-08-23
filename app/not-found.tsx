import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="ws-display text-4xl text-grey-500">404</p>
      <p className="text-sm text-grey-400">That corner of the square doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-white"
      >
        Back to the feed
      </Link>
    </div>
  );
}
