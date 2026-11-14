import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import LiquidButton from "../../../../components/LiquidButton";
import UserNameRow from "../../../../components/profile/UserNameRow";
import StyledUsername from "../../../../components/profile/StyledUsername";
import AvatarFrame from "../../../../components/profile/AvatarFrame";
import ChatGlassBar from "./ChatGlassBar";
import ConversationHeaderBackground from "./ConversationHeaderBackground";

export const CHAT_HEADER_BAR_HEIGHT = 60;

// Curved organic wave header with pure SVG background, avatar, handle, call and menu options.
// For conversations with a custom wallpaper background, falls back to a clean flat frosted ChatGlassBar.
const ConversationHeader = ({
  insetsTop,
  avatarSource,
  avatarUrl,
  profileTheme,
  showOnlineDot,
  title,
  username,
  subtitle,
  onBack,
  onPressTitle,
  onOptions,
  onCall,
  canCall = true,
  hasCustomBackground = false,
  inBubble = false,
}) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  const initial = title?.trim()?.[0]?.toUpperCase() || "?";
  const isLocal = avatarSource === require("../../../../assets/chat.jpg");
  const isPlaceholder =
    !avatarUrl ||
    (typeof avatarUrl === "string" &&
      (avatarUrl.includes("placeholder-user.jpg") ||
        avatarUrl.includes("default-avatar.png") ||
        avatarUrl.trim() === ""));

  const primaryAccent = isDarkMode ? "#22C55E" : "#16A34A";

  const handleCallPress = () => {
    if (onCall) {
      onCall();
    } else {
      Alert.alert(
        t("chatConversation.call", "Cuộc gọi"),
        t("chatConversation.callNotice", "Tính năng gọi điện đang được cập nhật.")
      );
    }
  };

  // Common header content row
  const headerContentRow = (
    <View pointerEvents="box-none" style={styles.row}>
      {inBubble ? (
        // Plain button: the glass button's native view is not available in the
        // bubble's process, which left the header without a back button.
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t("chatConversation.back")}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" }}
        >
          <Ionicons name="chevron-back" size={22} color={isDarkMode ? "#4ADE80" : "#15803D"} />
        </TouchableOpacity>
      ) : (
        <LiquidButton
          size={40}
          forceNoGlass
          backgroundColor={isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)"}
          onPress={onBack}
          accessibilityLabel={t("chatConversation.back")}
        >
          <Ionicons name="chevron-back" size={22} color={isDarkMode ? "#4ADE80" : "#15803D"} />
        </LiquidButton>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPressTitle}
        style={styles.titleButton}
        accessibilityRole="button"
      >
        <View style={styles.avatarOuter}>
          {imgError || (!isLocal && isPlaceholder) ? (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                {
                  backgroundColor: hasCustomBackground
                    ? theme.iconBackground
                    : isDarkMode
                    ? "#D81B60"
                    : "#F43F5E",
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarFallbackInitial,
                  hasCustomBackground ? { color: theme.primary } : null,
                ]}
              >
                {initial}
              </Text>
            </View>
          ) : (
            <Image
              source={avatarSource}
              style={styles.avatar}
              onError={() => setImgError(true)}
            />
          )}
          <AvatarFrame theme={profileTheme} size={40} />
          {showOnlineDot ? (
            <View
              style={[
                styles.onlineDot,
                {
                  borderColor: hasCustomBackground
                    ? theme.background
                    : isDarkMode
                    ? "#04140E"
                    : "#E8F8F0",
                },
              ]}
            />
          ) : null}
        </View>
        <View style={styles.textBlock}>
          <UserNameRow
            name={title}
            theme={profileTheme}
            style={[
              styles.name,
              { color: hasCustomBackground ? theme.text : isDarkMode ? "#FFFFFF" : "#0F172A" },
            ]}
            containerStyle={{ maxWidth: "100%" }}
          />
          {username ? (
            <StyledUsername
              theme={profileTheme}
              username={username}
              style={[
                styles.subtitle,
                { color: hasCustomBackground ? theme.subText : isDarkMode ? "#8E9E96" : "#4B5563" },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            />
          ) : subtitle ? (
            <Text
              style={[
                styles.subtitle,
                { color: hasCustomBackground ? theme.subText : isDarkMode ? "#8E9E96" : "#4B5563" },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        {canCall && (
        <LiquidButton
          size={40}
          forceNoGlass
          backgroundColor={isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)"}
          onPress={handleCallPress}
          accessibilityLabel={t("chatConversation.call", "Cuộc gọi")}
        >
          <Ionicons name="call" size={19} color={isDarkMode ? "#4ADE80" : "#15803D"} />
        </LiquidButton>
      )}

        <LiquidButton
          size={40}
          forceNoGlass
          backgroundColor={isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)"}
          onPress={onOptions}
          accessibilityLabel={t("chatConversation.optionsTitle")}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={isDarkMode ? "#4ADE80" : "#15803D"} />
        </LiquidButton>
      </View>
    </View>
  );

  // If conversation has a custom background wallpaper, render clean, solid header
  // so scrolled messages never bleed through into the header area.
  if (hasCustomBackground) {
    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          {
            backgroundColor: isDarkMode ? "#0B1410" : "#FFFFFF",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.3 : 0.05,
            shadowRadius: 4,
            elevation: 3,
          },
        ]}
      >
        <View
          style={{
            width: "100%",
            paddingTop: insetsTop,
            height: 56 + insetsTop,
          }}
        >
          {headerContentRow}
        </View>
      </View>
    );
  }

  // Default mascot frog theme: render organic curved SVG wave background
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      {/* 1. Pure SVG Organic Wave Background */}
      <ConversationHeaderBackground height={CHAT_HEADER_BAR_HEIGHT + insetsTop + 18} />

      {/* 2. Header Content Row */}
      <View
        pointerEvents="box-none"
        style={[
          styles.headerContent,
          {
            paddingTop: insetsTop,
            height: CHAT_HEADER_BAR_HEIGHT + insetsTop,
          },
        ]}
      >
        {headerContentRow}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    zIndex: 10,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  titleButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    marginRight: 4,
  },
  avatarOuter: {
    width: 40,
    height: 40,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackInitial: {
    fontSize: 16,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "#16a34a",
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerContent: {
    width: "100%",
    zIndex: 2,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
  },
});

export default React.memo(ConversationHeader);
