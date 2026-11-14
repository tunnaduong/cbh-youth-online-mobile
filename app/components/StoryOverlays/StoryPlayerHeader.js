import React from "react";
import { View, Text, TouchableOpacity, Pressable, Dimensions, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "../FastImage";
import UserNameRow from "../profile/UserNameRow";
import { AvatarFrameWrap } from "../profile/AvatarFrame";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Header of the full-screen story player (Home feed and Archive): a dark glass
// pill with the author (framed avatar, name, time) on the left and round dark
// buttons (mute, options, close) on the right. Left-aligned like a normal
// header instead of the old name floating in the middle of the picture.
export default function StoryPlayerHeader({
  avatarSource,
  name,
  date,
  profileTheme,
  onAvatarPress,
  onMore,
  onClose,
  muteButton,
}) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.authorPill}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={onAvatarPress}
      >
        {avatarSource ? (
          <AvatarFrameWrap theme={profileTheme} size={34}>
            <View style={styles.avatarClip}>
              <FastImage source={avatarSource} style={styles.avatar} />
            </View>
          </AvatarFrameWrap>
        ) : null}
        <View style={styles.authorText}>
          {name ? (
            <UserNameRow
              name={name}
              theme={profileTheme}
              variant="compact"
              containerStyle={{ maxWidth: "100%" }}
              style={styles.name}
            />
          ) : null}
          {date ? (
            <Text numberOfLines={1} style={styles.date}>
              {date}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {muteButton || null}
        {onMore ? (
          <TouchableOpacity
            style={styles.roundButton}
            onPress={onMore}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
        {onClose ? (
          <TouchableOpacity
            style={styles.roundButton}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// Round dark button for extra actions (e.g. the mute toggle).
export function StoryRoundButton({ icon, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.roundButton, disabled && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={19} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    width: SCREEN_WIDTH - 32,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.38)",
    borderRadius: 24,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 14,
    marginRight: 10,
    maxWidth: "100%",
  },
  avatarClip: { width: 34, height: 34, borderRadius: 17, overflow: "hidden" },
  avatar: { width: 34, height: 34 },
  authorText: { flexShrink: 1, minWidth: 0, marginLeft: 9 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  date: { color: "rgba(255,255,255,0.78)", fontSize: 11.5, marginTop: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
});
