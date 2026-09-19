"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { createModalHostStack } from "@/lib/modal-host";

/**
 * KEEPS A SURFACE IN REACH OF ASSISTIVE TECH WHILE A MODAL IS OPEN.
 *
 * `Sheet` is `aria-modal`, so anything outside its dialog is inert to a screen
 * reader however high it is painted (lib/modal-host.ts). A surface that must
 * stay answerable over a sheet — the invitation to speak, with its 60-second
 * deadline, and its announcer — is wrapped in `AboveModals`: rendered in place
 * while no modal is open, and portalled INTO the topmost open dialog while one
 * is, where it is read, tabbed to and announced like the dialog's own content.
 *
 * The host is the dialog's DOCK (components/ui/sheet.tsx), its first child and
 * an in-flow block right above the panel: so the surface comes first in the
 * dialog's reading and tab order, and it never covers the panel's header,
 * Close or first rows the way a fixed layer over it did. A child given as a
 * function is told which it is (`docked`), to drop its own fixed position.
 *
 * Moving between the two remounts what it wraps, so wrap only surfaces whose
 * state lives above them (the banner's deadline is the session's).
 */
const hosts = createModalHostStack<HTMLElement>();

/** A modal registers its dock element while it is open. */
export function useModalHost(node: HTMLElement | null, open: boolean) {
  useEffect(() => {
    if (!open || !node) return;
    return hosts.push(node);
  }, [node, open]);
}

export function AboveModals({ children }: { children: React.ReactNode | ((docked: boolean) => React.ReactNode) }) {
  const host = useSyncExternalStore(hosts.subscribe, hosts.top, () => null);
  const content = typeof children === "function" ? children(host !== null) : children;
  return host ? createPortal(content, host) : <>{content}</>;
}
