import React from "react";
import { Text } from "react-native";
import StyledName from "./StyledName";
import { getUsernameTheme } from "../../utils/profileTheme";

/**
 * A user's `@username`.
 *
 * Normally a plain <Text> in the given style. A Pro member (2000 points)
 * can give it a font, an effect and colours of its own - chosen separately
 * from the name's - and then it is drawn through StyledName.
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

  const usernameTheme = getUsernameTheme(theme);
  if (!usernameTheme) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <StyledName theme={usernameTheme} variant={variant} style={style} numberOfLines={numberOfLines} {...rest}>
      {text}
    </StyledName>
  );
};

export default StyledUsername;
