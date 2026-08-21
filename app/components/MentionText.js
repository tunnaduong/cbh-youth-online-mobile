import React from "react";
import { Text, Linking } from "react-native";

// Matches http/https URLs. Deliberately simple — no bare www. to avoid
// false-positives on usernames/filenames that start with "www".
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

// Matches @mention tokens (Unicode-safe for Vietnamese names).
const MENTION_REGEX = /@([\p{L}\p{N}\p{M}_.-]+)/gu;

export function buildParts(text) {
  // Collect all token matches (mentions + URLs) with their positions.
  const tokens = [];

  let m;
  MENTION_REGEX.lastIndex = 0;
  while ((m = MENTION_REGEX.exec(text)) !== null) {
    tokens.push({ type: "mention", start: m.index, end: m.index + m[0].length, value: m[0], username: m[1] });
  }

  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(text)) !== null) {
    // Don't double-count a URL that sits inside a @mention token.
    const overlaps = tokens.some((t) => m.index < t.end && m.index + m[0].length > t.start);
    if (!overlaps) {
      tokens.push({ type: "url", start: m.index, end: m.index + m[0].length, value: m[0] });
    }
  }

  tokens.sort((a, b) => a.start - b.start);

  const parts = [];
  let lastIndex = 0;
  for (const tok of tokens) {
    if (tok.start > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, tok.start) });
    }
    parts.push(tok);
    lastIndex = tok.end;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

/**
 * Renders @username as highlighted + tappable only for server-validated mentions,
 * and renders http/https URLs as highlighted + tappable (opens in browser).
 *
 * Props:
 *   children          - string message content
 *   mentions          - array of {username, user_id} from the server (resolved by backend)
 *   onMentionPress(username) - called when a valid mention is tapped
 *   allowBroadcastMention    - whether @all should render as a highlighted
 *                              mention at all (default true). 1-on-1 chats
 *                              only ever have the two participants, so @all
 *                              is meaningless there and should render as
 *                              plain text instead.
 */
const MentionText = ({ children, style, onMentionPress, mentions, allowBroadcastMention = true, ...rest }) => {
  const text = typeof children === "string" ? children : String(children ?? "");

  const validSet = React.useMemo(() => {
    const s = new Set();
    (mentions ?? []).forEach((m) => {
      if (!allowBroadcastMention && m.username.toLowerCase() === "all") return;
      s.add(m.username.toLowerCase());
    });
    return s;
  }, [mentions, allowBroadcastMention]);

  const parts = buildParts(text);
  const hasSpecial = parts.some((p) => p.type !== "text");

  if (!hasSpecial) {
    return <Text style={style} {...rest}>{text}</Text>;
  }

  return (
    <Text style={style} {...rest}>
      {parts.map((part, i) => {
        if (part.type === "mention" && validSet.has(part.username.toLowerCase())) {
          // @all is a broadcast mention, not a real user - there's no
          // profile to open, so it renders highlighted but isn't tappable.
          const isBroadcast = part.username.toLowerCase() === "all";
          return (
            <Text
              key={i}
              // Inherits the surrounding text color instead of a fixed
              // green - a fixed color reads fine on a light/white
              // background but is nearly invisible on a green "my message"
              // chat bubble (theme.primary). Bold + underline keeps it
              // visually distinct regardless of background.
              style={{ fontWeight: "700", textDecorationLine: "underline" }}
              onPress={isBroadcast ? undefined : () => onMentionPress?.(part.username)}
            >
              {part.value}
            </Text>
          );
        }
        if (part.type === "url") {
          return (
            <Text
              key={i}
              style={{ color: "#3b82f6", textDecorationLine: "underline" }}
              onPress={() => Linking.openURL(part.value).catch(() => {})}
            >
              {part.value}
            </Text>
          );
        }
        return part.value;
      })}
    </Text>
  );
};

export default MentionText;
