"use client";

import { Toggle } from "@/components/ui/toggle";
import { Avatar } from "@/components/ui/avatar";
import { IconSettingsChevron } from "@/components/ui/icons";
import { useConversations } from "@/features/messages";
import { SAVING_SOON } from "@/components/layout/settings-copy";
import type { NotificationGroup, PushGroupRow } from "@/lib/notification-groups";

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
  onOpenHouse,
  push,
  emailDigest,
  disabled = false,
}: {
  friendsRoom: boolean;
  onFriendsRoomChange: (v: boolean) => void;
  directNotifications: boolean;
  onDirectNotificationsChange: (v: boolean) => void;
  /** The "Push notifications" row: this browser's state and switch, plus the
      per-bucket rows under it (empty until the service sends them). */
  push: {
    checked: boolean;
    disabled: boolean;
    description: string;
    onChange: (next: boolean) => void;
    groups: PushGroupRow[];
    onGroupChange: (group: NotificationGroup, next: boolean) => void;
  };
  /** The "Daily email summary" row. */
  emailDigest: { checked: boolean; disabled: boolean; description: string; onChange: (next: boolean) => void };
  /** Opens a house's notification levels — the screen owns the drill-in. */
  onOpenHouse: (house: { id: string; title: string }) => void;
  /** The toggles cannot be saved yet — see `settings-copy.ts`. */
  disabled?: boolean;
}) {
  const houses = useConversations("houses");
  const rows = houses.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div>
      {/* Top toggles — no section header */}
      <div className="flex flex-col">
        <div className="flex w-full items-center justify-between border-b border-white/15 px-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
            <p className="text-base font-bold leading-4 text-white">
              Push notifications
            </p>
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              {push.description}
            </p>
          </div>
          <Toggle
            disabled={push.disabled}
            title={push.disabled ? push.description : undefined}
            checked={push.checked}
            onChange={push.onChange}
            label="Push notifications"
          />
        </div>
        {/*
          WHAT A PUSH MAY BE ABOUT — indented under the switch it narrows,
          because that nesting IS the relationship: the row above decides
          whether this device is reachable at all, and these only choose which
          buckets reach it. Nothing renders until the service sends them.

          They exist because fifteen kinds shared one switch, so a phone that
          buzzed for a comment buzzed for a message, and the way people fix
          that is by revoking the permission in the OS — which they never go
          back and grant again.
        */}
        {push.groups.map((row) => (
          <div
            key={row.group}
            className="flex w-full items-center justify-between border-b border-white/15 py-4 pl-8 pr-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-4">
              <p className="text-[15px] font-semibold leading-4 text-white">{row.label}</p>
              <p className="text-sm font-normal leading-[16.5px] text-white/50">
                {row.description}
              </p>
            </div>
            <Toggle
              disabled={row.disabled}
              title={row.disabled ? row.description : undefined}
              checked={row.checked}
              onChange={(next) => push.onGroupChange(row.group, next)}
              label={`${row.label} push notifications`}
            />
          </div>
        ))}
        <div className="flex w-full items-center justify-between border-b border-white/15 px-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
            <p className="text-base font-bold leading-4 text-white">
              Daily email summary
            </p>
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              {emailDigest.description}
            </p>
          </div>
          <Toggle
            disabled={emailDigest.disabled}
            title={emailDigest.disabled ? emailDigest.description : undefined}
            checked={emailDigest.checked}
            onChange={emailDigest.onChange}
            label="Daily email summary"
          />
        </div>
        <div className="flex w-full items-center justify-between border-b border-white/15 px-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
            <p className="text-base font-bold leading-4 text-white">
              Friends Room
            </p>
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              When friends start or join gistrooms
            </p>
          </div>
          <Toggle
            disabled={disabled}
            title={disabled ? SAVING_SOON : undefined}
            checked={friendsRoom}
            onChange={onFriendsRoomChange}
            label="Friends Room notifications"
          />
        </div>
        <div className="flex w-full items-center justify-between border-b border-white/15 px-4 py-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
            <p className="text-base font-bold leading-4 text-white">
              Direct Notifications
            </p>
            <p className="text-sm font-normal leading-[16.5px] text-white/50">
              When friends directly message, reply to, or invite you.
            </p>
          </div>
          <Toggle
            disabled={disabled}
            title={disabled ? SAVING_SOON : undefined}
            checked={directNotifications}
            onChange={onDirectNotificationsChange}
            label="Direct notifications"
          />
        </div>
      </div>

      {/* Your Houses section */}
      <div className="mt-10 flex flex-col gap-2">
        <div className="flex h-6 items-center px-4">
          <p className="text-sm font-normal leading-[16.5px] text-white/50">
            Your Houses
          </p>
        </div>
        <div className="flex flex-col">
          {houses.isPending &&
            [0, 1].map((index) => (
              <div
                key={index}
                className="flex w-full items-center gap-4 border-b border-white/15 px-4 py-6"
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
            <p className="px-4 py-6 text-sm leading-5 text-white/50">
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
            <p className="px-4 py-6 text-sm leading-5 text-white/50">
              You&apos;re not in any houses yet.
            </p>
          )}
          {rows.map((house) => (
            <button
              key={house.id}
              onClick={() => onOpenHouse({ id: house.id, title: house.title ?? "Untitled house" })}
              className="flex w-full items-center justify-between border-b border-white/15 px-4 py-6 text-left transition-colors hover:bg-white/[0.03]"
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
              className="px-4 py-4 text-left text-sm font-semibold text-white/50 transition-colors hover:text-white disabled:opacity-40"
            >
              {houses.isFetchingNextPage ? "Loading…" : "More houses"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
