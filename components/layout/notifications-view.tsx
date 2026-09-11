"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { IconSettingsChevron } from "@/components/ui/icons";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import {
  HouseNotificationsView,
  type MessageNotifFrom,
  type GistroomNotifFrom,
} from "@/components/layout/house-notifications-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HouseRow = {
  id: string;
  name: string;
  members: number;
};

const DEMO_HOUSES: HouseRow[] = [
  { id: "ark-gist", name: "Ark Gist Partners", members: 1037 },
  { id: "hacker-house", name: "Hacker House Maestros '26", members: 328 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationsView({
  friendsRoom,
  onFriendsRoomChange,
  directNotifications,
  onDirectNotificationsChange,
}: {
  friendsRoom: boolean;
  onFriendsRoomChange: (v: boolean) => void;
  directNotifications: boolean;
  onDirectNotificationsChange: (v: boolean) => void;
}) {
  const [activeHouse, setActiveHouse] = useState<string | null>(null);
  const [houseMessagesFrom, setHouseMessagesFrom] =
    useState<MessageNotifFrom>("admins");
  const [houseGistroomsFrom, setHouseGistroomsFrom] =
    useState<GistroomNotifFrom>("admins");

  // Sub-view: house notification settings
  if (activeHouse != null) {
    return (
      <HouseNotificationsView
        messagesFrom={houseMessagesFrom}
        onMessagesFromChange={setHouseMessagesFrom}
        gistroomsFrom={houseGistroomsFrom}
        onGistroomsFromChange={setHouseGistroomsFrom}
        onBack={() => setActiveHouse(null)}
      />
    );
  }

  return (
    <div>
      {/* Top toggles — no section header */}
      <div className="flex flex-col">
        <div className="flex w-full items-center justify-between border-b border-white/15 px-8 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
            <p className="text-base font-bold leading-4 text-white">
              Friends Room
            </p>
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              When friends start or join gistrooms
            </p>
          </div>
          <Toggle
            checked={friendsRoom}
            onChange={onFriendsRoomChange}
            label="Friends Room notifications"
          />
        </div>
        <div className="flex w-full items-center justify-between border-b border-white/15 px-8 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
            <p className="text-base font-bold leading-4 text-white">
              Direct Notifications
            </p>
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              When friends directly message, reply to, or invite you.
            </p>
          </div>
          <Toggle
            checked={directNotifications}
            onChange={onDirectNotificationsChange}
            label="Direct notifications"
          />
        </div>
      </div>

      {/* Your Houses section */}
      <div className="mt-10 flex flex-col gap-2">
        <div className="flex h-6 items-center px-8">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">
            Your Houses
          </p>
        </div>
        <div className="flex flex-col">
          {DEMO_HOUSES.map((house) => (
            <button
              key={house.id}
              onClick={() => setActiveHouse(house.id)}
              className="flex w-full items-center justify-between border-b border-white/15 px-8 py-6 text-left transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-4">
                <div className="size-10 shrink-0 overflow-hidden rounded-full bg-white">
                  <GradientThumb seed={house.id} className="size-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-base font-bold leading-4 text-white">
                    {house.name}
                  </p>
                  <p className="text-sm font-normal leading-[16.5px] text-white/50">
                    {house.members.toLocaleString()} members
                  </p>
                </div>
              </div>
              <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
