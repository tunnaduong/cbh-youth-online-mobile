import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { getSystemMessageText } from "../../../../utils/systemMessageText";
import { styles } from "./styles";
import { MessageRow } from "./MessageRow";

const isRealMessage = (m) => m.type !== "date" && m.type !== "time" && m.content_type !== "system";

// One entry of the list: the wrapper that records the row's position (for
// jump-to-message and video autoplay) and either a date / time header, a
// system line or a MessageRow. Memoized, so when one message arrives or
// changes only the rows whose own props changed re-render - the list used to
// rebuild every wrapper (with a fresh onLayout and style) for each change.
const MessageListItem = React.memo(({
  value,
  prev,
  next,
  isHighlighted,
  isGroupChat,
  theme,
  isDarkMode,
  t,
  username,
  navigation,
  mediaLoadError,
  isDownloadingThis,
  messageHandlersRef,
  onImageError,
  seenAvatars,
  activeInlineVideoId,
  autoplayVideos,
  bubbleMaxWidth,
  messageLayoutOffsetsRef,
  pendingHighlightMessageIdRef,
  attemptScrollToHighlightRef,
}) => {
  const handleLayout = (e) => {
    if (value.type === "message" && value.id != null) {
      messageLayoutOffsetsRef.current[value.id] = {
        y: e.nativeEvent.layout.y,
        height: e.nativeEvent.layout.height,
      };
      if (String(pendingHighlightMessageIdRef.current) === String(value.id)) {
        attemptScrollToHighlightRef.current();
      }
    }
  };

  return (
    <View
      onLayout={handleLayout}
      style={
        isHighlighted
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
        <View style={styles.dateHeaderContainer}>
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
          isGroupChat={isGroupChat}
          theme={theme}
          isDarkMode={isDarkMode}
          t={t}
          username={username}
          navigation={navigation}
          mediaLoadError={mediaLoadError}
          isDownloadingThis={isDownloadingThis}
          handlersRef={messageHandlersRef}
          onImageError={onImageError}
          seenAvatars={seenAvatars}
          activeInlineVideoId={activeInlineVideoId}
          autoplayVideos={autoplayVideos}
          bubbleMaxWidth={bubbleMaxWidth}
        />
      )}
    </View>
  );
});

// Renders the whole scrollable list of message rows (date/time headers +
// MessageRow bubbles). Memoized so the screen re-rendering (the composer,
// modals, typing row...) does not touch the list; it only re-renders when the
// messages themselves (or the few other props below) change, and then each
// MessageListItem skips itself unless its own props changed.
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
  // A flat "75%" bubble width reads fine on a phone, but on a tablet 75% of
  // the screen is still a very wide line of text - cap it in absolute pixels
  // too. Worked out once here: each row reading the window size itself
  // re-rendered every bubble whenever the window's height changed.
  const { width: screenWidth } = useWindowDimensions();
  const bubbleMaxWidth = Math.min(screenWidth * 0.75, 420);

  // Nearest real-message neighbours for each item (system messages and
  // date/time headers do not count), so rows can group consecutive messages
  // without scanning the array themselves. One pass each way.
  const prevOf = new Array(messages.length);
  const nextOf = new Array(messages.length);
  let lastReal = null;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    // A real message's neighbour is the previous real message; a header's
    // neighbour is the nearest real message before it.
    prevOf[i] = lastReal;
    if (isRealMessage(m)) lastReal = m;
  }
  let nextReal = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    nextOf[i] = nextReal;
    if (isRealMessage(m)) nextReal = m;
  }
  const lastRealMessage = lastReal;

  // "Seen by" read receipts (group chats only). There's no per-message read
  // table on the backend - each participant just has a single last_read_at
  // timestamp for the conversation. The inline avatar stack only ever shows
  // under YOUR OWN truly-last message in the conversation, exactly like
  // Messenger - never under someone else's message (if they sent the last
  // message, nothing shows inline at all), and never scattered across
  // earlier messages of yours (use the "Lượt xem" menu action on those).
  let inlineSeenAvatars = [];
  if (isGroupChat && lastRealMessage?.is_myself && seenParticipants?.length > 0) {
    const createdAt = new Date(lastRealMessage.created_at).getTime();
    inlineSeenAvatars = seenParticipants.filter(
      (p) => p.last_read_at && new Date(p.last_read_at).getTime() >= createdAt
    );
  }

  return messages.map((value, index) => (
    // type+id alone (no index) - "load more" pagination prepends older
    // messages, shifting every index. A key that includes index made React
    // treat every already-rendered row as brand new on each scroll-up load,
    // remounting (not just re-rendering) the entire message list every time.
    <MessageListItem
      key={`${value.type}-${value.id}`}
      value={value}
      prev={prevOf[index]}
      next={nextOf[index]}
      // String(): an id that came with a notification is a string.
      isHighlighted={highlightedMessageId != null && String(value.id) === String(highlightedMessageId)}
      isGroupChat={isGroupChat}
      theme={theme}
      isDarkMode={isDarkMode}
      t={t}
      username={username}
      navigation={navigation}
      mediaLoadError={mediaLoadErrors[value.id]}
      isDownloadingThis={downloadingFileId === value.id}
      messageHandlersRef={messageHandlersRef}
      onImageError={onImageError}
      seenAvatars={value.id === lastRealMessage?.id ? inlineSeenAvatars : undefined}
      // Only the row that IS the active video is given the id; every other
      // row gets null, so a video starting or stopping mid-scroll does not
      // change a prop of every message.
      activeInlineVideoId={
        String(value.id) === String(activeInlineVideoId) ? activeInlineVideoId : null
      }
      autoplayVideos={autoplayVideos}
      bubbleMaxWidth={bubbleMaxWidth}
      messageLayoutOffsetsRef={messageLayoutOffsetsRef}
      pendingHighlightMessageIdRef={pendingHighlightMessageIdRef}
      attemptScrollToHighlightRef={attemptScrollToHighlightRef}
    />
  ));
});

export { MessagesListContent };
