import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import axiosInstance from "../services/api/axiosInstance";

// Module-level cache so each username is only validated once per app session.
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

/**
 * Renders @username as highlighted + tappable only if the user actually exists.
 *
 * Props:
 *   children   - string message content
 *   mentions   - optional array of {username, user_id} from the server.
 *                When provided, skips async profile validation entirely.
 *   onMentionPress(username) - called when a valid mention is tapped
 */
const MentionText = ({ children, style, onMentionPress, mentions, ...rest }) => {
  const { theme } = useTheme();
  const text = typeof children === "string" ? children : String(children ?? "");

  const tokenMentions = extractMentions(text);

  // If server provided mentions, build the valid set immediately (no async needed).
  const serverValidSet = React.useMemo(() => {
    if (!mentions) return null;
    const s = new Set();
    mentions.forEach((m) => s.add(m.username.toLowerCase()));
    return s;
  }, [mentions]);

  // Seed initial valid set from cache so cached hits render immediately.
  const [validUsernames, setValidUsernames] = useState(() => {
    if (serverValidSet) return serverValidSet;
    const s = new Set();
    tokenMentions.forEach((u) => {
      if (usernameCache[u.toLowerCase()] === true) s.add(u.toLowerCase());
    });
    return s;
  });

  useEffect(() => {
    // When server provides mentions, use them directly — no async calls needed.
    if (serverValidSet !== null) {
      setValidUsernames(serverValidSet);
      // Populate the module-level cache so other components benefit.
      tokenMentions.forEach((u) => {
        const key = u.toLowerCase();
        usernameCache[key] = serverValidSet.has(key);
      });
      return;
    }

    if (tokenMentions.length === 0) return;
    let cancelled = false;
    const unchecked = tokenMentions.filter((u) => !(u.toLowerCase() in usernameCache));
    if (unchecked.length === 0) return;
    Promise.all(unchecked.map((u) => checkUsername(u))).then(() => {
      if (cancelled) return;
      setValidUsernames((prev) => {
        const next = new Set(prev);
        tokenMentions.forEach((u) => {
          if (usernameCache[u.toLowerCase()] === true) next.add(u.toLowerCase());
        });
        return next;
      });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, serverValidSet]);

  if (tokenMentions.length === 0) {
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
          <Text key={i}>{part.value}</Text>
        )
      )}
    </Text>
  );
};

export default MentionText;
