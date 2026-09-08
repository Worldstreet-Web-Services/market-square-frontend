export { MessagesPage } from "@/features/messages/components/messages-page";
export type { NewChatPickerProps, NewChatMode } from "@/features/messages/components/messages-page";
export {
  useAddGroupMembers,
  // The profile's Houses rail (534:15577) runs the inbox's own Houses query —
  // `GET /me/conversations?kind=group`, server-side — rather than a second one.
  useConversations,
  useConversationMembers,
  useDeleteConversation,
  useCreateGroup,
  useJoinGroup,
  useOpenConversation,
} from "@/features/messages/hooks/use-messages";
