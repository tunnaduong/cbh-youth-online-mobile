import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import FastImage from "../FastImage";
import { useTheme } from "../../contexts/ThemeContext";
import { themeColors } from "../../utils/profileTheme";
import StyledName from "./StyledName";
import { AvatarFrameWrap } from "./AvatarFrame";
import ProfileFrame from "./ProfileFrame";

// Same colors as the milestones sheet on ProfileScreen.
const TIER_COLORS = {
  trainee: "#6b7280",
  active: "#3b82f6",
  distinguished: "#eab308",
  veteran: "#a855f7",
  premium: "#f43f5e",
  promax: "#f97316",
};

const EFFECT_SYMBOLS = { sparkles: "✦", hearts: "♥", snow: "❄", aurora: "✺" };
const TRYABLE = [
  "name_font",
  "name_effect",
  "avatar_frame",
  "profile_effect",
  "profile_frame",
  "name_icon",
  "username_style",
];

/**
 * Where `points` sits on the milestone track, in %. Milestones are evenly
 * spaced (not to scale) so 50 and 150 don't get squashed next to 1000.
 */
function trackPosition(points, tiers) {
  const stops = [0, ...tiers.map((tier) => tier.min_points)];
  const step = 100 / (stops.length - 1);
  for (let i = 1; i < stops.length; i++) {
    if (points < stops[i]) {
      return (i - 1 + (points - stops[i - 1]) / (stops[i] - stops[i - 1])) * step;
    }
  }
  return 100;
}

// Small visual sample of one unlockable option.
function Sample({ item, profileTheme, avatarUrl }) {
  const { theme, isDarkMode } = useTheme();
  const { field, key } = item;

  if (field === "avatar_frame") {
    return (
      <AvatarFrameWrap theme={{ ...profileTheme, avatar_frame: key }} size={26}>
        <FastImage source={{ uri: avatarUrl }} style={styles.sampleAvatar} />
      </AvatarFrameWrap>
    );
  }
  if (field === "name_font" || field === "name_effect") {
    return (
      <StyledName
        theme={
          field === "name_font"
            ? { ...profileTheme, name_font: key, name_effect: "none" }
            : { ...profileTheme, name_effect: key }
        }
        style={[styles.sampleText, { color: theme.text }]}
      >
        Aa
      </StyledName>
    );
  }
  if (field === "profile_effect") {
    return (
      <LinearGradient colors={["#64748b", "#334155"]} style={styles.sampleFill}>
        <Text style={styles.sampleSymbol}>{EFFECT_SYMBOLS[key] || "✦"}</Text>
      </LinearGradient>
    );
  }
  if (field === "profile_frame") {
    return (
      <View style={[styles.sampleFrame, { backgroundColor: isDarkMode ? "#525252" : "#e5e7eb" }]}>
        <ProfileFrame theme={{ ...profileTheme, profile_frame: key }} radius={4} />
      </View>
    );
  }
  // Pro: the glyph itself (sent by the API), an @ in the name's style,
  // and "emoji and special characters in the name".
  if (field === "name_icon") {
    return <Text style={[styles.sampleGlyph, { color: theme.text }]}>{item.icon}</Text>;
  }
  if (field === "username_style") {
    return (
      <StyledName
        theme={{ ...profileTheme, username_style: key }}
        style={[styles.sampleText, { color: theme.text }]}
      >
        @
      </StyledName>
    );
  }
  if (field === "fancy_name") {
    return <Text style={[styles.sampleGlyph, { color: theme.text }]}>𝓐✨</Text>;
  }
  if (field === "theme_colors") {
    return <LinearGradient colors={themeColors(profileTheme)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sampleFill} />;
  }
  return <Text style={[styles.gif, { color: theme.text }]}>GIF</Text>;
}

/**
 * "Mốc điểm": thanh mốc cho biết người dùng đang ở đâu, và mỗi mốc mở khoá
 * những gì. Bấm một mẫu để thử ngay trên thẻ xem trước.
 *
 * Props:
 *   editor - theme_editor từ API
 *   theme  - bản nháp (mẫu được vẽ bằng màu của người dùng)
 *   onTry(field, key)
 */
export default function PointsMilestones({ editor, theme: profileTheme, avatarUrl, onTry }) {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const points = editor.current_points;
  const next = editor.tiers.find((tier) => !tier.reached);
  const position = trackPosition(points, editor.tiers);

  const optionLabel = (field, key) =>
    field === "name_font"
      ? t(`profileTheme.fonts.${key}`, key)
      : t(`profileTheme.options.${field}.${key}`, key);

  const unlocksAt = (minPoints) => {
    const items = [];
    if (editor.required_points === minPoints) {
      items.push({ field: "theme_colors", key: "colors", label: t("profileTheme.milestones.colors", "Màu giao diện & màu ảnh bìa") });
    }
    if (editor.fancy_name && editor.fancy_name.required_points === minPoints) {
      items.push({ field: "fancy_name", key: "fancy", label: t("profileTheme.milestones.fancyName") });
    }
    Object.entries(editor.options).forEach(([field, options]) => {
      options
        .filter((o) => o.required_points === minPoints && !["none", "default"].includes(o.key))
        .forEach((o) =>
          items.push({
            field,
            key: o.key,
            // The name icons have no names of their own: the glyph is the label.
            icon: o.icon,
            label:
              field === "name_icon"
                ? `${t("profileTheme.groups.name_icon")}: ${o.icon || o.key}`
                : field === "username_style"
                  ? t("profileTheme.usernameStyle")
                  : `${t(`profileTheme.groups.${field}`, field)}: ${optionLabel(field, o.key)}`,
          })
        );
    });
    if (editor.animated_avatar.required_points === minPoints) {
      items.push({ field: "animated_avatar", key: "gif", label: t("profileTheme.milestones.gif", "Avatar GIF động") });
    }
    return items;
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t("profileTheme.milestones.title", "Mốc điểm")}</Text>
        <Text style={{ color: theme.subText }}>
          <Text style={[styles.points, { color: theme.primary }]}>{points}</Text> {t("profileTheme.milestones.pointsUnit", "điểm")}
        </Text>
      </View>

      {/* Milestone track */}
      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: isDarkMode ? "#525252" : "#e5e7eb" }]}>
          <LinearGradient
            colors={["#319527", "#34d399"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.trackFill, { width: `${position}%` }]}
          />
          {editor.tiers.map((tier, i) => (
            <View
              key={tier.id}
              style={[
                styles.stop,
                {
                  left: `${((i + 1) / editor.tiers.length) * 100}%`,
                  borderColor: tier.reached ? theme.primary : theme.border,
                  backgroundColor: tier.reached ? theme.surface : isDarkMode ? "#404040" : "#f3f4f6",
                },
              ]}
            >
              <Ionicons
                name="ribbon"
                size={14}
                color={tier.reached ? TIER_COLORS[tier.id] || theme.primary : theme.subText}
              />
            </View>
          ))}
        </View>
        <View style={styles.stopLabels}>
          {editor.tiers.map((tier, i) => (
            <Text
              key={tier.id}
              style={[styles.stopLabel, { left: `${((i + 1) / editor.tiers.length) * 100}%`, color: theme.subText }]}
            >
              {tier.min_points}
            </Text>
          ))}
        </View>
      </View>
      <Text style={[styles.next, { color: theme.subText }]}>
        {next
          ? t("profileTheme.milestones.next", "Còn {{points}} điểm tới {{tier}}", {
              points: next.min_points - points,
              tier: t(`memberTiers.${next.id}`, next.name),
            })
          : t("profileTheme.milestones.all", "Đã mở khóa tất cả")}
      </Text>

      {/* What each tier unlocks */}
      <View style={styles.tiers}>
        {editor.tiers.map((tier) => {
          const items = unlocksAt(tier.min_points);
          return (
            <View
              key={tier.id}
              style={[
                styles.tier,
                tier.reached
                  ? { borderColor: `${theme.primary}66`, backgroundColor: isDarkMode ? "#1d281b" : "#f3f9f2" }
                  : { borderColor: theme.border },
              ]}
            >
              <View style={styles.tierHeader}>
                <View style={styles.tierName}>
                  <Ionicons name="ribbon" size={15} color={TIER_COLORS[tier.id] || theme.primary} />
                  <Text style={[styles.tierTitle, { color: theme.text }]} numberOfLines={1}>
                    {t(`memberTiers.${tier.id}`, tier.name)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: tier.reached ? theme.primary : isDarkMode ? "#404040" : "#f3f4f6" },
                  ]}
                >
                  <Ionicons
                    name={tier.reached ? "checkmark" : "lock-closed"}
                    size={11}
                    color={tier.reached ? "#fff" : theme.subText}
                  />
                  <Text style={[styles.badgeText, { color: tier.reached ? "#fff" : theme.subText }]}>
                    {tier.min_points}
                  </Text>
                </View>
              </View>
              <View style={styles.samples}>
                {items.map((item) => {
                  const tryable = TRYABLE.includes(item.field);
                  return (
                    <TouchableOpacity
                      key={`${item.field}-${item.key}`}
                      accessibilityLabel={item.label}
                      disabled={!tryable}
                      onPress={() => onTry?.(item.field, item.key)}
                      style={[
                        styles.sample,
                        { backgroundColor: isDarkMode ? "#404040" : "#f3f4f6", opacity: tier.reached ? 1 : 0.7 },
                      ]}
                    >
                      <Sample item={item} profileTheme={profileTheme} avatarUrl={avatarUrl} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { fontSize: 16, fontWeight: "700" },
  points: { fontSize: 22, fontWeight: "800" },
  trackWrap: { marginTop: 24, marginBottom: 6, paddingHorizontal: 14 },
  track: { height: 6, borderRadius: 999 },
  trackFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999 },
  stop: {
    position: "absolute",
    top: -13,
    width: 32,
    height: 32,
    marginLeft: -16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stopLabels: { height: 16, marginTop: 20 },
  stopLabel: { position: "absolute", width: 40, marginLeft: -20, textAlign: "center", fontSize: 11, fontWeight: "500" },
  next: { textAlign: "center", fontSize: 12 },
  tiers: { marginTop: 16, gap: 10 },
  tier: { borderWidth: 1, borderRadius: 14, padding: 12 },
  tierHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  tierName: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  tierTitle: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  samples: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  sample: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sampleAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff" },
  sampleText: { fontSize: 16, fontWeight: "bold" },
  sampleFill: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  sampleSymbol: { color: "#fff", fontSize: 16 },
  sampleGlyph: { fontSize: 20 },
  sampleFrame: { width: 32, height: 24, borderRadius: 4 },
  gif: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});
