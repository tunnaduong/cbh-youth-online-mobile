import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReportHeader({ navigation, title, rightButton }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          height: 50,
          borderBottomColor: "#ccc",
          borderBottomWidth: 0.8,
        },
        Platform.OS === "android"
          ? { marginTop: 0 }
          : { height: "auto", paddingVertical: 12 },
      ]}
    >
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back-circle" size={25} color={"#A7A7A7"} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "bold",
          marginLeft: 16,
          color: "#309627",
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
              backgroundColor: "#309627",
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
