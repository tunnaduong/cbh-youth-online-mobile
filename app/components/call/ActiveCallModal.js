import React, { useContext } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../contexts/AuthContext";
import FastImage from "../FastImage";
import { AvatarFrameWrap } from "../profile/AvatarFrame";
import UserNameRow from "../profile/UserNameRow";

const { width } = Dimensions.get("window");

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function ActiveCallModal({
  visible,
  call,
  callStatus, // 'calling' | 'connected'
  callDuration = 0,
  isMuted = false,
  isSpeakerOn = false,
  isMinimized = false,
  onToggleMute,
  onToggleSpeaker,
  onToggleMinimize,
  onEndCall,
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { userInfo } = useContext(AuthContext);

  if (!visible || !call) return null;

  // If current logged-in user initiated the call, show the remote receiver/participant
  const isOutgoing =
    (userInfo?.id && (call.caller?.id === userInfo.id || call.caller_id === userInfo.id)) ||
    (userInfo?.username && call.caller?.username === userInfo.username);

  const remotePeer = isOutgoing
    ? (call.receiver || call.participant || {})
    : (call.caller || {});

  const displayName =
    remotePeer.profile_name ||
    remotePeer.name ||
    remotePeer.username ||
    t("chatConversation.call", "Cuộc gọi");

  const avatarUrl =
    remotePeer.avatar_url ||
    (remotePeer.username
      ? `https://api.chuyenbienhoa.com/v1.0/users/${remotePeer.username}/avatar`
      : null);
  const isVideo = call.type === "video";

  // Minimized Floating Pill Overlay
  if (isMinimized) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onToggleMinimize}
        style={[styles.floatingPill, { top: insets.top + 10 }]}
      >
        <LinearGradient
          colors={["#166534", "#0a2916"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.pillAvatar}>
          {avatarUrl ? (
            <FastImage source={{ uri: avatarUrl }} style={styles.pillAvatarImg} />
          ) : (
            <View style={styles.pillAvatarPlaceholder}>
              <Text style={styles.pillInitial}>{displayName[0]?.toUpperCase() || "?"}</Text>
            </View>
          )}
        </View>
        <View style={styles.pillInfo}>
          <Text style={styles.pillName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.pillTimer}>
            {callStatus === "connected" ? formatDuration(callDuration) : t("call.connecting", "Đang kết nối...")}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.pillEndBtn}
          onPress={onEndCall}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="call" size={16} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // Full-Screen Active Call Screen
  return (
    <Modal visible={visible} transparent animationType="slide">
      <LinearGradient
        colors={["#0c381c", "#072312", "#031209"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }]}
      >
        <LinearGradient
          colors={["rgba(34, 197, 94, 0.4)", "rgba(34, 197, 94, 0.08)", "transparent"]}
          style={styles.ambientTopGlow}
          pointerEvents="none"
        />
        {/* Top bar with Minimize */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onToggleMinimize}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerBadge}>
            {isVideo ? t("call.videoCall", "Cuộc gọi video") : t("call.voiceCall", "Cuộc gọi thoại")}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Center: Remote Participant Info & Timer */}
        <View style={styles.centerSection}>
          <View style={styles.avatarWrap}>
            <AvatarFrameWrap size={130} theme={remotePeer.profile_theme}>
              {avatarUrl ? (
                <FastImage source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{displayName[0]?.toUpperCase() || "?"}</Text>
                </View>
              )}
            </AvatarFrameWrap>
          </View>

          <UserNameRow
            name={displayName}
            theme={remotePeer.profile_theme}
            style={styles.callerName}
            containerStyle={{ justifyContent: "center", marginTop: 18 }}
          />
          {remotePeer.username && (
            <Text style={styles.username}>@{remotePeer.username}</Text>
          )}

          <View style={styles.timerBadge}>
            <View style={[styles.statusDot, { backgroundColor: callStatus === "connected" ? "#22C55E" : "#EAB308" }]} />
            <Text style={styles.timerText}>
              {callStatus === "connected"
                ? formatDuration(callDuration)
                : t("call.callingStatus", "Đang đổ chuông...")}
            </Text>
          </View>
        </View>

        {/* Bottom Control Bar */}
        <View style={styles.controlsRow}>
          {/* Mute Mic */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            activeOpacity={0.8}
            onPress={onToggleMute}
          >
            <Ionicons
              name={isMuted ? "mic-off" : "mic"}
              size={26}
              color={isMuted ? "#EF4444" : "#FFFFFF"}
            />
            <Text style={styles.controlLabel}>{isMuted ? t("call.unmute", "Bật mic") : t("call.mute", "Tắt mic")}</Text>
          </TouchableOpacity>

          {/* End Call */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.endCallBtn]}
            activeOpacity={0.8}
            onPress={onEndCall}
          >
            <Ionicons name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            <Text style={[styles.controlLabel, { color: "#EF4444" }]}>{t("call.end", "Kết thúc")}</Text>
          </TouchableOpacity>

          {/* Speaker / Loa ngoài */}
          <TouchableOpacity
            style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
            activeOpacity={0.8}
            onPress={onToggleSpeaker}
          >
            <Ionicons
              name={isSpeakerOn ? "volume-high" : "volume-medium"}
              size={26}
              color={isSpeakerOn ? "#22C55E" : "#FFFFFF"}
            />
            <Text style={styles.controlLabel}>{isSpeakerOn ? t("call.speakerOn", "Loa ngoài") : t("call.speaker", "Loa")}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ambientTopGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  container: {
    flex: 1,
    backgroundColor: "#0B130E",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  headerBtn: {
    padding: 6,
  },
  headerBadge: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4ADE80",
  },
  centerSection: {
    alignItems: "center",
  },
  avatarWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  avatar: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  avatarPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 52,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  callerName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  username: {
    fontSize: 15,
    color: "#9CA3AF",
    marginTop: 4,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  timerText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E5E7EB",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  controlBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  controlBtnActive: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  endCallBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EF4444",
  },
  controlLabel: {
    position: "absolute",
    bottom: -22,
    fontSize: 12,
    fontWeight: "500",
    color: "#D1D5DB",
  },
  floatingPill: {
    position: "absolute",
    right: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 30, 24, 0.94)",
    borderRadius: 28,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(74, 222, 128, 0.3)",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  pillAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
  },
  pillAvatarImg: {
    width: 32,
    height: 32,
  },
  pillAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  pillInitial: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pillInfo: {
    marginHorizontal: 8,
    maxWidth: 110,
  },
  pillName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pillTimer: {
    fontSize: 11,
    color: "#4ADE80",
    fontWeight: "500",
  },
  pillEndBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
