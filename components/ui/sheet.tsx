"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { IconArrowLeft, IconX } from "@/components/ui/icons";
import { useModalHost } from "@/components/ui/modal-layer";

// A single modal surface: bottom sheet on small screens, centered dialog on
// desktop. Closes on backdrop tap and Escape.
//
// Chrome follows the X dialog: a sticky bar carrying the dismiss control, the
// title, and one primary action pinned right — so the commit button is in the
// same place whether the body scrolls or not.
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
  /** Back arrow instead of a cross — for a step inside a flow. */
  back = false,
  /** Primary action pinned to the header's right edge. */
  action,
  /** A tab strip pinned under the header bar. */
  tabs,
  /**
   * Drop the header bar and let the caller draw its own.
   *
   * For the surfaces a design gives their own chrome — the tip sheet's grab
   * handle, centred title and round close. The DIALOG behaviour is the part
   * worth sharing (portal, backdrop, Escape, scroll lock, the reduced-motion
   * entrance); reimplementing that per sheet is how one of them ends up
   * without an Escape handler.
   */
  bare = false,
  /**
   * Surface overrides for a `bare` caller whose design is not a glass sheet.
   *
   * Extends the same seam `bare` opens rather than forking the dialog: a
   * design that specifies its own fill, radius and width (the attachment panel
   * is a flat 420 x 16px card, not a sheet) would otherwise have to
   * reimplement the portal, backdrop, Escape and scroll lock to get them —
   * which is exactly what `bare` exists to prevent.
   */
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
  back?: boolean;
  action?: React.ReactNode;
  tabs?: React.ReactNode;
  bare?: boolean;
  panelClassName?: string;
}) {
  // The CSS motion system honours prefers-reduced-motion, but these are
  // JS-driven springs that CSS cannot reach. Under the setting the panel stops
  // travelling and only cross-fades — the dialog still reads as arriving,
  // without the slide.
  const reduceMotion = useReducedMotion();
  const panelOffset = reduceMotion ? 0 : 40;

  /*
    THE DIALOG IS THE WHOLE LAYER, not the panel. `aria-modal` makes everything
    outside the dialog inert to assistive tech, so a surface that must stay
    answerable over a sheet (the invitation to speak) portals INTO it through
    `AboveModals` (components/ui/modal-layer.tsx) — into the DOCK: the layer's
    first child, stacked right above the panel in one column. First, so it is
    read and tabbed to before the sheet's rows; in flow, so it pushes the panel
    down (the panel shrinks to fit) rather than covering its header and Close.
    Inside the panel it would be clipped by the panel's overflow. Registered
    while OPEN, not while mounted: the exit animation keeps the node a moment
    longer, and the banner goes home as soon as the sheet is closing.
  */
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  useModalHost(dock, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // A sheet is rendered wherever its trigger happens to live — inside a feed
  // card, a stage tile, a row. `position: fixed` resolves against the nearest
  // ancestor with a transform, filter or will-change, NOT the viewport, and
  // `ws-enter` animates transform on every feed item. So an overlay opened
  // from a post anchored itself to that post and floated mid-page instead of
  // covering the screen.
  //
  // Portalling to the body takes the sheet out of that subtree entirely, which
  // is the only fix that does not depend on knowing what every future caller
  // is nested inside.
  //
  // Rendered only after mount: document.body does not exist during the server
  // render, and reaching for it there throws.
  // "Am I on the client", without a setState in an effect: the server snapshot
  // is false and the client's is true, so React swaps it on hydration rather
  // than re-rendering the tree a second time to find out.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal
          aria-label={title}
          // outline-none: focus handed to the dialog itself (a removed row's
          // fallback) must not draw a ring round the whole screen.
          className="fixed inset-0 z-50 flex flex-col items-center justify-end outline-none sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* The dock: empty unless a surface is portalled in (AboveModals). */}
          <div ref={setDock} className="relative z-20 w-full shrink-0 sm:max-w-md" />
          <div aria-hidden className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: panelOffset, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: panelOffset, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", damping: 28, stiffness: 340 }
            }
            className={cn(
              "ws-glass relative z-10 flex max-h-[85dvh] min-h-0 w-full flex-col overflow-hidden rounded-t-3xl bg-sheet/95 sm:max-h-[88dvh] sm:rounded-3xl",
              wide ? "sm:max-w-2xl" : "sm:max-w-md",
              panelClassName
            )}
          >
            {!bare && (
            <div className="ws-hair shrink-0 border-b">
              <div className="flex items-center gap-4 px-4 py-3">
                <button
                  onClick={onClose}
                  aria-label={back ? "Back" : "Close"}
                  className="ws-press -ml-1.5 rounded-full p-1.5 text-body transition-colors hover:bg-white/10 hover:text-heading"
                >
                  {back ? <IconArrowLeft className="h-5 w-5" /> : <IconX className="h-4 w-4" />}
                </button>
                <h2 className="ws-display min-w-0 flex-1 truncate text-lg">{title}</h2>
                {action}
              </div>
              {tabs}
            </div>
            )}
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                bare ? "p-0" : "p-5"
              )}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
