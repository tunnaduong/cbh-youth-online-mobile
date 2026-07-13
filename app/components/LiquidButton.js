import React from "react";
import {
  TouchableOpacity,
  View,
  Platform,
  StyleSheet,
  Animated,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import {
  LiquidGlassView,
  LiquidGlassViewAndroid,
  isLiquidGlassSupportedAndroid,
  useIOSGlass,
  BlurView,
} from "./GlassModules";

const LiquidButton = ({
  onPress,
  children,
  style,
  size = 40,
  borderRadius,
  disabled = false,
  containerStyle,
  providerId,
}) => {
  const { theme, isDarkMode } = useTheme();
  const defaultRadius = borderRadius ?? size / 2;
  
  const renderGlassBackground = () => {
    if (Platform.OS === "ios") {
      if (useIOSGlass) {
        return (
          <LiquidGlassView
            style={[StyleSheet.absoluteFill, { borderRadius: defaultRadius, overflow: "hidden" }]}
            glassType="clear"
            glassTintColor={isDarkMode ? "#111111CC" : "#F8F8F8CC"}
            glassOpacity={1}
            isInteractive={false}
          />
        );
      }
      if (BlurView) {
        return (
          <BlurView
            style={[StyleSheet.absoluteFill, { borderRadius: defaultRadius, overflow: "hidden" }]}
            blurType={isDarkMode ? "dark" : "light"}
            blurAmount={10}
          />
        );
      }
    } else {
      if (isLiquidGlassSupportedAndroid && LiquidGlassViewAndroid) {
        return (
          <LiquidGlassViewAndroid
            providerId={providerId || "default"}
            style={[StyleSheet.absoluteFill, { borderRadius: defaultRadius }]}
            blurRadius={8}
            refractionAmount={20}
            refractionHeight={10}
            tint={isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(240,240,240,0.3)"}
            interactive={false}
          />
        );
      }
    }
    
    // Fallback
    return (
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { 
            backgroundColor: isDarkMode ? "rgba(40, 40, 40, 0.4)" : "rgba(240, 240, 240, 0.4)",
            borderRadius: defaultRadius,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
          }
        ]} 
      />
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        {
          width: size,
          height: size,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        },
        containerStyle
      ]}
    >
      {renderGlassBackground()}
      <View style={[
        {
          width: size,
          height: size,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: defaultRadius,
        },
        style
      ]}>
        {children}
      </View>
    </TouchableOpacity>
  );
};

export default LiquidButton;
