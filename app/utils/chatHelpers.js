// Shared helpers for distinguishing the single, app-wide public chat ("Tán gẫu linh
// tinh") from real user-created groups. Kept in one place so every screen that needs
// this check (chat list, conversation header, group management gating) stays in sync
// instead of re-implementing the same string match and risking it drifting out of step.
export const PUBLIC_CHAT_NAME = "Tán gẫu linh tinh";

const normalizeName = (name) => name?.trim().normalize("NFC").toLowerCase();

// True only for the singleton public chat conversation, never for a user-created group.
export const isPublicGroupChat = (conversation) => {
  if (!conversation || conversation.type !== "group") return false;
  return normalizeName(conversation.name) === normalizeName(PUBLIC_CHAT_NAME);
};

// True for a real, user-created (and therefore manageable) group conversation.
export const isManageableGroupChat = (conversation) =>
  conversation?.type === "group" && !isPublicGroupChat(conversation);
