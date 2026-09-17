"use client";

import { useEffect, useState } from "react";
import { houseTopic } from "@/features/houses";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useRoomSession } from "@/lib/room-session-store";
import { isZoneExit } from "@/lib/room-session/visibility";

/**
 * LEAVING THE SQUARE ENDS YOUR SPOT IN THE ROOM — so a speaker is asked.
 *
 * Inside Ark the Square is its own Next.js zone: a link to Ark's Market or
 * Portfolio is a FULL page load, and a full page load ends the tab's gist room
 * however the session is owned. Moving around inside the Square no longer
 * does, so this is the only navigation left worth a question.
 *
 * Only a HOST or a seated SPEAKER is asked — somebody the room would notice
 * going quiet. A listener is not interrupted: their leaving costs nobody
 * anything, and a modal on every Ark link would be a toll on the whole nav.
 *
 * Capture phase, so the question lands before Next's own link handler or the
 * browser's navigation. The safe choice is the default: Open in new tab keeps
 * the room exactly as it is.
 */
export function ZoneExitGuard() {
  const session = useRoomSession();
  const [href, setHref] = useState<string | null>(null);
  const speaking = session.presence === "host" || session.presence === "speaker";
  // Moved back to the audience while the sheet was up: the question is void.
  // Kept, it reappeared with the old link the next time they took the stage.
  if (!speaking && href !== null) setHref(null);

  useEffect(() => {
    if (!speaking) return;
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      // A modified click already opens elsewhere, and so does a new-tab link.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const raw = anchor.getAttribute("href") ?? "";
      if (!isZoneExit(raw, { origin: window.location.origin })) return;
      event.preventDefault();
      event.stopPropagation();
      setHref(anchor.href);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [speaking]);

  const title = session.stream ? houseTopic(session.stream) : "your gist room";
  const close = () => setHref(null);

  return (
    <Sheet open={href !== null && speaking} onClose={close} title={`Opening Ark ends your spot in ${title}`}>
      <p className="text-[13px] leading-5 text-body">
        {session.presence === "host"
          ? "You're hosting. Open it in a new tab to keep the room going here."
          : "You're on the stage. Open it in a new tab to keep your seat."}
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Button
          className="w-full"
          onClick={() => {
            if (href) window.open(href, "_blank", "noopener");
            close();
          }}
        >
          Open in new tab
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            const target = href;
            close();
            if (!target) return;
            void session.leave().finally(() => window.location.assign(target));
          }}
        >
          Leave and go
        </Button>
      </div>
    </Sheet>
  );
}
