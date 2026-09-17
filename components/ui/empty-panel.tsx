import Image from "next/image";

import { cn } from "@/lib/cn";
import { asset } from "@/lib/square-path";

/**
 * THE EMPTY STATE THE DESIGNER ASKED FOR — node 543:45867.
 *
 * A 120px illustration, 24 down to a 20/23.44 title, 8 down to a 16/24 line at
 * 50% white, 24 down to one primary action. The whole block 486 wide, every
 * line centred.
 *
 * ─── THE ILLUSTRATION IS THE APP'S, NOT THIS SCREEN'S ───────────────────────
 * `public/empty-illustration.svg` is the file's own export, and it is the same
 * artwork chat's placeholder carries at 200 — two concentric discs at 5% and
 * 10% white behind a tray at 40%. Worth knowing before drawing a second one:
 * the design has ONE empty mark and uses it at two sizes.
 *
 * ─── THE COPY IN THE NODE IS FROM ANOTHER SCREEN ────────────────────────────
 * 543:45867 reads "No badges earned yet" over a line about achievement badges,
 * because the designer built this from the badges surface. That is the
 * COMPONENT being reused, not the words — so `title` and `body` are required
 * props and each surface says its own thing.
 *
 * ─── THE ACTION IS PART OF IT ───────────────────────────────────────────────
 * A solid `--color-spotlight` pill, 48 tall at a full round, 12/20 of padding
 * and 10 between a 24px glyph and a 16/22 label. Not `Button`: that component
 * carries the app's own sizes and the silver ramp, and this is the file's own
 * control at the file's own numbers. It is optional, because an empty state
 * with nothing to do about it is still a legitimate one — but where there IS
 * one thing that would fill the surface, it belongs here.
 */
export function EmptyPanel({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  /** The one thing that would fill this surface — usually `EmptyPanelAction`. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full flex-col items-center px-6 py-10", className)}>
      <div className="flex w-[486px] max-w-full flex-col items-center gap-6">
        <Image
          src={asset("/empty-illustration.svg")}
          alt=""
          width={120}
          height={120}
          className="shrink-0"
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[20px] font-bold leading-[23.44px] text-white">{title}</h2>
          <p className="text-[16px] leading-6 text-white/50">{body}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

/** The panel's primary control — 543:45880, at the file's own numbers. */
export function EmptyPanelAction({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  /** 24px, white. The file puts the surface's own mark here. */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ws-press flex h-12 items-center justify-center gap-2.5 rounded-full bg-spotlight px-5 py-3 text-[16px] font-bold leading-[22px] text-white transition-colors hover:bg-spotlight/90"
    >
      {icon}
      {children}
    </button>
  );
}
