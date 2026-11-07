import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import FastImage from "../FastImage";
import { AvatarFrameWrap } from "../profile/AvatarFrame";
import UserNameRow from "../profile/UserNameRow";

const { width } = Dimensions.get("window");

export default function IncomingCallModal({
  visible,
  call,
  onAnswer,
  onReject,
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible, pulseAnim]);

  if (!visible || !call) return null;

  const caller = call.caller || {};
  const callerName = caller.profile_name || caller.name || caller.username || t("chatConversation.call", "Cuộc gọi");
  const avatarUrl =
    caller.avatar_url ||
    (caller.username
      ? `https://api.chuyenbienhoa.com/v1.0/users/${caller.username}/avatar`
      : null);
  const isVideo = call.type === "video";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <LinearGradient
        colors={["#0c381c", "#072312", "#031209"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.overlay, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
      >
        <LinearGradient
          colors={["rgba(34, 197, 94, 0.4)", "rgba(34, 197, 94, 0.08)", "transparent"]}
          style={styles.ambientTopGlow}
          pointerEvents="none"
        />
        {/* Caller Info Header */}
        <View style={styles.topInfo}>
          <Text style={styles.incomingLabel}>
            {isVideo ? t("call.incomingVideo", "Cuộc gọi video đến...") : t("call.incomingVoice", "Cuộc gọi thoại đến...")}
          </Text>
          <UserNameRow
            name={callerName}
            theme={caller.profile_theme}
            style={styles.callerName}
            containerStyle={{ justifyContent: "center", marginTop: 8 }}
          />
          {caller.username && (
            <Text style={styles.username}>@{caller.username}</Text>
          )}
        </View>

        {/* Pulsing Avatar Frame */}
        <View style={styles.avatarSection}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.25],
                  outputRange: [0.6, 0.15],
                }),
              },
            ]}
          />
          <View style={styles.avatarContainer}>
            <AvatarFrameWrap size={120} theme={caller.profile_theme}>
              {avatarUrl ? (
                <FastImage source={{ uri: avatarUrl }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {callerName.trim()[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
            </AvatarFrameWrap>
          </View>
        </View>

        {/* Call Action Buttons: Reject & Accept */}
        <View style={styles.actionsRow}>
          <View style={styles.actionCol}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onReject}
              style={[styles.callBtn, styles.rejectBtn]}
              accessibilityLabel={t("call.reject", "Từ chối")}
            >
              <Ionicons name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{t("call.reject", "Từ chối")}</Text>
          </View>

          <View style={styles.actionCol}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onAnswer}
              style={[styles.callBtn, styles.answerBtn]}
              accessibilityLabel={t("call.answer", "Trả lời")}
            >
              <Ionicons name={isVideo ? "videocam" : "call"} size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{t("call.answer", "Trả lời")}</Text>
          </View>
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
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  topInfo: {
    alignItems: "center",
  },
  incomingLabel: {
    fontSize: 16,
    color: "#4ADE80",
    fontWeight: "600",
    letterSpacing: 0.2,
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
  avatarSection: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 220,
    height: 220,
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#22C55E",
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    maxWidth: 320,
  },
  actionCol: {
    alignItems: "center",
  },
  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  rejectBtn: {
    backgroundColor: "#EF4444",
  },
  answerBtn: {
    backgroundColor: "#22C55E",
  },
  actionLabel: {
    marginTop: 12,
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
});
