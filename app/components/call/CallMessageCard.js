import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCall } from "../../contexts/CallContext";
import { CALL_FEATURES_ENABLED } from "../../services/call/callConfig";

function formatSeconds(secs) {
  if (!secs && secs !== 0) return "";
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function isCallMessage(item) {
  if (!item) return false;
  if (item.type === "call" || item.content_type === "call") return true;
  if (item.metadata?.call_id || item.metadata?.call_type) return true;
  if (
    item.content_type === "system" &&
    typeof item.content === "string" &&
    (item.content.toLowerCase().includes("cuộc gọi") || item.content.toLowerCase().includes("call"))
  ) {
    return true;
  }
  return false;
}

export default function CallMessageCard({
  message,
  conversationId,
  theme,
  isDarkMode,
  t,
}) {
  const { startCall } = useCall();
  const meta = message?.metadata || {};
  const isVideo = meta.call_type === "video";
  const status = meta.status;
  const isMissed =
    status === "missed" ||
    status === "rejected" ||
    status === "busy" ||
    status === "cancelled" ||
    meta.end_reason === "missed" ||
    meta.end_reason === "rejected" ||
    meta.end_reason === "cancelled";

  const isMyself = message?.is_myself === true;
  const duration = meta.duration ? formatSeconds(meta.duration) : null;

  const titleText = isMissed
    ? isVideo
      ? t("call.missedVideo", "Cuộc gọi video nhỡ")
      : t("call.missedAudio", "Cuộc gọi nhỡ")
    : isVideo
    ? t("call.videoCall", "Cuộc gọi video")
    : t("call.voiceCall", "Cuộc gọi thoại");

  const subtitleText = isMissed
    ? isMyself
      ? t("call.noAnswer", "Không có câu trả lời")
      : t("call.missed", "Cuộc gọi nhỡ")
    : duration
    ? `${t("call.ended", "Đã kết thúc")} · ${duration}`
    : t("call.ended", "Đã kết thúc");

  const handleCallback = () => {
    if (!CALL_FEATURES_ENABLED) return;
    if (conversationId) {
      startCall(conversationId, isVideo ? "video" : "audio");
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isMyself
              ? isDarkMode
                ? "rgba(20, 83, 45, 0.25)"
                : "#F0FDF4"
              : theme?.surface || (isDarkMode ? "#1E293B" : "#FFFFFF"),
            borderColor: isMyself
              ? isDarkMode
                ? "rgba(34, 197, 94, 0.35)"
                : "#BBF7D0"
              : theme?.border || (isDarkMode ? "#334155" : "#E2E8F0"),
          },
        ]}
      >
        {/* Call Icon Badge */}
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: isMissed
                ? isDarkMode
                  ? "rgba(239, 68, 68, 0.2)"
                  : "#FEE2E2"
                : isDarkMode
                ? "rgba(34, 197, 94, 0.2)"
                : "#DCFCE7",
            },
          ]}
        >
          <Ionicons
            name={
              isMissed
                ? "call-outline"
                : isVideo
                ? "videocam"
                : "call"
            }
            size={18}
            color={isMissed ? "#EF4444" : "#22C55E"}
            style={isMissed ? { transform: [{ rotate: "135deg" }] } : undefined}
          />
        </View>

        {/* Text info */}
        <View style={styles.infoCol}>
          <Text
            style={[
              styles.title,
              {
                color: isMissed
                  ? "#EF4444"
                  : theme?.text || (isDarkMode ? "#F8FAFC" : "#0F172A"),
              },
            ]}
            numberOfLines={1}
          >
            {titleText}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme?.subText || (isDarkMode ? "#94A3B8" : "#64748B") },
            ]}
            numberOfLines={1}
          >
            {subtitleText}
          </Text>
        </View>

        {/* Callback Button */}
        {CALL_FEATURES_ENABLED && conversationId && (
          <TouchableOpacity
            style={[
              styles.callbackBtn,
              {
                backgroundColor: isDarkMode ? "#334155" : "#F1F5F9",
              },
            ]}
            activeOpacity={0.7}
            onPress={handleCallback}
          >
            <Ionicons
              name={isVideo ? "videocam" : "call"}
              size={13}
              color={theme?.primary || "#15803D"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.callbackText,
                { color: theme?.primary || "#15803D" },
              ]}
            >
              {t("call.callBack", "Gọi lại")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  infoCol: {
    flexShrink: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  callbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: "auto",
  },
  callbackText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
