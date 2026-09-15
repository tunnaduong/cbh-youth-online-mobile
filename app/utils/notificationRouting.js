// Single source of truth for "where does tapping this notification go" -
// shared by the in-app bell list (NotificationScreen/index.js) and push
// notification taps (NotificationContext.js), which used to each maintain
// their own separate, drifting switch statement. Tolerates both snake_case
// (API/DB shape) and legacy camelCase keys some older payloads used.

// Only these notification types mean the actor authored the anonymous
// content themselves (their own anonymous reply/comment). Voters/likers are
// never anonymous, even when they vote on someone else's anonymous
// comment/post, so `data.is_anonymous` must not hide them for those types.
const ANONYMOUS_ACTOR_TYPES = ["comment_replied", "topic_commented"];

export function isAnonymousNotificationActor(type, data, actor) {
  return (
    (actor && actor.id === null) ||
    (ANONYMOUS_ACTOR_TYPES.includes(type) &&
      (data?.is_anonymous === true || data?.anonymous === true))
  );
}

/**
 * @param {object} params
 * @param {string} params.type - notification type
 * @param {object} params.data - notification data payload
 * @param {object|null} [params.actor] - { id, username, profile_name, avatar_url } | null
 * @returns {{ screen: string, params?: object } | null}
 */
export function resolveNotificationTarget({ type, data, actor }) {
  data = data || {};
  const isAnonymous = isAnonymousNotificationActor(type, data, actor);

  const topicId = data.topic_id ?? data.topicId ?? data.post_id ?? data.postId;
  const commentId = data.comment_id ?? data.commentId;
  const conversationId = data.conversation_id ?? data.conversationId;
  const storyId = data.story_id ?? data.storyId;
  const messageId =
    data.reply_message_id ?? data.replyMessageId ?? data.message_id ?? data.messageId;
  const materialId = data.material_id ?? data.materialId;
  const actorUsername = actor?.username;

  if (type === "system_message" && data?.message?.includes("Chào mừng")) {
    return { screen: "PostScreen", params: { postId: 173336279 } };
  }

  if (
    (type === "system_message" && data?.url === "/wallet") ||
    type === "payment_received" ||
    data?.url === "/wallet"
  ) {
    return { screen: "PointWalletScreen" };
  }

  if (type === "story_reacted") {
    return {
      screen: "MainScreens",
      params: { screen: "Home", params: { openStoryId: storyId } },
    };
  }

  if (
    type === "story_replied" ||
    type === "message_reacted" ||
    type === "message_replied"
  ) {
    if (conversationId) {
      return {
        screen: "ConversationScreen",
        params: { conversationId, highlightMessageId: messageId },
      };
    }
    return { screen: "MainScreens", params: { screen: "Chat" } };
  }

  if (type === "mentioned" && conversationId) {
    return {
      screen: "ConversationScreen",
      params: { conversationId, highlightMessageId: data.message_id ?? data.messageId },
    };
  }

  // Any other comment-related notification (mention, reply, reaction, etc.)
  // jumps straight to the comment and highlights it.
  if (commentId && topicId) {
    return { screen: "PostScreen", params: { postId: topicId, highlightCommentId: commentId } };
  }

  if (type === "mentioned" && topicId) {
    return { screen: "PostScreen", params: { postId: topicId } };
  }

  if (type === "followed") {
    if (actorUsername && !isAnonymous) {
      return { screen: "ProfileScreen", params: { username: actorUsername } };
    }
    return null;
  }

  if (type === "study_material_purchased" || type === "study_material_rated") {
    if (materialId) {
      return { screen: "StudyMaterialDetailScreen", params: { materialId } };
    }
    return null;
  }

  // Any message-bearing notification not already handled above (e.g. a
  // group event) still deserves to open the conversation it's about.
  if (conversationId) {
    return {
      screen: "ConversationScreen",
      params: { conversationId, highlightMessageId: messageId },
    };
  }

  if (topicId) {
    const id = parseInt(topicId, 10);
    return { screen: "PostScreen", params: { postId: isNaN(id) ? topicId : id } };
  }

  if (actorUsername && !isAnonymous) {
    return { screen: "ProfileScreen", params: { username: actorUsername } };
  }

  return null;
}
