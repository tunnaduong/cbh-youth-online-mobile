import * as Api from "./ApiByAxios";

// Authentication
export const loginRequest = async (params) => {
  try {
    console.log("called");

    const response = await Api.postRequest("/v1.0/login", params);
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
      throw new Error("Đã có lỗi không mong muốn xảy ra.");
    }
  }
};

export const logoutRequest = () => {
  return Api.postRequest("/v1.0/logout");
};

export const signupRequest = (params) => {
  return Api.postRequest("/v1.0/register", params);
};

export const getHomePosts = (page = 1) => {
  return Api.getRequest("/v1.0/topics?page=" + page);
};

export const incrementPostView = (id) => {
  return Api.postRequest("/v1.0/topics/" + id + "/views");
};

export const incrementPostViewAuthenticated = (id) => {
  return Api.postRequest("/v1.0/topics/" + id + "/views/authenticated");
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

export const forgotPassword = (params) => {
  return Api.postRequest("/v1.0/password/reset", params);
};

export const uploadFile = (formData) => {
  return Api.postFormDataRequest("/v1.0/upload", formData);
};

export const forgotPasswordVerify = (params) => {
  return Api.postRequest("/v1.0/password/reset/verify", params);
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
