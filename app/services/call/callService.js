import axiosInstance from "../api/axiosInstance";

/**
 * WebRTC Calling API endpoints for CYO mobile
 */

export const getIceServers = async () => {
  return axiosInstance.get("/v1.0/chat/calls/ice-servers");
};

export const getActiveCall = async () => {
  return axiosInstance.get("/v1.0/chat/calls/active");
};

export const initiateCall = async (conversationId, type = "audio") => {
  return axiosInstance.post(`/v1.0/chat/conversations/${conversationId}/call/initiate`, { type });
};

export const answerCall = async (callId) => {
  return axiosInstance.post(`/v1.0/chat/calls/${callId}/answer`);
};

export const rejectCall = async (callId, reason = "rejected") => {
  return axiosInstance.post(`/v1.0/chat/calls/${callId}/reject`, { reason });
};

export const endCall = async (callId) => {
  return axiosInstance.post(`/v1.0/chat/calls/${callId}/end`);
};

export const sendCallSignal = async (callId, type, payload) => {
  return axiosInstance.post(`/v1.0/chat/calls/${callId}/signal`, { type, payload });
};
