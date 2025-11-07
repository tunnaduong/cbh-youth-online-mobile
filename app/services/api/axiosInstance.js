import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// You can define the base URL here or make it dynamic
const axiosInstance = axios.create({
  baseURL: "https://api.chuyenbienhoa.com/", // Replace with your API's base URL
  timeout: 10000, // Optional: Timeout in milliseconds
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach token
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      // Retrieve the token from AsyncStorage
      const token = await AsyncStorage.getItem("auth_token");

      if (token) {
        // Attach the token to the request header
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error retrieving token from AsyncStorage:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
axiosInstance.interceptors.response.use(
  async (response) => {
    try {
      // Check if user is authenticated before updating online status
      const token = await AsyncStorage.getItem("auth_token");

      // Don't call updateOnlineStatus if the current request is already updating online status
      // or if the user is not authenticated
      if (
        token &&
        !response.config.url.includes("/v1.0/online-status") &&
        !response.config.url.includes("/v1.0/login") &&
        !response.config.url.includes("/v1.0/register")
      ) {
        await axiosInstance.post("/v1.0/online-status");
      }
    } catch (error) {
      console.error("Error updating online status:", error);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
