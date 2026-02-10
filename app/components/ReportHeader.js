import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

export default function ReportHeader({ navigation, title, rightButton }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          height: 50,
          borderBottomColor: theme.border,
          borderBottomWidth: 0.8,
          backgroundColor: theme.background,
        },
        Platform.OS === "android"
          ? { marginTop: 0 }
          : { height: "auto", paddingVertical: 12 },
      ]}
    >
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back-circle" size={25} color={theme.subText} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "bold",
          marginLeft: 16,
          color: theme.primary,
        }}
      >
        {title}
      </Text>
      {rightButton && (
        <TouchableOpacity
          style={[
            {
              marginLeft: "auto",
              paddingHorizontal: 25,
              paddingVertical: 10,
              backgroundColor: theme.primary,
              borderRadius: 20,
            },
            Platform.OS === "android" && { paddingVertical: 8 },
          ]}
          onPress={rightButton.onPress}
        >
          <Text
            style={{
              color: "white",
              lineHeight: 20,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {rightButton.text}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
