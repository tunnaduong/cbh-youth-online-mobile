import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSocketId } from "../echo/echo";

// Online-status should not be hammered on every API response.
// Throttle to at most once every 60 seconds.
let lastOnlineStatusAt = 0;
const ONLINE_STATUS_INTERVAL = 60_000;

// You can define the base URL here or make it dynamic
const axiosInstance = axios.create({
  baseURL: "https://api.chuyenbienhoa.com/", // Replace with your API's base URL
  timeout: 30000, // 30s — enough headroom for weak mobile networks
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

      // Lets broadcast()->toOthers() on the backend exclude this device's own socket
      const socketId = getSocketId();
      if (socketId) {
        config.headers["X-Socket-Id"] = socketId;
      }

      try {
        const url = config?.url || "";
        const isReportEndpoint =
          (url && url.toLowerCase().includes("/v1.0/reports")) ||
          (url && url.toLowerCase().includes("report"));

        if (isReportEndpoint) {
          let dataPreview = null;
          try {
            if (config.data && config.data._parts) {
              dataPreview = "FormData";
            } else if (config.data) {
              dataPreview = JSON.stringify(config.data);
              if (dataPreview && dataPreview.length > 1000)
                dataPreview = dataPreview.slice(0, 1000) + "...";
            }
          } catch (e) {
            dataPreview = "<unserializable>";
          }

          console.log("[API REQUEST] REPORT ->", {
            method: config.method,
            url: config.url,
            hasAuthorizationHeader: !!config.headers?.Authorization,
            dataPreview,
          });
        }
      } catch (e) {
        // non-fatal logging error
        console.warn("[API REQUEST] report logging failed", e?.message || e);
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
      const now = Date.now();
      if (
        token &&
        !response.config.url.includes("/v1.0/online-status") &&
        !response.config.url.includes("/v1.0/login") &&
        !response.config.url.includes("/v1.0/register") &&
        now - lastOnlineStatusAt >= ONLINE_STATUS_INTERVAL
      ) {
        lastOnlineStatusAt = now;
        axiosInstance.post("/v1.0/online-status").catch(() => {});
      }
    } catch (error) {
      console.error("--- ONLINE STATUS UPDATE ERROR ---");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Error Data:", JSON.stringify(error.response.data, null, 2));
        console.error("Request URL:", error.config?.url);
        console.error("Authorization Header:", error.config?.headers?.Authorization ? "Present" : "Missing");
      } else {
        console.error("Message:", error.message);
      }
      console.error("----------------------------------");
    }
    try {
      const url = response?.config?.url || "";
      const isReportEndpoint =
        (url && url.toLowerCase().includes("/v1.0/reports")) ||
        (url && url.toLowerCase().includes("report"));

      if (isReportEndpoint) {
        console.log("[API RESPONSE] REPORT <-", {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
      }
    } catch (e) {
      console.warn("[API RESPONSE] report logging failed", e?.message || e);
    }

    return response;
  },
  (error) => {
    try {
      const cfg = error?.config || {};
      const url = cfg.url || "";
      const isReportEndpoint =
        (url && url.toLowerCase().includes("/v1.0/reports")) ||
        (url && url.toLowerCase().includes("report"));

      // Preview the outgoing request body too - the response alone (e.g. a
      // bare 500 with a generic message) is often not enough to tell which
      // request actually caused it, especially for endpoints that accept a
      // payload (send message, create post, etc).
      let requestDataPreview = null;
      try {
        if (cfg.data && cfg.data._parts) {
          // FormData: log field names only, skip binary/file blobs.
          requestDataPreview = cfg.data._parts.map(([key, value]) => [
            key,
            value && typeof value === "object" && value.uri ? `<file:${value.name || value.uri}>` : value,
          ]);
        } else if (cfg.data) {
          requestDataPreview =
            typeof cfg.data === "string" ? cfg.data : JSON.stringify(cfg.data);
          if (requestDataPreview && requestDataPreview.length > 1000) {
            requestDataPreview = requestDataPreview.slice(0, 1000) + "...";
          }
        }
      } catch (e) {
        requestDataPreview = "<unserializable>";
      }

      const logObj = {
        url,
        method: cfg.method,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        responseData: error?.response?.data,
        requestDataPreview,
        errorCode: error?.code,
        errorMessage: error?.message,
        hasAuthorizationHeader: !!cfg.headers?.Authorization,
        timestamp: new Date().toISOString(),
      };

      console.error("[API ERROR]", logObj);

      if (isReportEndpoint) {
        console.error("[API ERROR] REPORT DETAILS ->", logObj);
      }
    } catch (e) {
      console.error("[API ERROR] failed to log error details", e?.message || e);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
