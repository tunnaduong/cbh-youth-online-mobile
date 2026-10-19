import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../../contexts/ThemeContext";
import LiquidButton from "../../../../components/LiquidButton";
import UserNameRow from "../../../../components/profile/UserNameRow";
import StyledUsername from "../../../../components/profile/StyledUsername";
import AvatarFrame from "../../../../components/profile/AvatarFrame";
import ChatGlassBar from "./ChatGlassBar";

export const CHAT_HEADER_BAR_HEIGHT = 56;

// Messenger-style header: one flat glass bar with back, the avatar and the
// name / second line left-aligned, and the options button. The buttons keep
// LiquidButton's press spring but draw no glass of their own - they already
// sit on the bar's glass (nested glass ghosts, and costs a shader on Android).
const ConversationHeader = ({
  insetsTop,
  avatarSource,
  profileTheme,
  showOnlineDot,
  title,
  username,
  subtitle,
  onBack,
  onPressTitle,
  onOptions,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <ChatGlassBar
        edge="top"
        style={{ paddingTop: insetsTop, height: CHAT_HEADER_BAR_HEIGHT + insetsTop }}
      >
        <View style={styles.row}>
          <LiquidButton
            size={44}
            forceNoGlass
            backgroundColor="transparent"
            onPress={onBack}
            accessibilityLabel={t("chatConversation.back")}
          >
            <Ionicons name="chevron-back" size={26} color={theme.primary} />
          </LiquidButton>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPressTitle}
            style={styles.titleButton}
            accessibilityRole="button"
          >
            <View style={styles.avatarOuter}>
              <Image source={avatarSource} style={styles.avatar} />
              <AvatarFrame theme={profileTheme} size={40} />
              {showOnlineDot ? (
                <View style={[styles.onlineDot, { borderColor: theme.background }]} />
              ) : null}
            </View>
            <View style={styles.textBlock}>
              <UserNameRow
                name={title}
                theme={profileTheme}
                style={[styles.name, { color: theme.text }]}
                containerStyle={{ maxWidth: "100%" }}
              />
              {username ? (
                <StyledUsername
                  theme={profileTheme}
                  username={username}
                  style={[styles.subtitle, { color: theme.subText }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                />
              ) : subtitle ? (
                <Text style={[styles.subtitle, { color: theme.subText }]} numberOfLines={1} ellipsizeMode="tail">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          <LiquidButton
            size={44}
            forceNoGlass
            backgroundColor="transparent"
            onPress={onOptions}
            accessibilityLabel={t("chatConversation.optionsTitle")}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      </ChatGlassBar>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
});

export default React.memo(ConversationHeader);
