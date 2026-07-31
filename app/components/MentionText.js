import React from "react";
import { Text } from "react-native";

export function buildParts(text) {
  const parts = [];
  // \w is ASCII-only, so a mention using a Vietnamese display name/username
  // (diacritics like "@Tuấn" or "@Nguyễn") never matched and stayed
  // uncolored. \p{L} matches any Unicode letter (precomposed Vietnamese
  // characters included), \p{M} covers combining diacritical marks for text
  // still in decomposed (NFD) form.
  const regex = /@([\p{L}\p{N}\p{M}_.-]+)/gu;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", value: match[0], username: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

/**
 * Renders @username as highlighted + tappable only for server-validated mentions.
 *
 * Props:
 *   children          - string message content
 *   mentions          - array of {username, user_id} from the server (resolved by backend)
 *   onMentionPress(username) - called when a valid mention is tapped
 */
const MentionText = ({ children, style, onMentionPress, mentions, ...rest }) => {
  const text = typeof children === "string" ? children : String(children ?? "");

  const validSet = React.useMemo(() => {
    const s = new Set();
    (mentions ?? []).forEach((m) => s.add(m.username.toLowerCase()));
    return s;
  }, [mentions]);

  const parts = buildParts(text);
  const hasAnyMention = parts.some((p) => p.type === "mention");

  if (!hasAnyMention) {
    return <Text style={style} {...rest}>{text}</Text>;
  }

  return (
    <Text style={style} {...rest}>
      {parts.map((part, i) =>
        part.type === "mention" && validSet.has(part.username.toLowerCase()) ? (
          <Text
            key={i}
            style={{
              color: "#22c55e",
              fontWeight: "600",
            }}
            onPress={() => onMentionPress?.(part.username)}
          >
            {part.value}
          </Text>
        ) : part.value
      )}
    </Text>
  );
};

export default MentionText;
