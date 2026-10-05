import React from "react";
import { Platform, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import LiquidButton from "./LiquidButton";

/**
 * The wide buttons of the screens before login (welcome, login, sign up,
 * forgot password, two-factor), drawn with the app's own LiquidButton so they
 * look and press like the buttons inside the app.
 *
 *   variant="primary"    the screen's main action: solid brand colour
 *   variant="secondary"  the others (passkey, Google...): liquid glass on
 *                        iOS; on Android a plain surface, because several
 *                        glass views on one screen are too expensive there
 *                        (see LiquidButton's forceNoGlass)
 *
 * `style` is the button's old stylesheet entry (height, radius, margins...):
 * margins and alignSelf go to the wrapper LiquidButton animates, the rest to
 * the button face. A disabled button is dimmed.
 */
const CONTAINER_KEYS = [
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "alignSelf",
];

const AuthButton = ({
  variant = "primary",
  onPress,
  disabled = false,
  style,
  children,
  accessibilityLabel,
}) => {
  const { theme } = useTheme();
  const primary = variant === "primary";
  const plain = primary || Platform.OS === "android";

  const flat = StyleSheet.flatten(style) || {};
  const container = {};
  const face = {};
  Object.keys(flat).forEach((key) => {
    (CONTAINER_KEYS.includes(key) ? container : face)[key] = flat[key];
  });

  return (
    <LiquidButton
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      forceNoGlass={plain}
      backgroundColor={primary ? theme.primary : plain ? theme.surface : undefined}
      borderRadius={face.borderRadius ?? 38}
      containerStyle={[styles.container, container, disabled && styles.disabled]}
      style={[
        styles.face,
        face,
        // Glass has its own edge; only the plain secondary button is outlined.
        !primary && plain
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }
          : styles.noBorder,
      ]}
    >
      {children}
    </LiquidButton>
  );
};

const styles = StyleSheet.create({
  container: { width: "100%" },
  face: { width: "100%", height: 52, borderRadius: 38 },
  noBorder: { borderWidth: 0 },
  disabled: { opacity: 0.6 },
});

export default AuthButton;
