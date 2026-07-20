import React from "react";
import {
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";

const isIOS = Platform.OS === "ios";

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
      style,
    },
    ref
  ) => {
    const { theme, isDarkMode } = useTheme();
    const { t } = useTranslation();

    return (
      <View
        style={[
          {
            paddingHorizontal: 20, // narrower width
            paddingBottom: 15, // float from bottom
            paddingTop: 5,
            width: "100%",
            backgroundColor: "transparent",
          },
          style,
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: isIOS
              ? "transparent"
              : isDarkMode
              ? "rgba(30,30,30,0.9)"
              : "rgba(255,255,255,0.9)",
            borderRadius: 30, // floating pill shape
            padding: 5,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          {isIOS && (
            <BlurView
              intensity={70}
              tint={isDarkMode ? "dark" : "light"}
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
            }}
          >
            <TextInput
              style={{
                fontSize: 14,
                flex: 1,
                padding: 2,
                color: theme.text,
                minHeight: 28,
              }}
              placeholder={placeholderText}
              placeholderTextColor={theme.subText}
              multiline={true}
              ref={ref}
              onChangeText={onChangeText}
              value={value}
              onKeyPress={onKeyPress}
              editable={editable}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 5 }}>
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
      </View>
    );
  }
);

export default CommentBar;
