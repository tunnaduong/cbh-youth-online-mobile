import React from "react";
import { StyleSheet, View } from "react-native";
import StyledName from "./StyledName";
import NameIcon from "./NameIcon";
import Verified from "../../assets/Verified";

/**
 * One line holding a user's name and everything that belongs right after it:
 * their name icon (Pro), the verified tick, then whatever the caller
 * passes as children (date, role chip, "· 2h"...).
 *
 * The rule this component exists for: **the name is the only part that
 * gives way.** It is cut with "…" when the line is too short; the icon, the
 * tick and the trailing content keep their size and never drop to a second
 * line. (Putting the tick inside the name's <Text> - as the app used to -
 * broke with styled names: a name drawn in layers is a <View>, and a long
 * name pushed the tick under itself.)
 *
 * Props:
 *   name           - the display name (string)
 *   theme          - `theme`/`profile_theme` of the user from the API, or null
 *   variant        - StyledName variant: "compact" (lists, default) or "full"
 *   verified       - show the verified tick
 *   verifiedSize   - tick size (default: a little larger than the font)
 *   verifiedColor  - tick colour (pass theme.primary)
 *   showIcon       - false to leave the name icon out (default true)
 *   style          - TEXT style of the name (font size, weight, colour)
 *   containerStyle - layout style of the row (margins, flex)
 *   children       - trailing content; give each piece `flexShrink: 0`
 *   ...rest        - passed to the name (<Text> props such as onPress)
 */
const UserNameRow = ({
  name,
  theme,
  variant = "compact",
  verified = false,
  verifiedSize,
  verifiedColor,
  showIcon = true,
  // The member's tier (id or { id }) when it is not inside `theme`.
  tier,
  style,
  containerStyle,
  children,
  ...rest
}) => {
  const fontSize = StyleSheet.flatten(style)?.fontSize || 14;
  const tick = verifiedSize || Math.round(fontSize * 1.1);

  return (
    <View style={[styles.row, containerStyle]}>
      <StyledName
        theme={theme}
        variant={variant}
        {...rest}
        style={[style, styles.name]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {name ?? ""}
      </StyledName>
      {showIcon && <NameIcon theme={theme} tier={tier} size={fontSize} />}
      {verified && (
        <Verified width={tick} height={tick} color={verifiedColor} style={styles.tick} />
      )}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  // minWidth 0 + flexShrink let the row itself be squeezed by its parent.
  row: { flexDirection: "row", alignItems: "center", flexShrink: 1, minWidth: 0 },
  // Works for both forms of StyledName: a <Text>, or the <View> of a layered
  // (outline / toon) name, whose own style already shrinks.
  name: { flexShrink: 1, minWidth: 0 },
  tick: { marginLeft: 4, flexShrink: 0 },
});

export default UserNameRow;
