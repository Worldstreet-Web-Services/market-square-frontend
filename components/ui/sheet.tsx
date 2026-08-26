"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { IconArrowLeft, IconX } from "@/components/ui/icons";

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
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
  back?: boolean;
  action?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  // The CSS motion system honours prefers-reduced-motion, but these are
  // JS-driven springs that CSS cannot reach. Under the setting the panel stops
  // travelling and only cross-fades — the dialog still reads as arriving,
  // without the slide.
  const reduceMotion = useReducedMotion();
  const panelOffset = reduceMotion ? 0 : 40;

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ y: panelOffset, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: panelOffset, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", damping: 28, stiffness: 340 }
            }
            className={cn(
              "ws-glass relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-sheet/95 sm:max-h-[88dvh] sm:rounded-3xl",
              wide ? "sm:max-w-2xl" : "sm:max-w-md"
            )}
          >
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
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
