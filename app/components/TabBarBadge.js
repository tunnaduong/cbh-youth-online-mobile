import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function TabBarBadge({ count }) {
  if (!count || count === 0) {
    return null;
  }

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{displayCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
});
