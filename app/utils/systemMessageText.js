// Rebuilds a group system message in the viewer's own language from the
// structured metadata the backend attaches (see ChatController::createSystemMessage
// call sites) instead of always showing the server-generated Vietnamese text.
// Used everywhere a system message can appear: the conversation's own message
// list (ConversationScreen) and the thread list's "last message" preview
// (ChatScreen) - both need the same translation, so it lives here once.

// Maps a permission key from a "permission_changed" system message to the
// i18n key for its action label (see PERMISSION_FIELDS in GroupInfoScreen).
const PERMISSION_ACTION_I18N_KEYS = {
  perm_change_name: "chatConversation.permChangeName",
  perm_change_avatar: "chatConversation.permChangeAvatar",
  perm_change_background: "chatConversation.permChangeBackground",
  perm_remove_members: "chatConversation.permRemoveMembers",
  perm_share_invite_link: "chatConversation.permShareInviteLink",
  perm_invite_members: "chatConversation.permInviteMembers",
};

const lowercaseFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// Maps every other group system-message event to its i18n template key and
// the metadata fields it needs, in order.
const SIMPLE_SYSTEM_EVENT_KEYS = {
  group_created: { key: "chatConversation.sysGroupCreated", fields: { actor: "actor_name", name: "group_name" } },
  group_renamed: { key: "chatConversation.sysGroupRenamed", fields: { actor: "actor_name", name: "group_name" } },
  group_avatar_changed: { key: "chatConversation.sysGroupAvatarChanged", fields: { actor: "actor_name" } },
  background_changed: { key: "chatConversation.sysBackgroundChanged", fields: { actor: "actor_name" } },
  background_reset: { key: "chatConversation.sysBackgroundReset", fields: { actor: "actor_name" } },
  members_added: { key: "chatConversation.sysMembersAdded", fields: { actor: "actor_name", names: "member_names" } },
  member_removed: { key: "chatConversation.sysMemberRemoved", fields: { actor: "actor_name", name: "member_name" } },
  member_left: { key: "chatConversation.sysMemberLeft", fields: { name: "member_name" } },
  owner_randomly_assigned: { key: "chatConversation.sysOwnerRandomlyAssigned", fields: { name: "new_owner_name" } },
  deputy_assigned: { key: "chatConversation.sysDeputyAssigned", fields: { actor: "actor_name", name: "target_name" } },
  deputy_removed: { key: "chatConversation.sysDeputyRemoved", fields: { actor: "actor_name", name: "target_name" } },
  ownership_transferred: { key: "chatConversation.sysOwnershipTransferred", fields: { actor: "actor_name", name: "new_owner_name" } },
  joined_via_invite: { key: "chatConversation.sysJoinedViaInvite", fields: { actor: "actor_name" } },
};

// Backend system messages are plain server-generated Vietnamese text (same
// for every locale, like every other system message in the app) except these,
// which carry structured metadata so they can be rebuilt in the user's
// language. Falls back to the raw content for older messages or if metadata
// is missing/unrecognized.
export const getSystemMessageText = (message, t) => {
  const event = message?.metadata?.event;

  if (event === "permission_changed") {
    const { actor_name: actor, permission_key: key, permission_value: value } = message.metadata;
    const actionKey = PERMISSION_ACTION_I18N_KEYS[key];
    if (actor && actionKey) {
      const action = lowercaseFirst(t(actionKey));
      if (value === "none") {
        return t("chatConversation.permissionChangedDisabled", { actor, action });
      }
      const valueLabel = lowercaseFirst(t(`chatConversation.permValue_${value}`, value));
      return t("chatConversation.permissionChangedRestricted", { actor, action, value: valueLabel });
    }
  } else if (event && SIMPLE_SYSTEM_EVENT_KEYS[event]) {
    const { key: templateKey, fields } = SIMPLE_SYSTEM_EVENT_KEYS[event];
    const params = {};
    let allPresent = true;
    for (const [paramName, metaField] of Object.entries(fields)) {
      const val = message.metadata[metaField];
      if (!val) {
        allPresent = false;
        break;
      }
      params[paramName] = val;
    }
    if (allPresent) {
      return t(templateKey, params);
    }
  }

  return message?.content;
};
