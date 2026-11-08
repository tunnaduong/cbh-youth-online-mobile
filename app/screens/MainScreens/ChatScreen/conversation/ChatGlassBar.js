import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../../../../contexts/ThemeContext";

// Full-width bar docked to the top or bottom edge of the chat (header/composer).
// Solid/pattern-friendly panel without liquid glass effect, matching the new chat header and composer visual styling.
const ChatGlassBar = ({ edge, style, tintColor, children }) => {
  const { theme, isDarkMode } = useTheme();
  const hairline = (
    <View
      pointerEvents="none"
      style={[
        styles.hairline,
        edge === "top" ? { bottom: 0 } : { top: 0 },
        { backgroundColor: theme.border },
      ]}
    />
  );

  const containerStyle = [
    styles.bar,
    style,
  ];

  const defaultTint = isDarkMode
    ? "rgba(15, 20, 18, 0.96)"
    : "rgba(255, 255, 255, 0.98)";
  const effectiveTint = tintColor ?? defaultTint;

  return (
    <View style={[containerStyle, { backgroundColor: effectiveTint }]}>
      {children}
      {hairline}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 0,
    overflow: "hidden",
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

export default React.memo(ChatGlassBar);
