import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import FastImage from "../FastImage";
import { useTheme } from "../../contexts/ThemeContext";
import { getBannerFill, getSurfaceColors } from "../../utils/profileTheme";
import UserNameRow from "./UserNameRow";
import StyledUsername from "./StyledUsername";
import { AvatarFrameWrap } from "./AvatarFrame";
import ProfileEffect from "./ProfileEffect";
import ProfileFrame from "./ProfileFrame";

const RADIUS = 20;

/** Ảnh bìa theo theme: ảnh bìa thật, hoặc màu ảnh bìa / gradient màu giao diện. */
export function ThemedBanner({ theme, coverUrl, style, fallbackColor }) {
  const fill = coverUrl ? null : getBannerFill(theme);
  if (coverUrl) {
    return <FastImage source={{ uri: coverUrl }} style={style} resizeMode="cover" />;
  }
  if (fill?.colors) {
    return <LinearGradient colors={fill.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style} />;
  }
  return <View style={[style, { backgroundColor: fill?.color || fallbackColor }]} />;
}

/** Lớp phủ màu theme lên một thẻ (kiểu Profile Theme của Discord). */
export function ThemedSurface({ theme, radius = 0 }) {
  const colors = getSurfaceColors(theme);
  if (!colors) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}

/**
 * Thẻ trang cá nhân ở đầu trình chỉnh sửa - giống thẻ profile Discord dùng
 * làm bản xem trước: mọi thay đổi hiện ngay trên đó, kèm cách tên + avatar
 * trông ra sao cạnh bài viết/bình luận.
 */
export default function ProfilePreviewCard({
  theme: profileTheme,
  username,
  profileName,
  avatarUrl,
  coverUrl,
  bio,
  joinedAt,
  points,
  effectReplayKey,
}) {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const cardBackground = isDarkMode ? "#262626" : "#ffffff";

  return (
    <View style={[styles.card, { backgroundColor: cardBackground, borderColor: theme.border }]}>
      <ThemedSurface theme={profileTheme} radius={RADIUS} />
      <ThemedBanner
        theme={profileTheme}
        coverUrl={coverUrl}
        style={styles.banner}
        fallbackColor={isDarkMode ? "#525252" : "#d1d5db"}
      />

      <View style={styles.content}>
        <AvatarFrameWrap theme={profileTheme} size={96} style={styles.avatarWrap}>
          <FastImage
            source={{ uri: avatarUrl }}
            style={[styles.avatar, { borderColor: cardBackground }]}
          />
        </AvatarFrameWrap>

        <UserNameRow
          name={profileName}
          theme={profileTheme}
          variant="full"
          style={[styles.name, { color: theme.text }]}
          containerStyle={styles.nameRow}
        />
        <StyledUsername
          theme={profileTheme}
          username={username}
          variant="full"
          style={[styles.username, { color: theme.subText }]}
          numberOfLines={1}
        />

        {bio ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.subText }]}>{t("profileTheme.preview.about", "Giới thiệu")}</Text>
            <Text style={[styles.value, { color: theme.text }]} numberOfLines={4}>
              {bio}
            </Text>
          </View>
        ) : null}
        <View style={[styles.field, styles.row]}>
          {joinedAt ? (
            <View>
              <Text style={[styles.label, { color: theme.subText }]}>{t("profileTheme.preview.joined", "Tham gia")}</Text>
              <Text style={[styles.value, { color: theme.text }]}>{joinedAt}</Text>
            </View>
          ) : null}
          <View>
            <Text style={[styles.label, { color: theme.subText }]}>{t("profileTheme.preview.points", "Điểm")}</Text>
            <Text style={[styles.value, { color: theme.text }]}>{points}</Text>
          </View>
        </View>

        {/* How the name and avatar look next to posts/comments */}
        <View style={[styles.inComment, { borderTopColor: theme.border }]}>
          <AvatarFrameWrap theme={profileTheme} size={36}>
            <FastImage source={{ uri: avatarUrl }} style={styles.smallAvatar} />
          </AvatarFrameWrap>
          <View style={styles.shrink}>
            <UserNameRow
              name={profileName}
              theme={profileTheme}
              style={[styles.smallName, { color: theme.text }]}
            />
            <Text style={[styles.caption, { color: theme.subText }]}>
              {t("profileTheme.preview.inComments", "Trong bình luận")}
            </Text>
          </View>
        </View>
      </View>

      <ProfileEffect theme={profileTheme} replayKey={effectReplayKey} />
      <ProfileFrame theme={profileTheme} radius={RADIUS} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  banner: { height: 120, width: "100%" },
  content: { paddingHorizontal: 18, paddingBottom: 18 },
  avatarWrap: { marginTop: -48, marginBottom: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 5, backgroundColor: "#fff" },
  name: { fontSize: 24, fontWeight: "bold" },
  nameRow: { alignSelf: "flex-start", maxWidth: "100%" },
  username: { fontSize: 14, marginTop: 2 },
  field: { marginTop: 14 },
  row: { flexDirection: "row", gap: 28 },
  label: { fontSize: 13, fontWeight: "600" },
  value: { fontSize: 14, marginTop: 2 },
  inComment: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff" },
  shrink: { flexShrink: 1 },
  smallName: { fontSize: 14, fontWeight: "600" },
  caption: { fontSize: 12 },
});
