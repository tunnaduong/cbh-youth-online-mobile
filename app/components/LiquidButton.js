import React from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { LiquidGlassView, glassTint } from "./GlassModules";

const LiquidButton = ({
  onPress,
  children,
  style,
  size = 44,
  borderRadius,
  disabled = false,
  containerStyle,
  scrollY,
  backgroundColor,
}) => {
  const { isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;

  // When scrollY is provided, only the tint scrim behind the icon fades in
  // as the user scrolls (0→40px) - the icon itself must stay at opacity 1
  // always, otherwise it disappears along with the background at the top of
  // the screen.
  const bgOpacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [0, 1],
        extrapolate: "clamp",
      })
    : 1;

  // All sizing (width/height/borderRadius/the caller's own `style`, e.g.
  // width:"auto" + paddingHorizontal for a text button) lives on the actual
  // glass/fallback view, not on the outer TouchableOpacity. It used to live
  // on the TouchableOpacity while the glass content was pinned there via
  // StyleSheet.absoluteFill - but an absolutely-positioned child is removed
  // from layout entirely, so it contributes nothing to a parent sized as
  // width:"auto". That collapsed the TouchableOpacity (and everything
  // inside it) to zero width for any button with auto/content-based sizing,
  // e.g. the "read all" text button. Now the TouchableOpacity is unstyled
  // and just wraps its one sized child.
  const contentStyle = [
    styles.content,
    {
      width: size,
      height: size,
      borderRadius: defaultRadius,
    },
    style,
  ];

  // react-native-liquid-glassmorphism handles iOS/Android and every OS-version
  // tier internally (real glass, blur fallback, or plain tint - whichever the
  // device supports), so there's no more platform branching here at all.
  //
  // The icon/text must be a real React child of <LiquidGlassView>, not a
  // sibling drawn over an absoluteFill glass layer: the native view captures
  // "the hierarchy behind it" by walking the whole app tree and skipping
  // only its own subtree - content outside that subtree (a sibling) still
  // gets swept into the captured backdrop and rendered blurred underneath,
  // in addition to being drawn crisply on top as a normal sibling. That
  // produced a doubled/ghosted icon. Nesting it as an actual child excludes
  // it from the capture and gets the library's real crisp-children-on-top
  // compositing.
  //
  // The glass view itself is always mounted at full opacity now (so the icon
  // inside it is never hidden) - the scroll-triggered "background appears"
  // effect is a separate animated tint scrim drawn behind the icon instead.
  const renderContent = () => {
    if (LiquidGlassView) {
      return (
        <LiquidGlassView
          variant="regular"
          tintColor={backgroundColor ?? glassTint(isDarkMode)}
          borderRadius={defaultRadius}
          style={contentStyle}
        >
          {scrollY && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: defaultRadius,
                  opacity: bgOpacity,
                  backgroundColor: backgroundColor ?? (isDarkMode ? "rgba(18, 18, 18, 0.35)" : "rgba(255, 255, 255, 0.35)"),
                },
              ]}
            />
          )}
          {children}
        </LiquidGlassView>
      );
    }

    // Library failed to load: OneUI-style tinted transparent fallback.
    return (
      <View
        style={[
          contentStyle,
          {
            backgroundColor: backgroundColor ?? (isDarkMode ? "rgba(18, 18, 18, 0.85)" : "rgba(255, 255, 255, 0.75)"),
          },
        ]}
      >
        {children}
      </View>
    );
  };

  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleValue }] }, containerStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  content: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
  },
});

export default LiquidButton;
