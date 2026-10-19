import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../../../../contexts/ThemeContext";
import {
  LiquidGlassView,
  glassTint,
  flatSurface,
  androidGlassPerfProps,
} from "../../../../components/GlassModules";

// Full-width liquid-glass bar docked to the top or bottom edge of the chat
// (the header and the composer), Messenger style: flat, square, with a
// hairline on the side that faces the messages. The content must be a real
// child of the glass view (a sibling over an absolute glass layer gets swept
// into the captured backdrop and shows up doubled). Without the native module
// it falls back to the same nearly opaque panel the glass uses when the
// "Liquid glass" setting is off.
const ChatGlassBar = ({ edge, style, children }) => {
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

  if (LiquidGlassView) {
    return (
      <LiquidGlassView
        variant="clear"
        tintColor={glassTint(isDarkMode)}
        {...androidGlassPerfProps}
        style={style}
      >
        {children}
        {hairline}
      </LiquidGlassView>
    );
  }

  return (
    <View style={[style, { backgroundColor: flatSurface(isDarkMode) }]}>
      {children}
      {hairline}
    </View>
  );
};

const styles = StyleSheet.create({
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});

export default ChatGlassBar;
