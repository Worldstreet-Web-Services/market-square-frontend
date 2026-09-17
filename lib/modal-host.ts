/**
 * WHERE SOMETHING THAT MUST STAY REACHABLE IS DRAWN WHILE A MODAL IS OPEN.
 *
 * A `Sheet` is `role="dialog" aria-modal`: assistive tech treats everything
 * outside it as inert, whatever its z-index. The invitation to speak has a
 * 60-second deadline and was drawn over an open sheet but OUTSIDE it, so a
 * screen-reader user could see nothing of it — and its announcer — until it
 * had run out. Painting it on top was not the same as putting it in reach.
 *
 * So an open modal registers its dock here (the dialog's first child, right
 * above its panel), and the few surfaces that must stay reachable
 * (components/ui/modal-layer.tsx `AboveModals`) portal into the TOPMOST one
 * while any is open, and render in place when none is. A stack, because sheets open over sheets; removal is by identity,
 * so a sheet closing out of order takes only itself away.
 *
 * Pure: no DOM, no React, so `lib/modal-host.test.ts` can pin it.
 */
export interface ModalHostStack<T> {
  /** Registers an open modal's host; returns its removal. */
  push(host: T): () => void;
  /** The topmost open modal's host, or null when none is open. */
  top(): T | null;
  subscribe(listener: () => void): () => void;
}

export function createModalHostStack<T>(): ModalHostStack<T> {
  // Entries carry identity, so a host pushed twice is removed once per push.
  let entries: readonly { host: T }[] = [];
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    push(host) {
      const entry = { host };
      entries = [...entries, entry];
      emit();
      return () => {
        if (!entries.includes(entry)) return;
        entries = entries.filter((item) => item !== entry);
        emit();
      };
    },
    top() {
      return entries.length > 0 ? entries[entries.length - 1]!.host : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
