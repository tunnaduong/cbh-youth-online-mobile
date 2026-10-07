import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// One colour and one icon per member tier - the same pictures the web shows
// after a member's name (star, bolt, trophy, shield, diamond, crown).
export const TIER_COLORS = {
  trainee: "#6b7280",
  active: "#3b82f6",
  distinguished: "#eab308",
  veteran: "#a855f7",
  premium: "#f43f5e",
  pro: "#f97316",
};

export const TIER_ICONS = {
  trainee: "star",
  active: "lightning-bolt",
  distinguished: "trophy",
  veteran: "shield-check",
  premium: "diamond-stone",
  pro: "crown",
};

/**
 * The icon of a member tier, in the tier's colour. Renders nothing for an
 * unknown tier. It is a <Text> underneath (vector icon), so it can sit in a
 * row or be nested inside another <Text>.
 *
 * Props:
 *   tierId - "trainee" | "active" | "distinguished" | "veteran" | "premium" | "pro"
 *   size   - icon size (default 14)
 *   color  - override the tier colour
 *   style  - extra layout style
 */
export default function TierIcon({ tierId, size = 14, color, style }) {
  const name = TIER_ICONS[tierId];
  if (!name) return null;

  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color || TIER_COLORS[tierId]}
      style={style}
      // Decoration: a screen reader reads the name, not "crown".
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
