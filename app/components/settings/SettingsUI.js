import React from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

// The colourful menu look shared by the Settings page and its sub-screens (and
// the Sidebar menu): every entry has its own accent on a tinted round holder,
// cards have radius 18 with soft hairlines, section titles are small grey caps
// with an accent icon. See INFO.md > Design system.
export const tint = (hex, isDark) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${isDark ? 0.2 : 0.12})`;
};

export const ACCENT = {
  profile: "#3B82F6",
  profileTheme: "#EC4899",
  security: "#6366F1",
  verification: "#14B8A6",
  blocked: "#EF4444",
  notifications: "#F59E0B",
  theme: "#8B5CF6",
  appIcon: "#F59E0B",
  glass: "#0EA5E9",
  language: "#3B82F6",
  aiTranslate: "#EC4899",
  autoplay: "#EF4444",
  bubble: "#10B981",
  battery: "#22C55E",
  remind: "#F97316",
  shake: "#6366F1",
  updates: "#14B8A6",
  about: "#3B82F6",
  debug: "#64748B",
  danger: "#FF3B30",
};

// Rows that do not name an accent get one from their icon, so a sub-screen is
// colourful without picking colours row by row.
const PALETTE = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#6366F1", "#F97316", "#0EA5E9", "#22C55E"];
export const accentFor = (icon = "") => {
  let h = 0;
  for (let i = 0; i < icon.length; i++) h = (h * 31 + icon.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

export const useLook = () => {
  const { theme, isDarkMode } = useTheme();
  return {
    theme,
    isDarkMode,
    cardBorder: isDarkMode ? "#282B34" : "#E2E8F0",
    rowBorder: isDarkMode ? "#282B34" : "#F1F5F9",
    titleColor: isDarkMode ? "#9CA3AF" : "#6B7280",
  };
};

const GRID_GAP = 10;
export const GRID_CARD_WIDTH = Math.floor((Dimensions.get("window").width - 32 - GRID_GAP) / 2);

export const SettingItem = ({
  icon,
  iconComponent,
  color,
  title,
  subtitle,
  description,
  onPress,
  onLongPress,
  delayLongPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
  disabled = false,
}) => {
  const { theme, isDarkMode, rowBorder } = useLook();
  const destructive = color === ACCENT.danger;
  const accent = color || accentFor(icon);
  const sub = subtitle || description;
  return (
    <TouchableOpacity
      style={[styles.settingItem, lastItem && styles.lastSettingItem, { borderBottomColor: rowBorder }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={isSwitch || disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.settingItemLeft, sub ? { alignItems: "flex-start" } : null]}>
        {icon || iconComponent ? (
          <View style={[styles.settingItemIcon, { backgroundColor: tint(accent, isDarkMode), marginTop: sub ? 2 : 0 }]}>
            {iconComponent || <Ionicons name={icon} size={20} color={accent} />}
          </View>
        ) : null}
        {/* Title + description share one column; the 12px gap to the icon is on
            the column, so both lines start at the same x. */}
        <View style={{ flex: 1, flexShrink: 1, marginLeft: icon || iconComponent ? 12 : 0 }}>
          <Text style={[styles.settingItemText, { color: destructive ? ACCENT.danger : disabled ? theme.subText : theme.text }]}>{title}</Text>
          {sub ? <Text style={{ fontSize: 12, lineHeight: 16, color: theme.subText, marginTop: 2 }}>{sub}</Text> : null}
        </View>
      </View>
      {isSwitch ? (
        <Switch value={value} onValueChange={onPress} disabled={disabled} trackColor={{ true: accent }} style={{ marginLeft: 12 }} />
      ) : value ? (
        <View style={styles.settingItemRight}>
          <Text style={[styles.settingValueText, { color: theme.subText }]}>{value}</Text>
          {chevron && <Ionicons name="chevron-forward" size={18} color={theme.subText} />}
        </View>
      ) : (
        chevron && <Ionicons name="chevron-forward" size={18} color={destructive ? ACCENT.danger : theme.subText} />
      )}
    </TouchableOpacity>
  );
};

// Two-column shortcut tile (like the menu's utilities grid).
export const SettingTile = ({ icon, color, title, subtitle, onPress }) => {
  const { theme, isDarkMode, cardBorder } = useLook();
  const accent = color || accentFor(icon);
  return (
    <TouchableOpacity
      style={[styles.tile, { width: GRID_CARD_WIDTH, backgroundColor: theme.surface, borderColor: cardBorder }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.tileIcon, { backgroundColor: tint(accent, isDarkMode) }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={[styles.tileTitle, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.tileSubtitle, { color: theme.subText }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

export const SettingSection = ({ icon, color, title, titleColor, children }) => {
  const { theme, isDarkMode, cardBorder, titleColor: greyTitle } = useLook();
  const childrenArray = React.Children.toArray(children);
  if (childrenArray.length === 0) return null;
  return (
    <View style={styles.sectionWrapper}>
      {title ? (
        <View style={styles.sectionHeaderRow}>
          {icon ? <Ionicons name={icon} size={15} color={color || theme.primary} style={{ marginRight: 6 }} /> : null}
          <Text style={[styles.sectionTitle, { color: titleColor || greyTitle }]}>{title}</Text>
        </View>
      ) : null}
      <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: cardBorder }]}>
        {childrenArray.map((child, index) =>
          React.isValidElement(child)
            ? React.cloneElement(child, { lastItem: index === childrenArray.length - 1, theme, isDarkMode })
            : child
        )}
      </View>
    </View>
  );
};

/** "SECTION" header for content that is not a card (the account tiles). */
export const SectionHeader = ({ icon, color, title }) => {
  const { theme, titleColor } = useLook();
  return (
    <View style={[styles.sectionHeaderRow, { marginLeft: 20 }]}>
      {icon ? <Ionicons name={icon} size={15} color={color || theme.primary} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionWrapper: { marginHorizontal: 16, marginBottom: 24 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginLeft: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  settingSection: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastSettingItem: { borderBottomWidth: 0 },
  settingItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  settingItemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  settingItemText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  settingItemRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  settingValueText: { fontSize: 15 },
  tilesGrid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginHorizontal: 16, marginBottom: 24 },
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  tileSubtitle: { fontSize: 11, fontWeight: "500" },
});

export const settingsStyles = styles;
