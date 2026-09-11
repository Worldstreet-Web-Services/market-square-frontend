/**
 * WHICH SETTINGS SAVE, stage by stage.
 *
 * Stage 1 — Notifications (Friends Room, Direct) and Privacy → Chat — reads and
 * writes `/me/settings`, and the screen decides from that query whether it is
 * live (a 404 means not deployed here). The rest have no route yet: a house's
 * notification levels wait on stage 2, location and the other privacy rows on
 * stages 3 and 4. Until then those are real DISABLED controls with this
 * reason — never a toggle that flips, looks saved, and changes nothing.
 *
 * Flip a flag only together with the wiring for that stage.
 */
export const HOUSE_SAVE_LIVE = false;
export const PRIVACY_SAVE_LIVE = false;

export const SAVING_SOON = "Saving this setting is coming soon.";
