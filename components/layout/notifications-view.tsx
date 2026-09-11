"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/ui/avatar";
import { IconSettingsChevron } from "@/components/ui/icons";
import { useConversations } from "@/features/messages";
import {
  HouseNotificationsView,
  type MessageNotifFrom,
  type GistroomNotifFrom,
} from "@/components/layout/house-notifications-view";

/**
 * Settings → Notifications.
 *
 * "Your Houses" is the reader's REAL houses — the inbox's own Houses query
 * (`GET /me/conversations?kind=group`), so the list, its order and its member
 * counts are the same ones Chat shows. It used to be two invented houses
 * ("Ark Gist Partners", 1,037 members) that nobody was in.
 */
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
  const houses = useConversations("houses");
  const rows = houses.data?.pages.flatMap((page) => page.items) ?? [];
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
          {houses.isPending &&
            [0, 1].map((index) => (
              <div
                key={index}
                className="flex w-full items-center gap-4 border-b border-white/15 px-8 py-6"
                aria-hidden
              >
                <div className="size-10 shrink-0 animate-pulse rounded-full bg-white/10" />
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          {houses.isError && (
            <p className="px-8 py-6 text-sm leading-5 text-white/50">
              Couldn&apos;t load your houses.{" "}
              <button
                type="button"
                onClick={() => void houses.refetch()}
                className="font-bold text-white underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </p>
          )}
          {houses.isSuccess && rows.length === 0 && (
            <p className="px-8 py-6 text-sm leading-5 text-white/50">
              You&apos;re not in any houses yet.
            </p>
          )}
          {rows.map((house) => (
            <button
              key={house.id}
              onClick={() => setActiveHouse(house.id)}
              className="flex w-full items-center justify-between border-b border-white/15 px-8 py-6 text-left transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={house.title ?? "House"} seed={house.id} src={house.imageUrl} size={40} />
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="truncate text-base font-bold leading-4 text-white">
                    {house.title ?? "Untitled house"}
                  </p>
                  {house.memberCount !== null && (
                    <p className="text-sm font-normal leading-[16.5px] text-white/50">
                      {house.memberCount.toLocaleString()}{" "}
                      {house.memberCount === 1 ? "member" : "members"}
                    </p>
                  )}
                </div>
              </div>
              <IconSettingsChevron className="size-6 shrink-0 text-white/50" />
            </button>
          ))}
          {houses.hasNextPage && (
            <button
              type="button"
              onClick={() => void houses.fetchNextPage()}
              disabled={houses.isFetchingNextPage}
              className="px-8 py-4 text-left text-sm font-semibold text-white/50 transition-colors hover:text-white disabled:opacity-40"
            >
              {houses.isFetchingNextPage ? "Loading…" : "More houses"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
