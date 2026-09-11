"use client";

import { Toggle } from "@/components/ui/toggle";
import { IconArrowLeft } from "@/components/ui/icons";

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
  onBack,
}: {
  messagesFrom: MessageNotifFrom;
  onMessagesFromChange: (v: MessageNotifFrom) => void;
  gistroomsFrom: GistroomNotifFrom;
  onGistroomsFromChange: (v: GistroomNotifFrom) => void;
  onBack: () => void;
}) {
  return (
    <div>
      {/* Back header */}
      <div className="hidden items-center gap-2 px-8 pt-10 pb-6 lg:flex">
        <button
          onClick={onBack}
          aria-label="Back to Notifications"
          className="flex items-center gap-2 text-white transition-colors hover:text-white/70"
        >
          <IconArrowLeft className="size-5" />
          <span className="text-base font-normal">Back</span>
        </button>
      </div>

      {/* Section: Message notifications from */}
      <div className="flex flex-col gap-2">
        <div className="flex h-6 items-center px-8">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">
            Message notifications from
          </p>
        </div>
        <div className="flex flex-col">
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">All members</p>
            <Toggle
              checked={messagesFrom === "all"}
              onChange={() => onMessagesFromChange("all")}
              label="Message notifications from all members"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">
              Admins, leaders and friends
            </p>
            <Toggle
              checked={messagesFrom === "admins"}
              onChange={() => onMessagesFromChange("admins")}
              label="Message notifications from admins, leaders and friends"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">None</p>
            <Toggle
              checked={messagesFrom === "none"}
              onChange={() => onMessagesFromChange("none")}
              label="No message notifications"
            />
          </div>
        </div>
      </div>

      {/* Section: Gistrooms and updates notifications from */}
      <div className="mt-10 flex flex-col gap-2">
        <div className="flex h-6 items-center px-8">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">
            Gistrooms and updates notifications from
          </p>
        </div>
        <div className="flex flex-col">
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">All members</p>
            <Toggle
              checked={gistroomsFrom === "all"}
              onChange={() => onGistroomsFromChange("all")}
              label="Gistroom notifications from all members"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">
              Admins, leaders and friends
            </p>
            <Toggle
              checked={gistroomsFrom === "admins"}
              onChange={() => onGistroomsFromChange("admins")}
              label="Gistroom notifications from admins, leaders and friends"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">
              Only directed at me
            </p>
            <Toggle
              checked={gistroomsFrom === "directed"}
              onChange={() => onGistroomsFromChange("directed")}
              label="Gistroom notifications only directed at me"
            />
          </div>
          <div className="flex h-16 w-full items-center justify-between border-b border-white/15 px-8 py-6">
            <p className="text-base font-bold leading-6 text-white">None</p>
            <Toggle
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
