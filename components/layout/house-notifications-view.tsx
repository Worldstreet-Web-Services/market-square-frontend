"use client";

import { Toggle } from "@/components/ui/toggle";
import { SAVING_SOON } from "@/components/layout/settings-copy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageNotifFrom = "all" | "admins" | "none";
type GistroomNotifFrom = "all" | "admins" | "directed" | "none";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type { MessageNotifFrom, GistroomNotifFrom };

export function HouseNotificationsView({
  messagesFrom,
  onMessagesFromChange,
  gistroomsFrom,
  onGistroomsFromChange,
  disabled = false,
}: {
  messagesFrom: MessageNotifFrom;
  onMessagesFromChange: (v: MessageNotifFrom) => void;
  gistroomsFrom: GistroomNotifFrom;
  onGistroomsFromChange: (v: GistroomNotifFrom) => void;
  /** The levels cannot be saved yet — see `settings-copy.ts`. */
  disabled?: boolean;
}) {
  return (
    <div>

      {/* Section: Message notifications from */}
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex h-6 items-center px-4">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">
            Message notifications from
          </p>
        </div>
        <div className="flex flex-col">
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">All members</p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={messagesFrom === "all"}
              onChange={() => onMessagesFromChange("all")}
              label="Message notifications from all members"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">
              Admins, leaders and friends
            </p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={messagesFrom === "admins"}
              onChange={() => onMessagesFromChange("admins")}
              label="Message notifications from admins, leaders and friends"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">None</p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={messagesFrom === "none"}
              onChange={() => onMessagesFromChange("none")}
              label="No message notifications"
            />
          </div>
        </div>
      </div>

      {/* Section: Gistrooms and updates notifications from */}
      <div className="mt-10 flex flex-col gap-2">
        <div className="flex h-6 items-center px-4">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">
            Gistrooms and updates notifications from
          </p>
        </div>
        <div className="flex flex-col">
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">All members</p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={gistroomsFrom === "all"}
              onChange={() => onGistroomsFromChange("all")}
              label="Gistroom notifications from all members"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">
              Admins, leaders and friends
            </p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={gistroomsFrom === "admins"}
              onChange={() => onGistroomsFromChange("admins")}
              label="Gistroom notifications from admins, leaders and friends"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">
              Only directed at me
            </p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={gistroomsFrom === "directed"}
              onChange={() => onGistroomsFromChange("directed")}
              label="Gistroom notifications only directed at me"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-4 py-6">
            <p className="text-base font-bold leading-6 text-white">None</p>
            <Toggle
              disabled={disabled}
              title={disabled ? SAVING_SOON : undefined}
              checked={gistroomsFrom === "none"}
              onChange={() => onGistroomsFromChange("none")}
              label="No gistroom notifications"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
