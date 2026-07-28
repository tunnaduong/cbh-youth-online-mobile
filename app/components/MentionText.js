import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import axiosInstance from "../services/api/axiosInstance";

// Module-level cache so each username is only validated once per app session.
// "true" = exists, "false" = does not exist, undefined = not checked yet.
const usernameCache = {};
const inFlight = {};

function checkUsername(username) {
  const key = username.toLowerCase();
  if (key in usernameCache) return Promise.resolve(usernameCache[key]);
  if (inFlight[key]) return inFlight[key];
  inFlight[key] = axiosInstance
    .get(`/v1.0/users/${username}/profile`)
    .then(() => { usernameCache[key] = true; return true; })
    .catch(() => { usernameCache[key] = false; return false; })
    .finally(() => { delete inFlight[key]; });
  return inFlight[key];
}

function extractMentions(text) {
  const matches = [];
  const regex = /@([\w.]+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) matches.push(m[1]);
  return [...new Set(matches)];
}

function buildParts(text) {
  const parts = [];
  const regex = /@([\w.]+)/g;
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

// Renders @username as highlighted + tappable only if the user actually exists.
const MentionText = ({ children, style, onMentionPress, ...rest }) => {
  const { theme } = useTheme();
  const text = typeof children === "string" ? children : String(children ?? "");

  const mentions = extractMentions(text);

  // Seed initial valid set from cache so cached hits render immediately.
  const [validUsernames, setValidUsernames] = useState(() => {
    const s = new Set();
    mentions.forEach((u) => {
      if (usernameCache[u.toLowerCase()] === true) s.add(u.toLowerCase());
    });
    return s;
  });

  useEffect(() => {
    if (mentions.length === 0) return;
    let cancelled = false;
    const unchecked = mentions.filter((u) => !(u.toLowerCase() in usernameCache));
    if (unchecked.length === 0) return;
    Promise.all(unchecked.map((u) => checkUsername(u))).then(() => {
      if (cancelled) return;
      setValidUsernames((prev) => {
        const next = new Set(prev);
        mentions.forEach((u) => {
          if (usernameCache[u.toLowerCase()] === true) next.add(u.toLowerCase());
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (mentions.length === 0) {
    return <Text style={style} {...rest}>{text}</Text>;
  }

  const parts = buildParts(text);

  return (
    <Text style={style} {...rest}>
      {parts.map((part, i) =>
        part.type === "mention" && validUsernames.has(part.username.toLowerCase()) ? (
          <Text
            key={i}
            style={{
              color: theme.primary,
              textDecorationLine: "underline",
              fontWeight: "600",
            }}
            onPress={() => onMentionPress?.(part.username)}
          >
            {part.value}
          </Text>
        ) : (
          <Text key={i}>{part.type === "mention" ? part.value : part.value}</Text>
        )
      )}
    </Text>
  );
};

export default MentionText;
