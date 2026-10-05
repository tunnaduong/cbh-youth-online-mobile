import React from "react";
import { StyleSheet, Text } from "react-native";
import { getNameIcon } from "../../utils/profileTheme";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * The small playful icon a Pro member (2000 points) picked to follow
 * their name. Renders nothing when the user has none.
 *
 * It is an emoji glyph drawn as text, on purpose: it must never be mistaken
 * for the verified badge (a green vector tick), so it has no tint, no circle
 * and no tick shape of its own. (The colour only matters for the rare glyph a
 * device draws as text instead of as an emoji.)
 *
 * Props:
 *   theme - `theme`/`profile_theme` of the user from the API, or null
 *   size  - the font size of the name it follows (default 14)
 *   style - extra layout style (margins)
 *
 * It is a <Text>, so it can sit in a row next to the name or be nested inside
 * another <Text> (where the margin is ignored - put a space before it).
 */
const NameIcon = ({ theme, size = 14, style }) => {
  const { theme: appTheme } = useTheme();
  const glyph = getNameIcon(theme);
  if (!glyph) return null;

  return (
    <Text
      // Decoration: a screen reader should read the name, not "fish".
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.icon,
        { color: appTheme.text, fontSize: size, marginLeft: Math.max(3, Math.round(size * 0.25)) },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
};

const styles = StyleSheet.create({
  // Fixed size: in a name row it is the name that gives way, never the icon.
  icon: { flexShrink: 0, fontWeight: "normal" },
});

export default NameIcon;
