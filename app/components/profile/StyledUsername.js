import React from "react";
import { Text } from "react-native";
import StyledName from "./StyledName";
import { usernameFollowsName } from "../../utils/profileTheme";

/**
 * A user's `@username`.
 *
 * Normally a plain <Text> in the given style. When the user's theme says
 * `username_style === "name"` (Pro Max, 2000 points) it is drawn through
 * StyledName, so it takes the same font and effect as their name.
 *
 * Props:
 *   theme    - `theme`/`profile_theme` of the user from the API, or null
 *   username - without the "@"
 *   variant  - pass the same variant as the name next to it ("full" on the
 *              profile, "compact" in lists)
 *   prefix   - "@" by default; "" where the screen writes it itself
 *   style, numberOfLines, ...rest - as <Text>
 */
const StyledUsername = ({ theme, username, variant = "compact", prefix = "@", style, numberOfLines, ...rest }) => {
  if (!username) return null;
  const text = `${prefix}${username}`;

  if (!usernameFollowsName(theme)) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <StyledName theme={theme} variant={variant} style={style} numberOfLines={numberOfLines} {...rest}>
      {text}
    </StyledName>
  );
};

export default StyledUsername;
