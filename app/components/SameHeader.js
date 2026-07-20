import React, { useEffect, useRef } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  DeviceEventEmitter,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";
import LiquidButton from "./LiquidButton";

// Simple header component
const SimpleHeader = ({ title, theme }) => (
  <View style={[styles.simpleContainer, { backgroundColor: "transparent" }]}>
    <Text style={[styles.simpleTitle, { color: theme.text }]}>{title}</Text>
  </View>
);

const FeatureHeader = ({
  title,
  icon,
  action,
  havingBorder = false,
  havingIcon = false,
  setSetting,
  onLogoPress,
  theme,
  isDarkMode,
  providerId,
}) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!havingIcon) return;
    const subscription = DeviceEventEmitter.addListener("HOME_SCROLL", (offsetY) => {
      // Offset > 50 means we are scrolling down
      scrollAnim.setValue(offsetY);
    });
    return () => subscription.remove();
  }, [havingIcon, scrollAnim]);

  const logoOpacity = scrollAnim.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const logoTranslateY = scrollAnim.interpolate({
    inputRange: [0, 50],
    outputRange: [0, -20],
    extrapolate: "clamp",
  });

  const logoWidth = scrollAnim.interpolate({
    inputRange: [0, 50],
    outputRange: [160, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[
      havingBorder ? styles.containerWithBorder : styles.container,
      {
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderBottomWidth: 0,
        height: 58,
        paddingBottom: 8,
      }
    ]}>
      <LiquidButton size={44} scrollY={scrollAnim} onPress={() => setSetting((setting) => !setting)} providerId={providerId}>
        <Ionicons name={"menu-outline"} size={22} color={theme.text} />
      </LiquidButton>
      {havingIcon ? (
        <Animated.View style={{ 
          marginTop: -4, 
          opacity: logoOpacity, 
          transform: [{ translateY: logoTranslateY }],
          width: logoWidth,
          overflow: "hidden"
        }}>
          <TouchableOpacity
            onPress={onLogoPress}
            activeOpacity={0.7}
            style={styles.logoContainer}
          >
            <Image
              style={styles.logo}
              source={require("../assets/logo.png")}
              resizeMode="contain"
            />
            <View style={{ marginLeft: 4 }}>
              <Text style={{ color: theme.primary, fontWeight: "300", width: 120 }} numberOfLines={1}>
                Diễn đàn học sinh
              </Text>
              <Text style={{ color: theme.primary, fontWeight: "bold", marginTop: -2, width: 120 }} numberOfLines={1}>
                Chuyên Biên Hòa
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      )}

      <View style={{ marginTop: -4 }}>
        <LiquidButton size={44} scrollY={scrollAnim} onPress={action} providerId={providerId}>
          <Ionicons name={icon} size={22} color={theme.text} />
        </LiquidButton>
      </View>
    </View>
  );
};

// Main component that decides which header to render
const SameHeader = (props) => {
  const { theme, isDarkMode } = useTheme();

  if (props.defaultStyle) {
    return <SimpleHeader title={props.title} theme={theme} />;
  }
  return <FeatureHeader {...props} theme={theme} isDarkMode={isDarkMode} />;
};

// Extract all styles to a separate object
const styles = StyleSheet.create({
  simpleContainer: {
    paddingHorizontal: 15,
    height: 50,
    justifyContent: "center",
  },
  simpleTitle: {
    textAlign: "center",
    fontWeight: "600",
    fontSize: 18,
  },
  container: {
    width: "100%",
    height: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  containerWithBorder: {
    width: "100%",
    height: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 35,
    height: 35,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "left",
  },
  iconContainer: {
    padding: 6,
    borderRadius: 20,
  },
});

export default SameHeader;
