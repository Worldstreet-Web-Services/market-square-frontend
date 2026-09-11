/**
 * Why a settings control cannot act yet.
 *
 * Every settings screen decides from what the service actually sends whether a
 * control is live — `/me/settings` for Notifications, Chat and (once `privacy`
 * arrives) Location and the two privacy toggles; a house's own route for its
 * levels. Until then the control is a real DISABLED control carrying this
 * reason, never a switch that flips, looks saved, and changes nothing.
 */
export const SAVING_SOON = "Saving this setting is coming soon.";
