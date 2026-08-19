import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import LiquidButton from "./LiquidButton";

export default function ReportHeader({ navigation, title, rightButton }) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: theme.background,
      }}
    >
      <LiquidButton size={44} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color={theme.primary} />
      </LiquidButton>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          marginLeft: 12,
          color: theme.primary,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {rightButton && (
        <LiquidButton
          size={44}
          style={{ width: "auto", paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: theme.primary, backgroundColor: "transparent" }}
          borderRadius={22}
          onPress={rightButton.onPress}
        >
          <Text
            style={{
              color: theme.text,
              lineHeight: 20,
              fontSize: 15,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {rightButton.text}
          </Text>
        </LiquidButton>
      )}
    </View>
  );
}
