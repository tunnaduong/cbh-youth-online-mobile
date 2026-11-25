import axiosInstance from "../api/axiosInstance";

/**
 * WebRTC Calling API endpoints for CYO mobile
 */

export const getIceServers = async () => {
  return axiosInstance.get("/v1.0/chat/calls/ice-servers");
};

export const getActiveCall = async (callId = null, sinceSeq = 0) => {
  const params = [];
  if (callId) params.push(`call_id=${encodeURIComponent(callId)}`);
  // Only newer signals: no stale replays, smaller payload (API ignores it when 0).
  if (sinceSeq > 0) params.push(`since_seq=${sinceSeq}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  return axiosInstance.get(`/v1.0/chat/calls/active${qs}`);
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
