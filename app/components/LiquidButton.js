import React, { useEffect, useState } from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { LiquidGlassView, glassTint, androidGlassPerfProps } from "./GlassModules";

const SCROLL_GLASS_THRESHOLD = 20;

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

  // At the very top of the screen (can't scroll up any further) the button
  // should blend into the transparent top bar with no glass surface at all,
  // not just a faded/tinted one - only once scrolled past the threshold
  // does the glass actually render. A continuous opacity fade doesn't work
  // for this: fading the glass view's own opacity also fades its nested
  // icon (icon must be a real child of the glass view, see below), so the
  // icon would disappear at the top along with the background. Toggling
  // between "no glass" and "glass" as a hard state switch keeps the icon at
  // opacity 1 always while still hiding the glass surface itself at top.
  const [showGlass, setShowGlass] = useState(
    !scrollY || scrollY.__getValue?.() > SCROLL_GLASS_THRESHOLD
  );

  useEffect(() => {
    if (!scrollY) return undefined;
    const id = scrollY.addListener(({ value }) => {
      const next = value > SCROLL_GLASS_THRESHOLD;
      setShowGlass((prev) => (prev === next ? prev : next));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

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
  const renderContent = () => {
    if (LiquidGlassView && showGlass) {
      return (
        <LiquidGlassView
          variant="clear"
          tintColor={backgroundColor ?? glassTint(isDarkMode)}
          borderRadius={defaultRadius}
          style={contentStyle}
          {...androidGlassPerfProps}
        >
          {children}
        </LiquidGlassView>
      );
    }

    // No glass at top of scroll (blends with the transparent top bar), or
    // the library failed to load: plain transparent/tinted fallback.
    return (
      <View
        style={[
          contentStyle,
          {
            backgroundColor: !LiquidGlassView
              ? backgroundColor ?? (isDarkMode ? "rgba(18, 18, 18, 0.85)" : "rgba(255, 255, 255, 0.75)")
              : "transparent",
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
