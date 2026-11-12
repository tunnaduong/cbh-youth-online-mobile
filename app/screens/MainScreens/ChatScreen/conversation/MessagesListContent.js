import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getSystemMessageText } from "../../../../utils/systemMessageText";
import { styles } from "./styles";
import { MessageRow } from "./MessageRow";
import CallMessageCard, { isCallMessage } from "../../../../components/call/CallMessageCard";

const isRealMessage = (m) =>
  m.type !== "date" &&
  m.type !== "time" &&
  m.content_type !== "system" &&
  !isCallMessage(m);

// Module-level height cache (`${conversationId}:${id}` -> height) so measured
// message heights survive component remounts and prevent layout jumps when
// scrolling rapidly through long chat histories.
const messageHeightCache = new Map();
const MAX_MESSAGE_HEIGHT_CACHE = 2000;
function setCachedMessageHeight(cacheKey, height) {
  if (!cacheKey || !(height > 0)) return;
  if (messageHeightCache.has(cacheKey)) messageHeightCache.delete(cacheKey);
  messageHeightCache.set(cacheKey, height);
  if (messageHeightCache.size > MAX_MESSAGE_HEIGHT_CACHE) {
    const oldest = messageHeightCache.keys().next().value;
    messageHeightCache.delete(oldest);
  }
}

// A run of consecutive rows that are far outside the viewport, replaced by
// ONE empty view of their combined (measured) height - so the native view
// count stays about the size of the window however far the history is
// scrolled, instead of one placeholder per message. Its onLayout hands every
// row inside it a fresh `y` (spacer y + heights above it), which keeps jump-
// to-message / autoplay offsets right after older pages are prepended.
const OffscreenSpacer = React.memo(
  ({ rows, totalHeight, rowLayoutsRef, messageLayoutOffsetsRef }) => (
    <View
      style={{ height: totalHeight }}
      onLayout={(e) => {
        let y = e.nativeEvent.layout.y;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          rowLayoutsRef.current.set(row.key, { y, height: row.height });
          if (row.messageId != null) {
            messageLayoutOffsetsRef.current[row.messageId] = { y, height: row.height };
          }
          y += row.height;
        }
      }}
    />
  ),
  (prev, next) =>
    prev.totalHeight === next.totalHeight &&
    prev.rows.length === next.rows.length &&
    prev.rows[0].key === next.rows[0].key &&
    prev.rows[prev.rows.length - 1].key === next.rows[next.rows.length - 1].key,
);

// Newest rows are never collapsed: the bottom of the chat is where new
// messages land and where the "seen by" avatars sit.
const ALWAYS_MOUNTED_TAIL = 8;

// One entry of the list: the wrapper that records the row's position (for
// jump-to-message and video autoplay) and either a date / time header, a
// system line or a MessageRow. Memoized, so when one message arrives or
// changes only the rows whose own props changed re-render - the list used to
// rebuild every wrapper (with a fresh onLayout and style) for each change.
// Crucially, `isOffscreen` is passed as a primitive boolean (not the changing
// `visibleViewport` object), so scrolling only re-renders the 2-4 rows
// crossing the viewport boundary in O(1).
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
  otherUser,
  conversationId,
  activeInlineVideoId,
  autoplayVideos,
  bubbleMaxWidth,
  messageLayoutOffsetsRef,
  pendingHighlightMessageIdRef,
  attemptScrollToHighlightRef,
  onRowLayout,
  isLastRealMessage,
}) => {
  const cacheKey = value.id != null ? `${conversationId || ""}:${value.type}:${value.id}` : null;

  const handleLayout = (e) => {
    const { y, height } = e.nativeEvent.layout;
    if (cacheKey && height > 0) {
      setCachedMessageHeight(cacheKey, height);
    }
    onRowLayout(`${value.type}-${value.id}`, y, height);
    if (value.type === "message" && value.id != null) {
      messageLayoutOffsetsRef.current[value.id] = {
        y,
        height: height > 0 ? height : (messageLayoutOffsetsRef.current[value.id]?.height || 0),
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
          <View
            style={[
              styles.dateHeaderPill,
              {
                backgroundColor: isDarkMode ? "rgba(30, 37, 43, 0.85)" : "rgba(230, 238, 234, 0.9)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={isDarkMode ? "#9CA3AF" : "#4B5563"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.dateHeaderText,
                { color: isDarkMode ? "#D1D5DB" : "#374151" },
              ]}
            >
              {value.date}
            </Text>
          </View>
        </View>
      ) : value.type === "time" ? (
        <View style={styles.timeHeaderContainer}>
          <View
            style={[
              styles.timeHeaderPill,
              {
                backgroundColor: isDarkMode ? "rgba(30, 37, 43, 0.75)" : "rgba(230, 238, 234, 0.85)",
                borderColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Text
              style={[
                styles.timeHeaderText,
                { color: isDarkMode ? "#9CA3AF" : "#4B5563" },
              ]}
            >
              {value.time}
            </Text>
          </View>
        </View>
      ) : isCallMessage(value) ? (
        <CallMessageCard
          message={value}
          conversationId={conversationId}
          theme={theme}
          isDarkMode={isDarkMode}
          t={t}
        />
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
          otherUser={otherUser}
          activeInlineVideoId={activeInlineVideoId}
          autoplayVideos={autoplayVideos}
          bubbleMaxWidth={bubbleMaxWidth}
          isLastRealMessage={isLastRealMessage}
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
  otherUser,
  visibleViewport,
  conversationId,
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
  const inlineSeenAvatars = React.useMemo(() => {
    if (isGroupChat && lastRealMessage?.is_myself && seenParticipants?.length > 0) {
      const createdAt = new Date(lastRealMessage.created_at).getTime();
      return seenParticipants.filter(
        (p) => p.last_read_at && new Date(p.last_read_at).getTime() >= createdAt
      );
    }
    if (!isGroupChat && lastRealMessage?.is_myself && lastRealMessage?.read_at && otherUser) {
      return [otherUser];
    }
    return undefined;
  }, [isGroupChat, lastRealMessage?.id, lastRealMessage?.is_myself, lastRealMessage?.created_at, lastRealMessage?.read_at, seenParticipants, otherUser]);

  // Last measured { y, height } of every row kind (message, date, time,
  // system, call), keyed like the React key. messageLayoutOffsetsRef only
  // covers messages, so date/time/system/call rows could never be collapsed.
  const rowLayoutsRef = React.useRef(new Map());
  const onRowLayout = React.useCallback((rowKey, y, height) => {
    if (height > 0) rowLayoutsRef.current.set(rowKey, { y, height });
  }, []);

  // Both layout maps only ever grew (an entry for every row ever mounted).
  // Drop what is no longer in the list once they are clearly larger than it.
  React.useEffect(() => {
    const rows = rowLayoutsRef.current;
    if (rows.size > messages.length + 60) {
      const alive = new Set(messages.map((m) => `${m.type}-${m.id}`));
      for (const key of rows.keys()) if (!alive.has(key)) rows.delete(key);
    }
    const byId = messageLayoutOffsetsRef.current;
    const ids = Object.keys(byId);
    if (ids.length > messages.length + 60) {
      const aliveIds = new Set(messages.map((m) => String(m.id)));
      ids.forEach((id) => {
        if (!aliveIds.has(id)) delete byId[id];
      });
    }
  }, [messages, messageLayoutOffsetsRef]);

  const out = [];
  let run = null;
  const flushRun = () => {
    if (!run) return;
    out.push(
      <OffscreenSpacer
        key={`offscreen-${run.rows[0].key}`}
        rows={run.rows}
        totalHeight={run.totalHeight}
        rowLayoutsRef={rowLayoutsRef}
        messageLayoutOffsetsRef={messageLayoutOffsetsRef}
      />,
    );
    run = null;
  };

  messages.forEach((value, index) => {
    const rowKey = `${value.type}-${value.id}`;
    const isHighlighted =
      highlightedMessageId != null && String(value.id) === String(highlightedMessageId);
    const layout = rowLayoutsRef.current.get(rowKey);
    const isOffscreen = Boolean(
      visibleViewport &&
      value.id != null &&
      index < messages.length - ALWAYS_MOUNTED_TAIL &&
      !isHighlighted &&
      String(pendingHighlightMessageIdRef.current) !== String(value.id) &&
      String(value.id) !== String(activeInlineVideoId) &&
      layout &&
      (layout.y + layout.height < visibleViewport.top || layout.y > visibleViewport.bottom)
    );

    if (isOffscreen) {
      if (!run) run = { rows: [], totalHeight: 0 };
      run.rows.push({
        key: rowKey,
        height: layout.height,
        messageId: value.type === "message" ? value.id : null,
      });
      run.totalHeight += layout.height;
      return;
    }
    flushRun();

    out.push(
      // type+id alone (no index) - "load more" pagination prepends older
      // messages, shifting every index. A key that includes index made React
      // treat every already-rendered row as brand new on each scroll-up load,
      // remounting (not just re-rendering) the entire message list every time.
      <MessageListItem
        key={rowKey}
        value={value}
        prev={prevOf[index]}
        next={nextOf[index]}
        // String(): an id that came with a notification is a string.
        isHighlighted={isHighlighted}
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
        onRowLayout={onRowLayout}
        conversationId={conversationId}
        otherUser={otherUser}
        isLastRealMessage={value.id === lastRealMessage?.id ? true : undefined}
      />,
    );
  });
  flushRun();
  return out;
});

export { MessagesListContent };
