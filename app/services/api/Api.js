import * as Api from "./ApiByAxios";
import axiosInstance from "./axiosInstance";
import i18n from "../../i18n";

// Authentication
export const loginRequest = async (params) => {
  try {
    const response = await Api.postRequest("/v1.0/login", params);
    return response;
  } catch (error) {
    // console.error("Full error object:", error); // Log the full error object
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else if (
      error.response &&
      error.response.data &&
      error.response.data.message
    ) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error(
        i18n.t("api.networkError")
      );
    }
  }
};

export const logoutRequest = () => {
  return Api.postRequest("/v1.0/logout");
};

export const signupRequest = (params) => {
  return Api.postRequest("/v1.0/register", params);
};

export const loginWithOAuth = async (params) => {
  try {
    const response = await Api.postRequest("/v1.0/login/oauth", params);
    return response;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else if (
      error.response &&
      error.response.data &&
      error.response.data.message
    ) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error(
        i18n.t("api.networkError")
      );
    }
  }
};

export const exchangeOAuthCode = async (params) => {
  try {
    console.log("Api: exchangeOAuthCode - Request params:", {
      code: params.code ? "present" : "missing",
      code_verifier: params.code_verifier ? "present" : "missing",
      provider: params.provider,
      providerType: typeof params.provider,
      providerLength: params.provider?.length,
      fullParams: params,
    });
    const response = await Api.postRequest("/v1.0/oauth/exchange", params);
    console.log("Api: exchangeOAuthCode - Response:", response);
    console.log("Api: exchangeOAuthCode - Response type:", typeof response);
    console.log(
      "Api: exchangeOAuthCode - Response keys:",
      Object.keys(response || {})
    );

    // Handle both direct response and response.data
    if (response && response.data) {
      return response.data;
    }
    return response;
  } catch (error) {
    console.log("Api: exchangeOAuthCode - Error:", error);
    console.log("Api: exchangeOAuthCode - Error response:", error.response);
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else if (
      error.response &&
      error.response.data &&
      error.response.data.message
    ) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error(
        i18n.t("api.networkError")
      );
    }
  }
};

export const getHomePosts = (page = 1) => {
  return Api.getRequest("/v1.0/topics?page=" + page);
};

export const getPersonalizedFeed = (page = 1) => {
  return Api.getRequest("/v1.0/topics/feed?page=" + page);
};

export const getFeedRefreshCheck = () => {
  return Api.getRequest("/v1.0/topics/feed/refresh-check");
};

export const getLatestFeed = (page = 1) => {
  return Api.getRequest("/v1.0/topics/feed?mode=latest&page=" + page);
};

export const getFollowingFeed = (page = 1) => {
  return Api.getRequest("/v1.0/topics/feed?mode=following&page=" + page);
};

export const incrementPostView = (id) => {
  return Api.postRequest("/v1.0/topics/" + id + "/views");
};

export const votePost = (id, params) => {
  return Api.postRequest("/v1.0/topics/" + id + "/votes", params);
};

export const getPostVotes = (id) => {
  return Api.getRequest("/v1.0/topics/" + id + "/votes");
};

export const getCommentVotes = (id) => {
  return Api.getRequest("/v1.0/comments/" + id + "/votes");
};

export const savePost = (id) => {
  return Api.postRequest("/v1.0/user/saved-topics", { topic_id: id });
};

export const unsavePost = (id) => {
  return Api.deleteRequest("/v1.0/user/saved-topics/" + id);
};

// Per-user feed filter ("Ẩn bài viết") - hides the post from this user's
// feed only, it stays public and reachable by link.
export const hidePost = (id) => {
  return Api.postRequest("/v1.0/user/hidden-topics", { topic_id: id });
};

export const unhidePost = (id) => {
  return Api.deleteRequest("/v1.0/user/hidden-topics/" + id);
};

// Archive ("kho lưu trữ") flips the post's own `hidden` column: it disappears
// for everyone else and only the author keeps seeing it, on their profile and
// in the archive screen.
export const archivePost = (id) => {
  return Api.postRequest("/v1.0/topics/" + id + "/archive");
};

export const unarchivePost = (id) => {
  return Api.deleteRequest("/v1.0/topics/" + id + "/archive");
};

export const getArchivedPosts = (page = 1) => {
  return Api.getRequest("/v1.0/user/archived-topics?page=" + page);
};

export const createPost = (params) => {
  return Api.postRequest("/v1.0/topics", params);
};

export const verifyEmail = (token) => {
  return Api.getRequest("/v1.0/email/verify/" + token);
};

export const resendVerificationEmail = async () => {
  try {
    const response = await Api.postRequest("/v1.0/email/resend-verification");
    return response;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else if (
      error.response &&
      error.response.data &&
      error.response.data.message
    ) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error(
        i18n.t("api.networkError")
      );
    }
  }
};

export const forgotPassword = (params) => {
  return Api.postRequest("/v1.0/password/reset", params);
};

export const uploadFile = (formData, config = {}) => {
  return Api.postFormDataRequest("/v1.0/upload", formData, config);
};

// Student (eKYC) verification - unlocks the Gift Shop discount once an admin
// approves the submitted selfie + student card photos.
export const getStudentVerificationStatus = () => {
  return Api.getRequest("/v1.0/student-verification/status");
};

export const submitStudentVerification = (params) => {
  return Api.postRequest("/v1.0/student-verification", params);
};

/**
 * Uploads one eKYC photo and returns its absolute URL.
 *
 * The submit endpoint validates selfie_url/student_card_url as `url`, but
 * /v1.0/upload answers with a root-relative path ("/storage/images/..."), so
 * it has to be resolved against the API origin before being sent back.
 *
 * @param {string} imageUri  Local file uri from expo-image-picker
 * @param {number} userId    Owner of the upload (the endpoint requires `uid`)
 */
export const uploadStudentVerificationPhoto = async (imageUri, userId) => {
  const isPng = imageUri.toLowerCase().endsWith(".png");
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: isPng ? "image/png" : "image/jpeg",
    name: isPng ? "verification.png" : "verification.jpg",
  });
  formData.append("uid", String(userId));

  const response = await uploadFile(formData);
  const path = response?.data?.path || response?.data?.url || response?.data?.file_url;
  if (!path) return null;
  if (path.startsWith("http")) return path;

  const base = (axiosInstance.defaults.baseURL || "").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Study materials / marketplace
export const getStudyMaterials = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return Api.getRequest(`/v1.0/study-materials${query ? `?${query}` : ""}`);
};

export const getStudyMaterial = (id) => {
  return Api.getRequest(`/v1.0/study-materials/${id}`);
};

export const getStudyMaterialCategories = () => {
  return Api.getRequest("/v1.0/study-material-categories");
};

export const createStudyMaterial = (params) => {
  return Api.postRequest("/v1.0/study-materials", params);
};

export const purchaseMaterial = (id) => {
  return Api.postRequest(`/v1.0/study-materials/${id}/purchase`);
};

export const getMaterialRatings = (id) => {
  return Api.getRequest(`/v1.0/study-materials/${id}/ratings`);
};

export const rateMaterial = (id, params) => {
  return Api.postRequest(`/v1.0/study-materials/${id}/ratings`, params);
};

export const downloadMaterial = (id) => {
  return axiosInstance.get(`/v1.0/study-materials/${id}/download`, {
    responseType: "blob",
    headers: {
      Accept: "application/octet-stream",
    },
  });
};

export const viewMaterial = (id) => {
  return Api.postRequest(`/v1.0/study-materials/${id}/view`);
};

// Gift points to another member. Pass `topic_id` (the post's author gets
// the points - works for anonymous posts too) or `username`.
export const giftPoints = (params) => {
  return Api.postRequest("/v1.0/points/gift", params);
};

// Points wallet
export const getWalletBalance = () => {
  return Api.getRequest("/v1.0/wallet/balance");
};

export const getWalletTransactions = (params = {}) => {
  return Api.getRequest("/v1.0/wallet/transactions", params);
};

export const getWithdrawalRequests = () => {
  return Api.getRequest("/v1.0/wallet/withdrawal-requests");
};

export const createDepositRequest = (params) => {
  return Api.postRequest("/v1.0/wallet/deposit-request", params);
};

export const requestWithdrawal = (params) => {
  return Api.postRequest("/v1.0/wallet/withdrawal-request", params);
};

export const cancelWithdrawalRequest = (id) => {
  return Api.postRequest(`/v1.0/wallet/withdrawal-requests/${id}/cancel`);
};

export const forgotPasswordVerify = async (params) => {
  try {
    console.log("forgotPasswordVerify: Sending request with params:", {
      email: params.email,
      hasToken: !!params.token,
      hasPassword: !!params.password,
      hasPasswordConfirmation: !!params.password_confirmation,
    });
    const response = await Api.postRequest(
      "/v1.0/password/reset/verify",
      params
    );
    console.log("forgotPasswordVerify: Response received:", response);
    return response;
  } catch (error) {
    console.error("forgotPasswordVerify: Error details:", {
      message: error.message,
      response: error.response,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: error.config,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config?.baseURL + error.config?.url,
    });
    throw error;
  }
};

export const getPostDetail = (id) => {
  return Api.getRequest("/v1.0/topics/" + id);
};

export const commentPost = (id, params) => {
  return Api.postRequest("/v1.0/topics/" + id + "/comments", params);
};

export const commentPostWithImages = (id, params, imageUris) => {
  const formData = new FormData();
  if (params.comment) formData.append("comment", params.comment);
  formData.append("topic_id", String(params.topic_id));
  if (params.replying_to != null) formData.append("replying_to", String(params.replying_to));
  if (params.is_anonymous != null) formData.append("is_anonymous", params.is_anonymous ? "1" : "0");
  (Array.isArray(imageUris) ? imageUris : [imageUris]).forEach((uri, i) => {
    const ext = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
    formData.append("images[]", { uri, name: `comment_image_${i}.${ext}`, type: mime });
  });
  return Api.postFormDataRequest("/v1.0/topics/" + id + "/comments", formData);
};

export const voteComment = (id, params) => {
  return Api.postRequest("/v1.0/comments/" + id + "/votes", params);
};

export const updateComment = (id, params) => {
  return Api.putRequest("/v1.0/comments/" + id, params);
};

export const deleteComment = (id) => {
  return Api.deleteRequest("/v1.0/comments/" + id);
};

export const getForumCategories = () => {
  return Api.getRequest("/v1.0/forum/categories");
};

export const getCurrentUser = () => {
  return Api.getRequest("/v1.0/user");
};

export const getCurrentPoints = () => {
  return Api.getRequest("/v1.0/user/current-points");
};

export const deleteAccount = async (password) => {
  try {
    const response = await Api.postRequest("/v1.0/user/delete-account", {
      password,
      confirm_text: "XÓA TÀI KHOẢN",
    });
    return response;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(error.response.data.error);
    } else if (
      error.response &&
      error.response.data &&
      error.response.data.message
    ) {
      throw new Error(error.response.data.message);
    } else {
      throw new Error(
        i18n.t("api.networkError")
      );
    }
  }
};

export const getProfile = (username) => {
  return Api.getRequest("/v1.0/users/" + username + "/profile");
};

export const getUserPosts = (username, page = 1, perPage = 10) => {
  return Api.getRequest(
    "/v1.0/users/" + username + "/posts?page=" + page + "&per_page=" + perPage
  );
};

// Posts that make up a profile's "likes" total, sortable:
// newest | oldest | most_liked | least_liked
export const getUserLikedPosts = (username, page = 1, perPage = 10, sort = "newest") => {
  return Api.getRequest(
    "/v1.0/users/" + username + "/likes?page=" + page + "&per_page=" + perPage + "&sort=" + sort
  );
};

export const followUser = (username) => {
  return Api.postRequest("/v1.0/users/" + username + "/follow");
};

export const unfollowUser = (username) => {
  return Api.deleteRequest("/v1.0/users/" + username + "/unfollow");
};

export const getSubforums = () => {
  return Api.getRequest("/v1.0/forum/subforums");
};

// Role-aware subforum list — recommended for Create/Edit post screens
// Returns [{label, value, category}] directly without wrapping
// export const getSubforumsForEdit = () => {
//   return Api.getRequest("/api/forum/subforums");
// };

export const deletePost = (id) => {
  return Api.deleteRequest("/v1.0/topics/" + id);
};

export const getPost = (id) => {
  return Api.getRequest("/v1.0/topics/" + id);
};

export const updatePost = (id, params) => {
  return Api.putRequest("/v1.0/topics/" + id, params);
};

export const getOnlineStatus = (username) => {
  return Api.getRequest("/v1.0/users/" + username + "/online-status");
};

export const updateProfile = (username, params) => {
  return Api.putRequest("/v1.0/users/" + username + "/profile", params);
};

export const uploadCoverPhoto = (username, formData) => {
  return Api.postFormDataRequest("/v1.0/users/" + username + "/cover", formData);
};

export const changePassword = (params) => {
  return Api.postRequest("/v1.0/password/change", params);
};


export const getSavedPosts = () => {
  return Api.getRequest("/v1.0/user/saved-topics");
};

export const getActivities = () => {
  return Api.getRequest("/v1.0/activities");
};

export const getMemberRanking = (limit = 8) => {
  return Api.getRequest("/v1.0/users/ranking?limit=" + limit);
};

export const getLikedPosts = () => {
  return Api.getRequest("/v1.0/activities/liked");
};

export const getStories = () => {
  return Api.getRequest("/v1.0/stories");
};

export const createStory = (formData) => {
  return Api.postFormDataRequest("/v1.0/stories", formData);
};

export const deleteStory = (id) => {
  return Api.deleteRequest("/v1.0/stories/" + id);
};

export const reactToStory = (storyId, reactionType) => {
  return Api.postRequest("/v1.0/stories/" + storyId + "/react", {
    reaction_type: reactionType,
  });
};

export const removeStoryReaction = (storyId) => {
  return Api.deleteRequest("/v1.0/stories/" + storyId + "/react");
};

export const replyToStory = (storyId, content) => {
  return Api.postRequest("/v1.0/stories/" + storyId + "/reply", {
    content: content,
  });
};

export const getStoryViewers = (storyId) => {
  return Api.getRequest("/v1.0/stories/" + storyId + "/viewers");
};

export const getStoryArchive = () => {
  return Api.getRequest("/v1.0/stories/archive");
};

export const markStoryAsViewed = (storyId) => {
  return Api.postRequest("/v1.0/stories/" + storyId + "/view", {});
};

export const searchQuery = (query, type = "") => {
  return Api.getRequest("/v1.0/search?query=" + query + "&type=" + type);
};

export const getSubforumPosts = (id) => {
  return Api.getRequest("/v1.0/forum/subforums/" + id + "/topics");
};

export const getConversations = () => {
  return Api.getRequest("/v1.0/chat/conversations");
};

export const getConversationMessages = (id, page = 1) => {
  return Api.getRequest(
    "/v1.0/chat/conversations/" + id + "/messages?page=" + page
  );
};

export const sendMessage = (id, params) => {
  return Api.postRequest(
    "/v1.0/chat/conversations/" + id + "/messages",
    params
  );
};

export const getConversationMedia = (id, type, page = 1) => {
  return Api.getRequest(
    `/v1.0/chat/conversations/${id}/media?type=${type}&page=${page}`
  );
};

export const searchChatUsername = (query) => {
  return Api.getRequest("/v1.0/chat/search/users?username=" + query);
};

export const createConversation = (id) => {
  return Api.postRequest("/v1.0/chat/conversations", {
    participant_id: id,
  });
};

export const markConversationAsRead = (id) => {
  return Api.postRequest(`/v1.0/chat/conversations/${id}/read`);
};

export const reactToMessage = (messageId, reactionType) => {
  return Api.postRequest(`/v1.0/chat/messages/${messageId}/reactions`, {
    reaction_type: reactionType,
  });
};

export const removeMessageReaction = (messageId) => {
  return Api.deleteRequest(`/v1.0/chat/messages/${messageId}/reactions`);
};

export const recallMessage = (messageId) => {
  return Api.postRequest(`/v1.0/chat/messages/${messageId}/recall`);
}

export const editMessage = (messageId, content) => {
  return Api.putRequest(`/v1.0/chat/messages/${messageId}`, { content });
};

export const forwardMessage = (messageId, { conversationIds, userIds } = {}) => {
  return Api.postRequest(`/v1.0/chat/messages/${messageId}/forward`, {
    conversation_ids: conversationIds || [],
    user_ids: userIds || [],
  });
};

// Share a forum post into conversations as a quick message. The message body is
// built server-side from the topic, so only the target list travels from here.
export const sharePostToChat = (topicId, { conversationIds, userIds, note } = {}) => {
  return Api.postRequest("/v1.0/chat/share/topic", {
    topic_id: topicId,
    conversation_ids: conversationIds || [],
    user_ids: userIds || [],
    note: note || null,
  });
};

// Group chat management
export const createGroupConversation = (name, participantIds) => {
  return Api.postRequest("/v1.0/chat/groups", {
    name,
    participants: participantIds,
  });
};

export const getGroupDetails = (conversationId) => {
  return Api.getRequest(`/v1.0/chat/groups/${conversationId}`);
};

export const getGroupSeenReceipts = (conversationId) => {
  return Api.getRequest(`/v1.0/chat/groups/${conversationId}/seen`);
};

export const renameGroupConversation = (conversationId, name) => {
  return Api.putRequest(`/v1.0/chat/groups/${conversationId}`, { name });
};

export const updateGroupPermissions = (conversationId, updates) => {
  return Api.putRequest(`/v1.0/chat/groups/${conversationId}/permissions`, updates);
};

export const addGroupParticipants = (conversationId, participantIds) => {
  return Api.postRequest(`/v1.0/chat/groups/${conversationId}/participants`, {
    participants: participantIds,
  });
};

export const removeGroupParticipant = (conversationId, userId) => {
  return Api.deleteRequest(`/v1.0/chat/groups/${conversationId}/participants/${userId}`);
};

export const leaveGroupConversation = (conversationId) => {
  return Api.postRequest(`/v1.0/chat/groups/${conversationId}/leave`);
};

export const deleteGroupConversation = (conversationId) => {
  return Api.deleteRequest(`/v1.0/chat/groups/${conversationId}`);
};

// imageUri: local file uri from expo-image-picker
export const updateGroupAvatar = (conversationId, imageUri) => {
  const formData = new FormData();
  formData.append("avatar", {
    uri: imageUri,
    type: imageUri.endsWith(".png") ? "image/png" : "image/jpeg",
    name: imageUri.endsWith(".png") ? "group_avatar.png" : "group_avatar.jpg",
  });
  return Api.postFormDataRequest(`/v1.0/chat/groups/${conversationId}/avatar`, formData);
};

export const addGroupDeputy = (conversationId, userId) => {
  return Api.postRequest(`/v1.0/chat/groups/${conversationId}/deputies`, { user_id: userId });
};

export const removeGroupDeputy = (conversationId, userId) => {
  return Api.deleteRequest(`/v1.0/chat/groups/${conversationId}/deputies/${userId}`);
};

export const transferGroupOwnership = (conversationId, userId) => {
  return Api.postRequest(`/v1.0/chat/groups/${conversationId}/transfer-ownership`, { user_id: userId });
};

export const getGroupInviteLink = (conversationId) => {
  return Api.getRequest(`/v1.0/chat/groups/${conversationId}/invite-link`);
};

export const regenerateGroupInviteLink = (conversationId) => {
  return Api.postRequest(`/v1.0/chat/groups/${conversationId}/invite-link/regenerate`);
};

export const getGroupInvitePreview = (token) => {
  return Api.getRequest(`/v1.0/chat/groups/invite/${token}`);
};

export const joinGroupViaInvite = (token) => {
  return Api.postRequest(`/v1.0/chat/groups/invite/${token}/join`);
};

// Chat background (private + group conversations, not the public chat)
export const getConversationBackground = (conversationId) => {
  return Api.getRequest(`/v1.0/chat/conversations/${conversationId}/background`);
};

// imageUri: local file uri from expo-image-picker
export const uploadConversationBackground = (conversationId, imageUri) => {
  const formData = new FormData();
  formData.append("image", {
    uri: imageUri,
    type: imageUri.endsWith(".png") ? "image/png" : "image/jpeg",
    name: imageUri.endsWith(".png") ? "chat_background.png" : "chat_background.jpg",
  });
  return Api.postFormDataRequest(`/v1.0/chat/conversations/${conversationId}/background`, formData);
};

export const selectConversationBackground = (conversationId, userContentId) => {
  return Api.postRequest(`/v1.0/chat/conversations/${conversationId}/background/select`, {
    user_content_id: userContentId,
  });
};

export const resetConversationBackground = (conversationId) => {
  return Api.deleteRequest(`/v1.0/chat/conversations/${conversationId}/background`);
};

// Search users by partial username/display name (e.g. for "create group" / "add members" pickers)
export const searchUserSuggestions = (query, excludeConversationId) => {
  const params = new URLSearchParams({ q: query });
  if (excludeConversationId) params.set("exclude_conversation_id", excludeConversationId);
  return Api.getRequest(`/v1.0/chat/search/user-suggestions?${params.toString()}`);
};

// Notifications
export const getNotifications = (page = 1, perPage = 20) => {
  return Api.getRequest(`/v1.0/notifications?page=${page}&per_page=${perPage}`);
};

export const getUnreadNotificationCount = () => {
  return Api.getRequest("/v1.0/notifications/unread-count");
};

export const markNotificationAsRead = (id) => {
  return Api.postRequest(`/v1.0/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = () => {
  return Api.postRequest("/v1.0/notifications/read-all");
};

export const deleteNotification = (id) => {
  return Api.deleteRequest(`/v1.0/notifications/${id}`);
};

// Notification Settings
export const getNotificationSettings = () => {
  return Api.getRequest("/v1.0/notification-settings");
};

export const updateNotificationSettings = (params) => {
  return Api.putRequest("/v1.0/notification-settings", params);
};

// Expo Push Notifications
export const registerExpoPushToken = (params) => {
  return Api.postRequest("/v1.0/notifications/expo/register", params);
};

export const unregisterExpoPushToken = (params) => {
  return Api.deleteRequest("/v1.0/notifications/expo/unregister", params);
};

export const getExpoPushTokens = () => {
  return Api.getRequest("/v1.0/notifications/expo/tokens");
};

export const reportUser = (params) => {
  return Api.postRequest("/v1.0/reports", params);
};

// In-app feedback (bug reports & suggestions)
export const submitFeedback = (params) => {
  return Api.postRequest("/v1.0/feedback", params);
};

export const blockUser = (userId) => {
  return Api.postRequest("/v1.0/users/block", { blocked_user_id: userId });
};

export const unblockUser = (userId) => {
  return Api.postRequest("/v1.0/users/unblock", { blocked_user_id: userId });
};

export const getBlockedUsers = () => {
  return Api.getRequest("/v1.0/users/blocked");
};

export const getMentionSuggestions = (q) => {
  return Api.getRequest(`/v1.0/mention-suggestions?q=${encodeURIComponent(q)}`);
};

export const getConversationMentionSuggestions = (conversationId, q) => {
  return Api.getRequest(`/v1.0/chat/conversations/${conversationId}/mention-suggestions?q=${encodeURIComponent(q)}`);
};

// Games
export const getGames = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return Api.getRequest(`/v1.0/games${query ? `?${query}` : ""}`);
};

export const getGame = (slug) => {
  return Api.getRequest(`/v1.0/games/${slug}`);
};

export const getRandomGame = (platform) => {
  return Api.getRequest(`/v1.0/games/random${platform ? `?platform=${platform}` : ""}`);
};

export const getGameLeaderboard = (period = "week") => {
  return Api.getRequest(`/v1.0/games/leaderboard?period=${period}`);
};

export const getGameNowPlaying = () => {
  return Api.getRequest("/v1.0/games/now-playing");
};

// Universities
export const getUniversityOptions = () => {
  return Api.getRequest("/v1.0/universities/options");
};

export const getUniversities = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return Api.getRequest(`/v1.0/universities${query ? `?${query}` : ""}`);
};

export const searchUniversities = (q, autocomplete = false) => {
  const query = new URLSearchParams({ q, ...(autocomplete ? { autocomplete: "1" } : {}) }).toString();
  return Api.getRequest(`/v1.0/universities/search?${query}`);
};

// Quiz
export const getQuizTopics = () => {
  return Api.getRequest("/v1.0/quiz/topics");
};

export const startQuiz = (count, difficulty, topic, grade, customTopic) => {
  return Api.postRequest(
    "/v1.0/quiz/start",
    {
      count,
      difficulty,
      topic,
      grade,
      custom_topic: customTopic,
    },
    // Explicit (rather than relying on the instance-wide default) since
    // this waits on AI generation specifically - keeping it scoped here
    // means it doesn't change the timeout for every other request.
    { timeout: 30000 }
  );
};

export const submitQuiz = (quizSetId, answers) => {
  return Api.postRequest(`/v1.0/quiz/${quizSetId}/submit`, { answers });
};

export const answerQuizQuestion = (quizSetId, id, answer) => {
  return Api.postRequest(`/v1.0/quiz/${quizSetId}/answer`, { id, answer });
};

export const getQuizLeaderboard = (period = "week") => {
  return Api.getRequest(`/v1.0/quiz/leaderboard?period=${period}`);
};

export const joinQuiz = (quizSetId) => {
  return Api.postRequest(`/v1.0/quiz/${quizSetId}/join`, {});
};

export const restartQuiz = (quizSetId) => {
  return Api.postRequest(`/v1.0/quiz/${quizSetId}/restart`, {});
};

// Custom quiz sets - built from user-supplied text/HTML or an uploaded
// document (.docx/.txt/.pdf) instead of AI generation from a topic. Backend
// requires exactly one of content_html or file - see QuizController::custom.
export const createCustomQuiz = (formData) => {
  return Api.postFormDataRequest("/v1.0/quiz/custom", formData);
};
