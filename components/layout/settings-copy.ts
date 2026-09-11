/**
 * WHICH SETTINGS SAVE, stage by stage.
 *
 * Notifications, Privacy → Chat (stage 1, `/me/settings`) and a house's
 * notification levels (stage 2b, `/conversations/:id/notification-settings`)
 * decide from their own queries whether they are live — a 404 means not
 * deployed here. Location and the other privacy rows wait on stages 3 and 4
 * and have no route yet: until then they are real DISABLED controls with this
 * reason, never a toggle that flips, looks saved, and changes nothing.
 *
 * Flip the flag only together with the wiring for those stages.
 */
export const PRIVACY_SAVE_LIVE = false;

export const SAVING_SOON = "Saving this setting is coming soon.";
