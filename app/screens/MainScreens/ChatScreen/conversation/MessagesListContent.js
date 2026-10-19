import React from "react";
import { View, Text } from "react-native";
import { getSystemMessageText } from "../../../../utils/systemMessageText";
import { styles } from "./styles";
import { MessageRow } from "./MessageRow";

// Renders the whole scrollable list of message rows (date/time headers +
// MessageRow bubbles). Split out from ConversationScreen's render and
// wrapped in React.memo for one reason: ConversationScreen re-renders on
// every keystroke in the composer (`message` state / setMessage), and
// before this split, building this list was an inline IIFE in that same
// render - so every keystroke re-iterated and rebuilt a React element for
// EVERY message in the conversation (this app uses a plain ScrollView here,
// not a virtualized FlatList, so nothing was windowing that cost either).
// That's what caused the visible stutter/jank while typing in chats with
// more than a handful of messages. None of this component's props change
// when `message`/composer text changes, so React.memo now makes typing a
// no-op for this subtree - it only re-renders when the messages themselves
// (or the few other props below) actually change.
const MessagesListContent = React.memo(({
  messages,
  isGroupChat,
  theme,
  isDarkMode,
  t,
  username,
  navigation,
  mediaLoadErrors,
  downloadingFileId,
  messageHandlersRef,
  onImageError,
  activeInlineVideoId,
  autoplayVideos,
  highlightedMessageId,
  messageLayoutOffsetsRef,
  pendingHighlightMessageIdRef,
  attemptScrollToHighlightRef,
  seenParticipants,
}) => {
  // Pre-compute nearest real-message neighbours for each item so
  // MessageRow doesn't have to O(n)-scan the array itself.
  const realMessages = [];
  messages.forEach((m, i) => {
    // System messages ("X added Y to the group") render as a centered pill, not a
    // bubble - exclude them here too so they don't get counted as a neighbour when
    // deciding whether consecutive real messages should visually group together.
    if (m.type !== "date" && m.type !== "time" && m.content_type !== "system") {
      realMessages.push({ m, i });
    }
  });
  const realIdxOf = new Map(realMessages.map(({ m, i }, ri) => [i, ri]));

  // "Seen by" read receipts (group chats only). There's no per-message read
  // table on the backend - each participant just has a single last_read_at
  // timestamp for the conversation. The inline avatar stack only ever shows
  // under YOUR OWN truly-last message in the conversation, exactly like
  // Messenger - never under someone else's message (if they sent the last
  // message, nothing shows inline at all), and never scattered across
  // earlier messages of yours (use the "Lượt xem" menu action on those).
  const lastRealMessage = realMessages.length > 0 ? realMessages[realMessages.length - 1].m : null;
  let inlineSeenAvatars = [];
  if (isGroupChat && lastRealMessage?.is_myself && seenParticipants?.length > 0) {
    const createdAt = new Date(lastRealMessage.created_at).getTime();
    inlineSeenAvatars = seenParticipants.filter(
      (p) => p.last_read_at && new Date(p.last_read_at).getTime() >= createdAt
    );
  }

  return messages.map((value, index) => {
    let prev = null;
    let next = null;
    const ri = realIdxOf.get(index);
    if (ri != null) {
      prev = ri > 0 ? realMessages[ri - 1].m : null;
      next = ri < realMessages.length - 1 ? realMessages[ri + 1].m : null;
    } else {
      // date/time header — walk to find adjacent real messages
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i].type !== "date" && messages[i].type !== "time" && messages[i].content_type !== "system") { prev = messages[i]; break; }
      }
      for (let i = index + 1; i < messages.length; i++) {
        if (messages[i].type !== "date" && messages[i].type !== "time" && messages[i].content_type !== "system") { next = messages[i]; break; }
      }
    }

    return (
      // type+id alone (no index) - "load more" pagination prepends older
      // messages, shifting every index. A key that includes index made React
      // treat every already-rendered row as brand new on each scroll-up load,
      // remounting (not just re-rendering) the entire message list every
      // time - by far the biggest source of chat lag once a conversation had
      // any scroll-back history loaded.
      <View
        key={`${value.type}-${value.id}`}
        onLayout={(e) => {
          if (value.type === "message" && value.id != null) {
            messageLayoutOffsetsRef.current[value.id] = {
              y: e.nativeEvent.layout.y,
              height: e.nativeEvent.layout.height,
            };
            if (String(pendingHighlightMessageIdRef.current) === String(value.id)) {
              attemptScrollToHighlightRef.current();
            }
          }
        }}
        style={
          // String(): an id that came with a notification is a string.
          highlightedMessageId != null && String(value.id) === String(highlightedMessageId)
            ? {
                backgroundColor: isDarkMode
                  ? "rgba(250,204,21,0.15)"
                  : "rgba(250,204,21,0.25)",
                borderRadius: 12,
              }
            : undefined
        }
      >
        {value.type === "date" ? (
          <View
            style={styles.dateHeaderContainer}
            key={value.is_myself ? "my" + value.id : "their" + value.id}
          >
            <Text
              style={[
                styles.dateHeaderText,
                {
                  backgroundColor: isDarkMode ? "#374151" : "#f0f0f0",
                  color: theme.subText,
                },
              ]}
            >
              {value.date}
            </Text>
          </View>
        ) : value.type === "time" ? (
          <View style={styles.timeHeaderContainer}>
            <Text
              style={[
                styles.timeHeaderText,
                {
                  backgroundColor: isDarkMode ? "#374151" : "#f0f0f0",
                  color: theme.subText,
                },
              ]}
            >
              {value.time}
            </Text>
          </View>
        ) : value.content_type === "system" ? (
          <View style={styles.systemMessageContainer}>
            <Text
              style={[
                styles.systemMessageText,
                { backgroundColor: isDarkMode ? "#262626" : "#f0f0f0", color: theme.subText },
              ]}
            >
              {getSystemMessageText(value, t)}
            </Text>
          </View>
        ) : (
          <MessageRow
            item={value}
            prevMessage={prev}
            nextMessage={next}
            index={index}
            isGroupChat={isGroupChat}
            theme={theme}
            isDarkMode={isDarkMode}
            t={t}
            username={username}
            navigation={navigation}
            mediaLoadError={mediaLoadErrors[value.id]}
            isDownloadingThis={downloadingFileId === value.id}
            handlersRef={messageHandlersRef}
            onImageError={onImageError}
            seenAvatars={value.id === lastRealMessage?.id ? inlineSeenAvatars : undefined}
            // Only the row that IS the active video is given the id; every
            // other row gets null. A row only ever compares the id with its
            // own, so nothing changes for it - but with the raw id as a prop,
            // one video starting or stopping mid-scroll changed a prop of
            // every message and re-rendered the whole list.
            activeInlineVideoId={
              String(value.id) === String(activeInlineVideoId) ? activeInlineVideoId : null
            }
            autoplayVideos={autoplayVideos}
          />
        )}
      </View>
    );
  });
});

export { MessagesListContent };
