import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Image,
} from "react-native";
// @expo/vector-icons (not react-native-vector-icons) - its fonts are loaded
// via expo-font and don't need a native rebuild to pick up newer glyphs, so
// icons here don't silently fall back to a "missing glyph" box (as happened
// with "glasses-outline") after a JS-only icon-set version bump.
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import {
  BlurView,
  LiquidGlassView,
  useIOSGlass,
  LiquidGlassViewAndroid,
  useAndroidGlass,
  isLiquidGlassSupportedAndroid,
} from "./GlassModules";

const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";
const RootView = View;

const CommentBar = React.forwardRef(
  (
    {
      placeholderText,
      onSubmit,
      onChangeText,
      value,
      onKeyPress,
      disabled,
      editable = true,
      isSubmitting = false,
      isAnonymous = false,
      onToggleAnonymous,
      anonymousDisabled = false,
      statusText,
      onClearStatus,
      style,
      leftAccessory,
      onPickImage,
      selectedImage,
      onClearImage,
      nativeID,
      providerId,
      // Android only: when the parent already renders its own single glass
      // layer behind this whole bar (e.g. ConversationScreen's floating
      // input block), the pill itself should stay fully transparent instead
      // of also sampling the backdrop — two independent real-glass renders
      // of the same provider stacked on top of each other produced a
      // visible double-refraction artifact (a blotchy discolored patch).
      androidTransparentPill = false,
    },
    ref
  ) => {
    const { theme, isDarkMode } = useTheme();
    const { t } = useTranslation();
    const useRealAndroidGlass =
      isAndroid && useAndroidGlass && LiquidGlassViewAndroid && !!providerId && !androidTransparentPill;

    return (
      <RootView
        style={[
          {
            paddingHorizontal: 20, // narrower width
            paddingBottom: isAndroid ? 14 : isIOS ? 4 : 0,
            paddingTop: isAndroid ? 14 : isIOS ? 2 : 0,
            width: "100%",
            backgroundColor: "transparent",
          },
          style,
        ]}
      >
        {selectedImage ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 22,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            }}
          >
            <Image
              source={{ uri: selectedImage }}
              style={{ width: 48, height: 48, borderRadius: 8 }}
              resizeMode="cover"
            />
            {onClearImage ? (
              <TouchableOpacity
                onPress={onClearImage}
                style={{
                  position: "absolute",
                  top: 2,
                  left: 56,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {statusText ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 22,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              backgroundColor: isDarkMode ? "rgba(52, 148, 44, 0.95)" : "rgba(255,255,255,0.95)",
            }}
          >
            <Text style={{ color: theme.subText, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {statusText}
            </Text>
            {onClearStatus ? (
              <TouchableOpacity
                onPress={onClearStatus}
                style={{
                  marginLeft: 10,
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                }}
              >
                <Ionicons name="close" size={16} color={theme.subText} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isIOS || useRealAndroidGlass || (isAndroid && androidTransparentPill)
                ? "transparent"
                : isDarkMode
                ? "rgba(18, 18, 18, 0.85)"
                : "rgba(255, 255, 255, 0.75)",
              borderRadius: 30, // floating pill shape
              padding: 4,
              borderWidth: isAndroid && androidTransparentPill ? 0 : StyleSheet.hairlineWidth,
              borderColor: theme.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            },
            // Android's `elevation` shadow is drawn by the OS against the
            // view's rectangular bounding box, ignoring borderRadius/
            // overflow:hidden clipping entirely - it pokes a flat-edged
            // rectangle out past this pill's rounded corners in both themes
            // (worse the taller the pill grows, e.g. typing a 2nd line).
            // Drop it on Android across the board; the border already gives
            // the pill definition, and iOS's shadow* props render correctly
            // without this issue so they're left alone.
            !isIOS && { elevation: 0, shadowOpacity: 0 },
          ]}
        >
          {isIOS && useIOSGlass && LiquidGlassView && (
            <LiquidGlassView
              style={StyleSheet.absoluteFill}
              effect="clear"
              tintColor={isDarkMode ? "#111111CC" : "#F8F8F8CC"}
              interactive={false}
            />
          )}
          {isIOS && !useIOSGlass && BlurView && (
            <BlurView
              blurType={isDarkMode ? "dark" : "light"}
              blurAmount={10}
              style={StyleSheet.absoluteFill}
            />
          )}
          {useRealAndroidGlass && (
            <LiquidGlassViewAndroid
              providerId={providerId}
              interactive={isLiquidGlassSupportedAndroid}
              blurRadius={Platform.Version >= 33 ? 14 : 10}
              tint={isDarkMode ? "rgba(18, 18, 18, 0.6)" : "rgba(255, 255, 255, 0.5)"}
              style={StyleSheet.absoluteFill}
            />
          )}

          <View
            style={{
              backgroundColor: isIOS
                ? "rgba(150,150,150,0.15)"
                : isDarkMode
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.05)",
              borderRadius: 25,
              padding: 7,
              paddingHorizontal: 15,
              flexDirection: "row",
              flex: 1,
              alignItems: "center",
            }}
          >
            {leftAccessory ? (
              <View style={{ marginRight: 8, alignItems: "center", justifyContent: "center" }}>
                {leftAccessory}
              </View>
            ) : null}
            <TextInput
              style={{
                fontSize: 14,
                flex: 1,
                padding: 2,
                color: theme.text,
                minHeight: isAndroid ? 34 : 28,
                textAlignVertical: "center",
                paddingTop: isIOS ? 5 : 8,
                paddingBottom: isAndroid ? 6 : 2,
              }}
              placeholder={placeholderText}
              placeholderTextColor={theme.subText}
              multiline={true}
              ref={ref}
              onChangeText={onChangeText}
              value={value}
              onKeyPress={onKeyPress}
              editable={editable}
              nativeID={nativeID}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 5 }}>
            {onPickImage && (
              <TouchableOpacity
                style={{
                  marginRight: 4,
                  backgroundColor: isIOS
                    ? "rgba(150,150,150,0.15)"
                    : isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.05)",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={onPickImage}
              >
                <Ionicons
                  name={selectedImage ? "image" : "image-outline"}
                  size={20}
                  color={selectedImage ? theme.primary : theme.text}
                />
              </TouchableOpacity>
            )}
            {onToggleAnonymous && (
              <TouchableOpacity
                style={{
                  marginRight: 8,
                  opacity: anonymousDisabled ? 0.5 : 1,
                  backgroundColor: isIOS
                    ? "rgba(150,150,150,0.15)"
                    : isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.05)",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={onToggleAnonymous}
                disabled={anonymousDisabled}
              >
                <Ionicons
                  name={isAnonymous ? "glasses" : "glasses-outline"}
                  size={20}
                  color={isAnonymous ? theme.primary : theme.text}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: disabled
                  ? "transparent"
                  : isIOS
                  ? "rgba(150,150,150,0.15)"
                  : isDarkMode
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
                width: 36,
                height: 36,
                borderRadius: 18,
              }}
              onPress={onSubmit}
              disabled={disabled}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons
                  name={"send"}
                  size={20}
                  color={
                    disabled
                      ? theme.subText
                      : theme.primary
                  }
                  style={{ marginLeft: 2 }} // center the send icon slightly
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </RootView>
    );
  }
);

export default CommentBar;
