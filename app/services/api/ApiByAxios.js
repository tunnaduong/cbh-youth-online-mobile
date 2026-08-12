import axiosInstance from "./axiosInstance";

// Get data
export const getRequest = (endpoint, params = {}) => {
  return axiosInstance.get(endpoint, params);
};

// Post Data with optional data
export const postRequest = (endpoint, params = {}) => {
  return axiosInstance.post(endpoint, params);
};

// Put Data with optional data
export const putRequest = (endpoint, params = {}) => {
  return axiosInstance.put(endpoint, params);
};

// Delete Data with optional data
export const deleteRequest = (endpoint, params = {}) => {
  return axiosInstance.delete(endpoint, { data: params });
};

// Post Data with form-data content type. File uploads legitimately take
// much longer than regular JSON API calls (the axios instance's default
// timeout is tuned for those), so give uploads a generous floor here -
// callers with an even heavier payload (e.g. video) can still pass a
// larger `timeout` in config to override it.
const DEFAULT_UPLOAD_TIMEOUT = 120000;

export const postFormDataRequest = (endpoint, params = {}, config = {}) => {
  return axiosInstance.post(endpoint, params, {
    timeout: DEFAULT_UPLOAD_TIMEOUT,
    ...config,
    headers: {
      "Content-Type": "multipart/form-data",
      ...(config.headers || {}),
    },
  });
};
