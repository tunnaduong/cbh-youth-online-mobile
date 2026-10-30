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
// (the header and the composer), Messenger style: flat, square across the
// entire screen width, with a hairline on the side that faces the messages.
// The content must be a real child of the glass view (a sibling over an
// absolute glass layer gets swept into the captured backdrop and shows up
// doubled). Without the native module it falls back to the flat opaque panel.
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

  const containerStyle = [
    styles.bar,
    style,
  ];

  if (LiquidGlassView) {
    return (
      <LiquidGlassView
        variant="clear"
        tintColor={glassTint(isDarkMode)}
        borderRadius={0}
        {...androidGlassPerfProps}
        style={containerStyle}
      >
        {children}
        {hairline}
      </LiquidGlassView>
    );
  }

  return (
    <View style={[containerStyle, { backgroundColor: flatSurface(isDarkMode) }]}>
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
