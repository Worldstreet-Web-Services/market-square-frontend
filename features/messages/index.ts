export { MessagesPage } from "@/features/messages/components/messages-page";
// `/join/<token>` — where a shared house invite lands.
export { JoinPage } from "@/features/messages/components/join-page";
export type { NewChatPickerProps, NewChatMode } from "@/features/messages/components/messages-page";
export {
  useAddGroupMembers,
  useHouseNotificationSettings,
  useUpdateHouseNotificationSettings,
  // The profile's Houses rail (534:15577) runs the inbox's own Houses query —
  // `GET /me/conversations?kind=group`, server-side — rather than a second one.
  useConversations,
  useConversationMembers,
  useDeleteConversation,
  useCreateGroup,
  useJoinGroup,
  useOpenConversation,
} from "@/features/messages/hooks/use-messages";
// A stranger's houses on their profile (545:47653) — parsed through the
// conversation shape this slice owns, composed into the profile from the
// layout layer.
export { useProfileHouses, type ProfileHouse } from "@/features/messages/lib/profile-houses";
