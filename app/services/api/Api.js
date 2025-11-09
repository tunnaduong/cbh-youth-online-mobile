import * as Api from "./ApiByAxios";

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
        "Đã có lỗi không mong muốn xảy ra. Vui lòng kiểm tra kết nối mạng của bạn và thử lại sau."
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
        "Đã có lỗi không mong muốn xảy ra. Vui lòng kiểm tra kết nối mạng của bạn và thử lại sau."
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
        "Đã có lỗi không mong muốn xảy ra. Vui lòng kiểm tra kết nối mạng của bạn và thử lại sau."
      );
    }
  }
};

export const getHomePosts = (page = 1) => {
  return Api.getRequest("/v1.0/topics?page=" + page);
};

export const incrementPostView = (id) => {
  return Api.postRequest("/v1.0/topics/" + id + "/views");
};

export const votePost = (id, params) => {
  return Api.postRequest("/v1.0/topics/" + id + "/votes", params);
};

export const savePost = (id) => {
  return Api.postRequest("/v1.0/user/saved-topics", { topic_id: id });
};

export const unsavePost = (id) => {
  return Api.deleteRequest("/v1.0/user/saved-topics/" + id);
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
        "Đã có lỗi không mong muốn xảy ra. Vui lòng kiểm tra kết nối mạng của bạn và thử lại sau."
      );
    }
  }
};

export const forgotPassword = (params) => {
  return Api.postRequest("/v1.0/password/reset", params);
};

export const uploadFile = (formData) => {
  return Api.postFormDataRequest("/v1.0/upload", formData);
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

export const voteComment = (id, params) => {
  return Api.postRequest("/v1.0/comments/" + id + "/votes", params);
};

export const getForumCategories = () => {
  return Api.getRequest("/v1.0/forum/categories");
};

export const getProfile = (username) => {
  return Api.getRequest("/v1.0/users/" + username + "/profile");
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

export const deletePost = (id) => {
  return Api.deleteRequest("/v1.0/topics/" + id);
};

export const getOnlineStatus = (username) => {
  return Api.getRequest("/v1.0/users/" + username + "/online-status");
};

export const updateProfile = (username, params) => {
  return Api.putRequest("/v1.0/users/" + username + "/profile", params);
};

export const getSavedPosts = () => {
  return Api.getRequest("/v1.0/user/saved-topics");
};

export const getActivities = () => {
  return Api.getRequest("/v1.0/activities");
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

export const searchChatUsername = (query) => {
  return Api.getRequest("/v1.0/chat/search/users?username=" + query);
};

export const createConversation = (id) => {
  return Api.postRequest("/v1.0/chat/conversations", {
    participant_id: id,
  });
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
