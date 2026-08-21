import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
  Animated,
  StatusBar,
  Dimensions,
  Modal,
  PanResponder,
  TouchableWithoutFeedback,
  Keyboard,
  BackHandler,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import InlineVideoPlayer from "../../../components/InlineVideoPlayer";
import ImageView from "react-native-image-viewing";
import { useVideoPlayer, VideoView } from "expo-video";
import FastImage from "../../../components/FastImage";
import {
  getConversationMessages,
  getConversations,
  sendMessage,
  createConversation,
  markConversationAsRead,
  blockUser,
  reportUser,
  reactToMessage,
  removeMessageReaction,
  recallMessage,
  editMessage,
  getConversationMentionSuggestions,
  getMentionSuggestions,
  getOnlineStatus,
  leaveGroupConversation,
  getGroupSeenReceipts,
  getNotificationSettings,
} from "../../../services/api/Api";
import MentionText from "../../../components/MentionText";
import MentionSuggestions, { useMentionInput } from "../../../components/MentionSuggestions";
import ReportModal from "../../../components/ReportModal";
import ChatBackgroundModal from "../../../components/ChatBackgroundModal";
import CommentBar from "../../../components/CommentBar";
import ReplyPreviewBubble from "../../../components/ReplyPreviewBubble";
import ReplyComposerBar from "../../../components/ReplyComposerBar";
import MessageReactionPicker, {
  REACTION_EMOJI_BY_TYPE,
  REACTION_EMOJIS,
} from "../../../components/MessageReactionPicker";
import { downloadMediaToLibrary } from "../../../utils/mediaDownload";
import ForwardMessageModal from "../../../components/ForwardMessageModal";
import { Alert, ActionSheetIOS, KeyboardAvoidingView, Clipboard } from "react-native";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import formatTime from "../../../utils/formatTime";
import "dayjs/locale/vi";
import "dayjs/locale/ru";
import { storage } from "../../../global/storage";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
import { isPublicGroupChat } from "../../../utils/chatHelpers";
import { getSystemMessageText } from "../../../utils/systemMessageText";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Api from "../../../services/api/ApiByAxios";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import LiquidButton from "../../../components/LiquidButton";
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
  KeyboardGestureArea,
} from "react-native-keyboard-controller";

// Attachment URLs coming from the API are host-relative (e.g. "/storage/...");
// local optimistic messages use file:// or content:// URIs, and http(s) may
// already be absolute if the backend ever returns a CDN url. Storage files
// are served by the API app, not the marketing site - every other screen in
// this app resolves relative paths against api.chuyenbienhoa.com (see
// ArchiveScreen/HomeScreen's resolveStoryMediaUrl), so match that instead of
// the bare domain, which 404s.
const resolveMediaUrl = (url) => {
  if (!url) return null;
  if (
    url.startsWith("http") ||
    url.startsWith("file:") ||
    url.startsWith("content:")
  ) {
    return url;
  }
  return `https://api.chuyenbienhoa.com${url}`;
};

dayjs.locale(i18n.language || "vi");

const CONVERSATION_CACHE_KEY = "conversation_";
const CONVERSATION_TIMESTAMP_KEY = "conversation_timestamp_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
// axiosInstance's default timeout (10s) is tuned for regular API calls and is
// far too short for multi-MB attachment uploads (video/file allow up to
// 100MB on the backend). 120s was still too short on slower mobile uplinks -
// a ~90MB video comfortably takes several minutes on 3G/weak wifi, and the
// old timeout made those uploads fail with no clear explanation partway
// through instead of either succeeding or failing fast. Matches the 10-minute
// budget used on web.
const ATTACHMENT_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const ATTACHMENT_UPLOAD_CONFIG = { timeout: ATTACHMENT_UPLOAD_TIMEOUT_MS };

// Mirrors the backend's per-type validation (ChatController::sendMessage) so
// we can reject an attachment that's guaranteed to fail instantly, with a
// clear reason, instead of letting the user watch a spinner for minutes only
// to hit a generic error once the upload finally reaches the server (or
// times out before it even gets there).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB

function formatBytesForToast(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const formatMessageTime = (timestamp, t) => {
  const messageTime = dayjs(timestamp);
  const hours = parseInt(messageTime.format("H"));
  const period =
    hours < 12 ? t("chatConversation.am") : t("chatConversation.pm");
  return `${messageTime.format("hh:mm")} ${period}`;
};

const injectTimeHeaders = (messages, t) => {
  const result = [];
  let currentDate = null;

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    const currTime = dayjs(msg.created_at);
    const currDate = currTime.startOf("day");

    // Check if we need to add a date header
    if (!currentDate || !currDate.isSame(currentDate)) {
      currentDate = currDate;
      const today = dayjs().startOf("day");
      const isToday = currDate.isSame(today);
      const isYesterday = currDate.isSame(today.subtract(1, "day"));

      let dateText;
      if (isToday) {
        dateText = t("chatConversation.today");
      } else if (isYesterday) {
        dateText = t("chatConversation.yesterday");
      } else {
        dateText = currDate.format("DD/MM/YYYY");
      }

      result.push({
        id: `date-${msg.id}`,
        type: "date",
        date: dateText,
      });
    }

    // Check if we need to add a time header (for messages more than 5 minutes apart)
    let showTimeHeader = false;
    if (!prev) {
      showTimeHeader = true;
    } else {
      const prevTime = dayjs(prev.created_at);
      if (currTime.diff(prevTime, "minute") > 5) {
        showTimeHeader = true;
      }
    }

    if (showTimeHeader) {
      result.push({
        id: `time-${msg.id}`,
        type: "time",
        time: currTime.format("HH:mm"),
      });
    }

    // `type` doubles as the list-envelope discriminator ("message" vs "date"/"time"
    // headers) elsewhere in this screen, which would otherwise clobber the backend's
    // content type (text/image/file) - keep that around separately so attachment
    // bubbles still render correctly after any refetch. Messages that already went
    // through this function (e.g. re-merged on scroll-up pagination) have `type`
    // set to "message" already, so fall back to their existing `content_type`
    // instead of overwriting it.
    result.push({
      ...msg,
      type: "message",
      content_type: msg.content_type ?? msg.type,
    });
  });

  return result;
};

// Full-screen video player - a separate component so useVideoPlayer only ever
// mounts (and allocates a native player) while the modal is actually open.
const VideoViewerModal = ({ visible, uri, onClose, insetsTop }) => {
  const { autoplayVideos } = useTheme();
  const isFocused = useIsFocused();
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = false;
    if (uri && autoplayVideos) p.play();
  });

  useEffect(() => {
    if (!player || typeof player !== "object") return;
    if (!isFocused) {
      try {
        if (typeof player.pause === "function") player.pause();
      } catch (e) {
        console.warn("VideoViewerModal: failed to pause player on blur", e);
      }
    }
  }, [isFocused, player]);

  useEffect(() => {
    console.debug("[VideoViewerModal] player mounted/changed", { uri, player });
    return () => {
      if (!player) return;
      try {
        if (typeof player.playing !== "undefined" ? player.playing === true : false) {
          if (typeof player.pause === "function") {
            player.pause();
            console.debug("[VideoViewerModal] paused player during cleanup", { uri });
          }
        }
      } catch (e) {
        console.warn("[VideoViewerModal] error pausing player during cleanup", e);
      }
      try {
        if (typeof player.release === "function") {
          player.release();
          console.debug("[VideoViewerModal] released player during cleanup", { uri });
        }
      } catch (e) {
        console.warn("[VideoViewerModal] error releasing player during cleanup", e);
      }
    };
  }, [player, uri]);

  // remount the VideoView if the player reference changes to avoid
  // referencing a native player that was already released
  const [playerKey, setPlayerKey] = useState(0);
  useEffect(() => {
    setPlayerKey((k) => k + 1);
  }, [player]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoViewerBackdrop}>
        <TouchableOpacity
          style={[styles.videoViewerClose, { top: insetsTop + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {player && typeof player === "object" ? (
          <VideoView
            key={playerKey}
            style={styles.videoViewerPlayer}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        ) : null}
      </View>
    </Modal>
  );
};

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
            if (pendingHighlightMessageIdRef.current === value.id) {
              attemptScrollToHighlightRef.current();
            }
          }
        }}
        style={
          value.id === highlightedMessageId
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
            activeInlineVideoId={activeInlineVideoId}
            autoplayVideos={autoplayVideos}
          />
        )}
      </View>
    );
  });
});

const SWIPE_THRESHOLD = 55;
const SWIPE_ICON_OFFSET = 44;

const SwipeableMessage = ({ children, isMyMessage, onSwipe }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      // Capture phase runs top-down BEFORE any nested touchable (e.g. the
      // video tile's mute button) gets a chance to claim the responder in
      // the bubble phase - without this, a clear horizontal swipe starting
      // on top of a nested TouchableOpacity never reached this PanResponder
      // at all, so swipe-to-reply silently did nothing on video messages.
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        triggeredRef.current = false;
      },
      onPanResponderMove: (_, g) => {
        const clamped = g.dx > 0
          ? Math.min(SWIPE_THRESHOLD + 10, g.dx)
          : Math.max(-(SWIPE_THRESHOLD + 10), g.dx);
        translateX.setValue(clamped);
        if (Math.abs(clamped) >= SWIPE_THRESHOLD && !triggeredRef.current) {
          triggeredRef.current = true;
          onSwipe?.();
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      },
    })
  ).current;

  // Left icon: visible when swiping right (positive translateX)
  const leftIconOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const leftIconTranslateX = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD + 10],
    outputRange: [0, SWIPE_ICON_OFFSET + 10],
    extrapolate: "clamp",
  });

  // Right icon: visible when swiping left (negative translateX)
  const rightIconOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const rightIconTranslateX = translateX.interpolate({
    inputRange: [-(SWIPE_THRESHOLD + 10), 0],
    outputRange: [-(SWIPE_ICON_OFFSET + 10), 0],
    extrapolate: "clamp",
  });

  const iconStyle = {
    position: "absolute",
    top: "50%",
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  };

  return (
    <View style={{ overflow: "visible" }}>
      {/* Left icon — appears when swiping right */}
      <Animated.View
        style={[iconStyle, { left: 4, opacity: leftIconOpacity, transform: [{ translateX: leftIconTranslateX }] }]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-undo" size={16} color="#fff" />
      </Animated.View>
      {/* Right icon — appears when swiping left */}
      <Animated.View
        style={[iconStyle, { right: 4, opacity: rightIconOpacity, transform: [{ translateX: rightIconTranslateX }] }]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-undo" size={16} color="#fff" />
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

// Reactions row under a message bubble - split out of MessageRow (below) so
// a reaction change only re-renders this small badge, not the whole bubble.
const ReactionBadge = React.memo(({ item, theme, isDarkMode, handlersRef }) => {
  if (typeof item.id !== "number") return null;

  const reactions = item.reactions;
  const hasReactions = reactions && reactions.total > 0;

  // For my messages: row anchored at bottom-left → [...] [👍]
  // For theirs: row anchored at bottom-right → [👍] [...]
  const rowAnchor = item.is_myself ? { left: -6 } : { right: -6 };

  const bgColor = isDarkMode ? "#262626" : "#ffffff";

  // Top 2 emojis by count for the pill
  const topTwo = hasReactions
    ? [...reactions.summary]
        .sort((a, b) => b.count - a.count)
        .slice(0, 2)
        .map((s) => REACTION_EMOJI_BY_TYPE[s.type] || "👍")
    : [];

  const dotsBtn = (
    <TouchableOpacity
      key="dots"
      onPress={(evt) => handlersRef.current.openReactionPicker(item, evt)}
      style={[
        styles.reactionIconBtn,
        { backgroundColor: bgColor, borderColor: theme.border },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Ionicons name="happy-outline" size={13} color={theme.subText} />
    </TouchableOpacity>
  );

  const pill = hasReactions ? (
    <TouchableOpacity
      key="pill"
      onPress={() => handlersRef.current.setReactionModal({ visible: true, reactions })}
      style={[
        styles.reactionPillBadge,
        { backgroundColor: bgColor, borderColor: theme.border },
      ]}
    >
      <Text style={styles.reactionPillEmoji}>{topTwo.join("")}</Text>
      <Text style={[styles.reactionPillCount, { color: theme.subText }]}>
        {reactions.total}
      </Text>
    </TouchableOpacity>
  ) : null;

  // Mine: [...] [pill?]  anchored at left
  // Theirs: [pill?] [...]  anchored at right
  const children = item.is_myself ? [dotsBtn, pill] : [pill, dotsBtn];

  return (
    <View style={[styles.reactionBadgeRow, rowAnchor]}>
      {children}
    </View>
  );
});

// Renders a compact grid of thumbnails for a multi-attachment message
// (item.file_urls with 2+ entries). Images show the actual thumbnail;
// videos don't have a per-item thumbnail from the backend so they fall back
// to the same placeholder box used for a single video, with a play icon
// overlay per cell. Tapping a cell hands the tapped index back to the
// caller so it can open the right viewer (gallery-swipe for images, single
// video viewer for videos).
const MultiAttachmentGrid = ({ urls, isVideo, onPressItem }) => {
  const items = urls.slice(0, 10);
  const columns = items.length <= 4 ? 2 : 3;
  const gap = 2;
  const cellSize = (200 - gap * (columns - 1)) / columns;
  return (
    <View style={{ width: 200, flexDirection: "row", flexWrap: "wrap", gap }}>
      {items.map((url, idx) => (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.85}
          onPress={() => onPressItem(idx)}
          style={{ width: cellSize, height: cellSize }}
        >
          {isVideo ? (
            <View style={[styles.videoPlaceholder, { width: "100%", height: "100%", borderRadius: 6 }]} />
          ) : (
            <FastImage
              source={{ uri: resolveMediaUrl(url) }}
              style={{ width: "100%", height: "100%", borderRadius: 6 }}
              resizeMode="cover"
            />
          )}
          {isVideo && (
            <View style={[styles.videoPlayOverlay, { borderRadius: 6 }]}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
};

// A single message bubble (everything renderMessage used to build inline for
// item.type === "message"). Split into its own React.memo'd component -
// previously this was all inline in ConversationScreen's render, so ANY
// screen state change (typing indicator, a media load error on one message,
// scroll position) re-rendered and re-diffed EVERY message in the whole
// conversation, which is the main reason chats with lots of images/videos
// felt laggy well before you scrolled anywhere near the edge of what's
// mounted. Handlers are passed via a stable `handlersRef` (see
// messageHandlersRef in ConversationScreen) instead of directly, so this
// component's props stay referentially stable across unrelated re-renders
// and React.memo can actually skip re-rendering a bubble whose own message
// didn't change.
// Image.getSize() is a native/network round-trip (fetches remote image
// headers to learn intrinsic dimensions) - without caching, every mount of
// an image/video MessageRow re-issued it, so opening or scrolling through a
// conversation with lots of media fired potentially hundreds of redundant
// native calls at once. Keyed by URL and shared across all MessageRow
// instances/remounts for the lifetime of the app.
const imageAspectRatioCache = new Map();

const MessageRow = React.memo(({
  item,
  prevMessage,
  nextMessage,
  index,
  isGroupChat,
  theme,
  isDarkMode,
  t,
  username,
  navigation,
  mediaLoadError,
  isDownloadingThis,
  handlersRef,
  onImageError,
  activeInlineVideoId,
  autoplayVideos,
  seenAvatars,
}) => {
  // For group chats, check if sender changed from previous message
  const senderChanged =
    isGroupChat &&
    !item.is_myself &&
    (!prevMessage ||
      prevMessage.is_myself !== item.is_myself ||
      prevMessage.sender?.id !== item.sender?.id ||
      (prevMessage.sender?.username !== item.sender?.username &&
        !prevMessage.sender?.id &&
        !item.sender?.id));

  // Check if this is the last message in a group (same sender and same alignment)
  // For group chats, also check if the next message is from a different sender
  const isLastInGroup =
    !nextMessage ||
    nextMessage.is_myself !== item.is_myself ||
    (isGroupChat &&
      !item.is_myself &&
      // Different sender IDs (for authenticated users)
      ((nextMessage.sender?.id &&
        item.sender?.id &&
        nextMessage.sender.id !== item.sender.id) ||
        // Different usernames (for guests or fallback)
        nextMessage.sender?.username !== item.sender?.username));

  // Check if this is a story reply message
  const isStoryReply = item.metadata?.story_reply === true;
  const storyOwnerName = item.metadata?.story_owner_name;

  // `type` is overloaded as the list envelope ("message"/"date"/"time"), so once a
  // message has gone through a refetch its original content type only survives in
  // `content_type` (see injectTimeHeaders) - check both so attachments keep
  // rendering as images/file cards instead of falling back to plain text.
  const isImageMessage = item.type === "image" || item.content_type === "image";
  const isVideoMessage = item.type === "video" || item.content_type === "video";
  const isFileMessage = item.type === "file" || item.content_type === "file";
  const resolvedFileUrl = resolveMediaUrl(item.file_url);
  const resolvedThumbnailUrl = resolveMediaUrl(item.metadata?.thumbnail_url);
  // Small (480px) muted preview clip for autoplay - see
  // MediaThumbnailService::videoPreview on the backend. Decoding a full
  // compressed video (up to 1920x1080) inline in a ~200px bubble burns far
  // more CPU than that tiny player needs; falls back to the full file for
  // older messages sent before this existed.
  const resolvedPreviewUrl = resolveMediaUrl(item.metadata?.preview_url);
  // Same idea for the static image bubble - a full-resolution original is
  // wasted decode/network cost at bubble size. Backend generates this
  // synchronously at send time, but falls back to the full file if it's
  // ever missing rather than showing nothing.
  const displayImageUrl = isImageMessage ? (resolvedThumbnailUrl || resolvedFileUrl) : null;
  const [imageAspectRatio, setImageAspectRatio] = useState(null);

  useEffect(() => {
    const url = isImageMessage ? displayImageUrl : isVideoMessage ? resolvedThumbnailUrl : null;
    if (!url) {
      setImageAspectRatio(null);
      return undefined;
    }

    const cached = imageAspectRatioCache.get(url);
    if (cached != null) {
      setImageAspectRatio(cached);
      return undefined;
    }

    let cancelled = false;
    setImageAspectRatio(null);
    // Try to get intrinsic size so we can preserve original ratio instead of 1:1 crop
    Image.getSize(
      url,
      (w, h) => {
        if (w > 0 && h > 0) imageAspectRatioCache.set(url, w / h);
        if (!cancelled && w > 0) setImageAspectRatio(w / h);
      },
      () => {
        /* ignore error, keep default square fallback */
      }
    );
    return () => {
      cancelled = true;
    };
  }, [displayImageUrl, resolvedThumbnailUrl, isImageMessage, isVideoMessage]);

  const handleSwipeReply = () => {
    const contentType =
      item.type === "image" || item.type === "video" || item.type === "file"
        ? item.type
        : item.content_type === "image" || item.content_type === "video" || item.content_type === "file"
          ? item.content_type
          : "text";
    handlersRef.current.setReplyingTo({
      id: item.id,
      content: contentType === "text" ? item.content : null,
      type: contentType,
      file_url: item.file_url ?? null,
      sender: item.sender,
    });
    handlersRef.current.focusInput?.();
  };

  return (
    <SwipeableMessage isMyMessage={item.is_myself} onSwipe={handleSwipeReply}>
    <View
      style={[
        // Add extra spacing for group chats when sender changes (applies to entire message block)
        isGroupChat &&
          !item.is_myself &&
          senderChanged &&
          styles.groupMessageWrapper,
      ]}
    >
      {/* Show story reply header */}
      {isStoryReply && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            const storyId = item.metadata?.story_id ?? item.metadata?.storyId;
            if (storyId) {
              navigation.navigate("MainScreens", {
                screen: "Home",
                params: { openStoryId: storyId },
              });
            } else {
              Toast.show({
                type: "info",
                text1: t("common.error"),
                text2: t("chatConversation.storyNotAvailable"),
              });
            }
          }}
        >
          <View
            style={[
              styles.storyReplyHeader,
              item.is_myself && styles.storyReplyHeaderRight,
            ]}
          >
            {item.is_myself ? (
              <>
                <Text
                  style={[
                    styles.storyReplyText,
                    styles.storyReplyTextRight,
                    { color: theme.subText },
                  ]}
                >
                  {t("chatConversation.storyReply.you", {
                    owner: storyOwnerName || t("chatConversation.anonymous"),
                  })}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={theme.subText}
                />
              </>
            ) : (
              <>
                <Ionicons name="arrow-back" size={14} color={theme.subText} />
                <Text
                  style={[styles.storyReplyText, { color: theme.subText }]}
                >
                  {t("chatConversation.storyReply.other", {
                    sender:
                      item.sender?.profile_name ||
                      item.sender?.username ||
                      t("chatConversation.anonymous"),
                  })}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      )}
      {/* Show sender name for group chats when sender changes */}
      {isGroupChat && !item.is_myself && senderChanged && (
        <Text style={[styles.senderName, { color: theme.subText }]}>
          {item.sender?.profile_name ||
            item.sender?.username ||
            t("chatConversation.anonymous")}
        </Text>
      )}
      <View
        style={[
          styles.messageContainer,
          item.is_myself
            ? styles.myMessageContainer
            : styles.theirMessageContainer,
        ]}
      >
        {!item.is_myself && isLastInGroup && (
          <FastImage
            source={{
              uri:
                item.sender?.avatar_url ||
                "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg",
            }}
            style={styles.messageAvatar}
          />
        )}
        <View
          style={{
            position: "relative",
            maxWidth: "75%",
            flexShrink: 1,
            alignSelf: item.is_myself ? "flex-end" : "flex-start",
            // The reaction badge hangs off the bottom corner of the bubble
            // (see reactionAddBadge/reactionPillBadge) - without this the
            // next message's footer/timestamp sits right underneath it.
            marginBottom: 16,
          }}
        >
          <Pressable
            style={[
              styles.messageBubble,
              // maxWidth already lives on the wrapper above - a percentage
              // value here would resolve against this wrapper's own
              // auto-sized width instead of the row's, collapsing text to
              // ~1 char per line. Cancel it out.
              { maxWidth: undefined, flexShrink: 1 },
              isImageMessage || isVideoMessage
                ? styles.imageMessageBubble
                : isFileMessage
                  ? [
                      styles.fileMessageBubble,
                      item.is_myself
                        ? [styles.myMessageBubble, { backgroundColor: isDarkMode ? "#064e3b" : "#E8F5E9" }]
                        : [styles.theirMessageBubble, { backgroundColor: isDarkMode ? "#1f2937" : "#F5F5F5" }],
                    ]
                  : item.type === "chat" || item.type === "part"
                  ? [
                      item.is_myself
                        ? styles.myMessageBubble
                        : styles.theirMessageBubble,
                      styles.chatMessageBubble,
                      {
                        borderColor: isDarkMode
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.08)",
                      },
                    ]
                  : item.is_myself
                    ? [
                        styles.myMessageBubble,
                        { backgroundColor: isDarkMode ? "#064e3b" : "#E8F5E9" },
                      ]
                    : [
                        styles.theirMessageBubble,
                        { backgroundColor: isDarkMode ? "#1f2937" : "#F5F5F5" },
                      ],
              !item.is_myself && !isLastInGroup && { marginLeft: 40 },
            ]}
            onLongPress={(evt) => handlersRef.current.openReactionPicker(item, evt)}
            delayLongPress={350}
            onPress={
              item.is_recalled ? undefined : () => {
                const now = Date.now();
                const lastTap = handlersRef.current.lastTapRef.current[item.id] || 0;
                if (now - lastTap < 300) {
                  handlersRef.current.handleDoubleTapMessage(item);
                } else {
                  handlersRef.current.lastTapRef.current[item.id] = now;
                  if (isImageMessage && resolvedFileUrl) {
                    handlersRef.current.openImageViewer(resolvedFileUrl);
                  } else if (isVideoMessage && resolvedFileUrl) {
                    handlersRef.current.openVideoViewer(resolvedFileUrl);
                  } else if (isFileMessage && resolvedFileUrl) {
                    handlersRef.current.handleOpenFile(item);
                  }
                }
              }
            }
          >
            {item.is_recalled ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.55 }}>
                <Ionicons name="arrow-undo-outline" size={14} color={item.is_myself ? "#fff" : (isDarkMode ? "#aaa" : "#555")} />
                <Text style={{ fontStyle: "italic", color: item.is_myself ? "#fff" : (isDarkMode ? "#aaa" : "#555"), fontSize: 14 }}>
                  {t("chatConversation.recalled", "Tin nhắn đã bị thu hồi")}
                </Text>
              </View>
            ) : null}
            {item.reply_to && !item.is_recalled && (
              <ReplyPreviewBubble
                item={item}
                currentUsername={username}
                onPress={() => handlersRef.current.handleJumpToRepliedMessage(item.reply_to.id)}
              />
            )}
            {!item.is_recalled &&
            (isImageMessage || isVideoMessage) &&
            Array.isArray(item.file_urls) &&
            item.file_urls.length > 1 ? (
              <MultiAttachmentGrid
                urls={item.file_urls}
                isVideo={isVideoMessage}
                onPressItem={(idx) => {
                  if (isImageMessage) {
                    handlersRef.current.openImageViewerGallery(
                      item.file_urls.map(resolveMediaUrl),
                      idx,
                    );
                  } else {
                    handlersRef.current.openVideoViewer(
                      resolveMediaUrl(item.file_urls[idx]),
                    );
                  }
                }}
              />
            ) : !item.is_recalled && isImageMessage && item.file_url ? (
              <>
                {mediaLoadError ? (
                  <View style={[styles.messageImage, styles.mediaErrorFallback]}>
                    <Ionicons name="image-outline" size={28} color="#fff" />
                    <Text style={styles.mediaErrorText} numberOfLines={2}>
                      {t("chatConversation.loadImageError", "Không tải được ảnh")}
                      {"\n"}
                      {mediaLoadError}
                    </Text>
                  </View>
                ) : (
                  <FastImage
                    source={{ uri: displayImageUrl }}
                    style={
                      imageAspectRatio
                        ? [styles.messageImage, { aspectRatio: imageAspectRatio, height: undefined }]
                        : styles.messageImage
                    }
                    resizeMode={"cover"}
                    onError={(e) => {
                      const reason = e?.nativeEvent?.error || "unknown error";
                      console.error("[ChatMedia] image FAILED to load", {
                        id: item.id,
                        raw_file_url: item.file_url,
                        resolved: displayImageUrl,
                        reason,
                      });
                      onImageError(item.id, reason);
                    }}
                  />
                )}
                {item.is_sending && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    {typeof item.upload_progress === "number" && (
                      <Text style={styles.uploadProgressText}>
                        {item.upload_progress}%
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : !item.is_recalled && isVideoMessage ? (
              <>
                {autoplayVideos && String(item.id) === String(activeInlineVideoId) ? (
                  (() => {
                    const thumbWidth = 200;
                    const thumbHeight = imageAspectRatio
                      ? Math.round(thumbWidth / imageAspectRatio)
                      : 200;
                    return (
                      <InlineVideoPlayer
                        uri={resolvedPreviewUrl || resolvedFileUrl}
                        width={thumbWidth}
                        height={thumbHeight}
                        borderRadius={12}
                        isActive={true}
                        interactive={false}
                      />
                    );
                  })()
                ) : (
                  resolvedThumbnailUrl ? (
                    <FastImage
                      source={{ uri: resolvedThumbnailUrl }}
                      style={
                        imageAspectRatio
                          ? [styles.messageImage, { aspectRatio: imageAspectRatio, height: undefined }]
                          : styles.messageImage
                      }
                      resizeMode={"cover"}
                      onError={undefined}
                    />
                  ) : (
                    <View style={[styles.messageImage, styles.videoPlaceholder]} />
                  )
                )}
                {!(autoplayVideos && String(item.id) === String(activeInlineVideoId)) && (
                  <View style={styles.videoPlayOverlay}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                )}
                {item.is_sending && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    {typeof item.upload_progress === "number" && (
                      <Text style={styles.uploadProgressText}>
                        {item.upload_progress}%
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : !item.is_recalled && isFileMessage ? (
              <View style={styles.fileMessageContent}>
                <View style={styles.fileIconWrapper}>
                  {isDownloadingThis ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color={theme.primary}
                    />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      styles.fileMessageName,
                      {
                        color: item.is_myself
                          ? isDarkMode
                            ? "#ecfdf5"
                            : "#000"
                          : theme.text,
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {item.content || item.file_name || t("chatConversation.attachment", "Tệp đính kèm")}
                  </Text>
                  <Text style={[styles.fileMessageSub, { color: theme.subText }]}>
                    {item.is_sending
                      ? typeof item.upload_progress === "number"
                        ? t("chatConversation.sendingPercent", "Đang gửi... {{percent}}%", {
                            percent: item.upload_progress,
                          })
                        : t("chatConversation.sending", "Đang gửi...")
                      : isDownloadingThis
                        ? t("chatConversation.downloading", "Đang tải...")
                        : t("chatConversation.tapToOpen", "Nhấn để mở")}
                  </Text>
                </View>
              </View>
            ) : !item.is_recalled ? (
              <MentionText
                style={[
                  styles.messageText,
                  {
                    color: item.is_myself
                      ? isDarkMode
                        ? "#ecfdf5"
                        : "#000"
                      : theme.text,
                  },
                ]}
                mentions={item.mentions}
                // 1-1 conversations only ever have the two participants -
                // @all has no meaning there, so it must render as plain
                // text instead of a highlighted/tappable mention.
                allowBroadcastMention={isGroupChat}
                onMentionPress={(username) =>
                  navigation.navigate("ProfileScreen", { username })
                }
              >
                {item.content}
              </MentionText>
            ) : null}
          </Pressable>
          <ReactionBadge item={item} theme={theme} isDarkMode={isDarkMode} handlersRef={handlersRef} />
        </View>
      </View>
      {isLastInGroup && (
        <View
          style={[
            styles.messageFooter,
            item.is_myself
              ? styles.myMessageFooter
              : styles.theirMessageFooter,
            !item.is_myself && { marginLeft: 40 },
          ]}
        >
          <Text style={[styles.messageTime, { color: theme.subText }]}>
            {formatMessageTime(item.created_at, t)}
            {item.is_edited && !item.is_recalled ? (
              <Text style={{ fontSize: 11, fontStyle: "italic", color: theme.subText }}>
                {" "}{t("chatConversation.edited", "(Đã sửa)")}
              </Text>
            ) : null}
          </Text>
          {!isGroupChat && item.is_myself && (
            <View style={styles.readStatus}>
              {item.read_at ? (
                <View style={styles.doubleCheck}>
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.primary}
                    style={styles.checkOverlap}
                  />
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.primary}
                  />
                </View>
              ) : (
                <Ionicons name="checkmark" size={12} color={theme.subText} />
              )}
            </View>
          )}
          {isGroupChat && seenAvatars?.length > 0 && (
            <TouchableOpacity
              style={styles.seenByRow}
              onPress={() => handlersRef.current.showSeenBy?.(seenAvatars)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {seenAvatars.slice(0, 3).map((p, i) => (
                <Image
                  key={p.id}
                  source={{ uri: p.avatar_url }}
                  style={[
                    styles.seenAvatar,
                    { borderColor: theme.background, marginLeft: i === 0 ? 0 : -6 },
                  ]}
                />
              ))}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
    </SwipeableMessage>
  );
}, (prev, next) => {
  // Custom comparator: `mediaLoadError`/`isDownloadingThis` are already
  // narrowed to this row's own value by the caller, so a plain shallow prop
  // comparison (React.memo's default) is exactly what we want - no custom
  // logic needed beyond letting unspecified props fall through to reference
  // equality. This comparator exists only to document that intent;
  // functionally it mirrors the default shallow comparison.
  return (
    prev.item === next.item &&
    prev.prevMessage === next.prevMessage &&
    prev.nextMessage === next.nextMessage &&
    prev.isGroupChat === next.isGroupChat &&
    prev.theme === next.theme &&
    prev.isDarkMode === next.isDarkMode &&
    prev.t === next.t &&
    prev.username === next.username &&
    prev.navigation === next.navigation &&
    prev.mediaLoadError === next.mediaLoadError &&
    prev.isDownloadingThis === next.isDownloadingThis &&
    prev.activeInlineVideoId === next.activeInlineVideoId &&
    prev.autoplayVideos === next.autoplayVideos &&
    prev.handlersRef === next.handlersRef &&
    prev.onImageError === next.onImageError &&
    prev.seenAvatars === next.seenAvatars
  );
});

const ConversationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const BUTTON_SIZE = 47;
  // Back/3-dot buttons are 3px smaller than the center profile pill's height.
  const ICON_BUTTON_SIZE = BUTTON_SIZE - 3;
  const HEADER_HEIGHT = BUTTON_SIZE + 14 + insets.top;
  const CENTER_MAX_WIDTH = Dimensions.get("window").width - ICON_BUTTON_SIZE * 2 - 32;
  // Reserve space for avatar + small gap inside the pill so text never pushes avatar out
  const AVATAR_WRAPPER_SIZE = 40;
  const CENTER_TEXT_MAX = Math.max(80, CENTER_MAX_WIDTH - (AVATAR_WRAPPER_SIZE + 12));
  const isAndroid = Platform.OS === "android";
  const [message, setMessage] = useState("");
  const latestMessageRef = React.useRef("");
  const [messages, setMessages] = useState([]);
  // Reacting to a message that's still using its optimistic temp id (send
  // API hasn't resolved yet) sent the reaction to the server keyed to an id
  // it doesn't recognize, so it silently failed/dropped until the next full
  // fetch. Queue reactions made against an in-flight message here, keyed by
  // its temp id, and flush them once the real server id is known.
  const pendingReactionsRef = React.useRef({});
  // A background message refetch (triggered by the socket's onMessageSent/
  // onMessageRead/onMessageDeleted events - which fire right around when you
  // send a message, since that's exactly what makes the other participant's
  // client emit a read receipt back) can land moments after a reaction is
  // applied locally, before the server's read replica has caught up with
  // that reaction. It then unconditionally overwrites the whole `messages`
  // array with server data, wiping the reaction back out until the next
  // full fetch. Remember locally-applied reactions for a short window so
  // any background refetch during that window keeps them instead.
  const recentlyReactedRef = React.useRef({});
  const RECENT_REACTION_WINDOW_MS = 8000;

  // Re-applies any locally-set reactions that are still "fresh" onto a
  // freshly-fetched message list, so a background refetch can't silently
  // clobber a reaction the server hasn't caught up with yet.
  const preserveRecentReactions = React.useCallback((list) => {
    const now = Date.now();
    const recent = recentlyReactedRef.current;
    for (const id of Object.keys(recent)) {
      if (now - recent[id].ts > RECENT_REACTION_WINDOW_MS) delete recent[id];
    }
    if (Object.keys(recent).length === 0) return list;
    return list.map((m) => {
      const entry = m.type === "message" ? recent[m.id] : null;
      return entry ? { ...m, reactions: entry.reactions } : m;
    });
  }, []);

  const activeConversationId = React.useRef(null);
  const fetchMessageMentionSuggestions = React.useCallback(async (q) => {
    const cid = activeConversationId.current;
    if (cid) {
      try {
        return await getConversationMentionSuggestions(cid, q);
      } catch (e) {
        if (e?.response?.status === 404) {
          return getMentionSuggestions(q);
        }
        throw e;
      }
    }
    return getMentionSuggestions(q);
  }, []);

  const { mentionProps: messageMentionProps, suggestions: messageSuggestions, onSelectMention: onSelectMessageMention, loading: messageSuggestionsLoading } = useMentionInput({
    value: message,
    // Tapping a mention suggestion updates `message` through here, not
    // through CommentBar's onChangeText below - without also updating
    // latestMessageRef here, handleSendMessage's `latestMessageRef.current
    // || message` would keep using the stale pre-mention-insert text (e.g.
    // "@tunna" instead of "@tunnaduong ") since the ref wins when truthy.
    onChange: (text) => {
      latestMessageRef.current = text;
      setMessage(text);
    },
    fetchSuggestions: fetchMessageMentionSuggestions,
  });

  const [chatKeyboardHeight, setChatKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setChatKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setChatKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    dayjs.locale(i18n.language || "vi");
  }, [i18n.language]);

  const safeGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("MainScreens", { screen: "Chat" });
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        safeGoBack();
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }, [navigation]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Caps how many of the loaded `messages` actually get rendered/mounted at
  // once. "Load more" pagination keeps prepending older pages to `messages`
  // as the user scrolls back through history, but every one of those rows
  // stayed mounted forever in the plain (non-virtualized) ScrollView below -
  // for a conversation with a lot of scroll-back, that's hundreds of message
  // bubbles (some with images/videos) all live at once. RENDER_WINDOW_CHUNK
  // is comfortably above a typical page size so ordinary conversations never
  // even reach the cap; it only kicks in once someone's scrolled back far
  // enough that keeping everything mounted would actually hurt.
  const RENDER_WINDOW_CHUNK = 80;
  // Scrolling near the top keeps growing the window by RENDER_WINDOW_CHUNK
  // with no ceiling, so a long enough scroll-back session would eventually
  // reach "render everything anyway" and quietly bring back the exact
  // mounted-bubble-count problem this cap exists to avoid. Past this many,
  // further scroll-up still fetches more history (see handleMessagesScroll)
  // but stops mounting it - a deliberate, rare tradeoff over letting a
  // single very-long session snowball back into the original perf problem.
  const MAX_RENDER_LIMIT = 400;
  const [renderLimit, setRenderLimit] = useState(RENDER_WINDOW_CHUNK);
  // Companion to renderLimit, but for the *other* end: renderLimit caps how
  // far back (toward the oldest) mounted content reaches; this caps how far
  // forward (toward the newest) it reaches once the user has scrolled well
  // away from the bottom. Count of newest messages currently left unmounted
  // - 0 means "render all the way to the newest" (the common case: reading
  // recent messages, or nobody's scrolled away from the bottom yet).
  // handleMessagesScroll keeps this in sync with scroll position: scroll up
  // into history and whatever's now off-screen below unmounts: scroll back
  // down and it remounts, exactly mirroring what renderLimit already does
  // at the other end - and safely, since unmounting content that's already
  // below the viewport never shifts what's currently on screen (unlike
  // trimming from above, which would need scroll-offset compensation this
  // doesn't attempt).
  const [renderEndOffset, setRenderEndOffset] = useState(0);
  // Only messages within [start, end) actually get mounted; everything
  // outside that window stays in `messages` state (so pagination/scroll
  // math is unaffected) but isn't rendered until scrolling brings it back
  // into range (see handleMessagesScroll) or a reply-jump explicitly needs
  // it (see handleJumpToRepliedMessage).
  const visibleMessages = useMemo(() => {
    const start = messages.length > renderLimit ? messages.length - renderLimit : 0;
    const end = renderEndOffset > 0
      ? Math.max(start + 1, messages.length - renderEndOffset)
      : messages.length;
    return messages.slice(start, end);
  }, [messages, renderLimit, renderEndOffset]);
  const inputRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const lastTapRef = useRef({});
  const initialScrollDoneRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const {
    conversation,
    conversationId,
    selectedUser,
    isNewConversation,
    highlightMessageId,
  } = route.params;
  const messageLayoutOffsetsRef = useRef({});
  const activeInlineVideoIdRef = useRef(null);
  const [activeInlineVideoId, setActiveInlineVideoId] = useState(null);
  const scrollOffsetRef = useRef(0);
  const isFocused = useIsFocused();
  const pendingHighlightMessageIdRef = useRef(highlightMessageId ?? null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [sending, setSending] = useState(false);
  const { username, profileName } = useContext(AuthContext);
  // The socket effect below (tryAppendPushedMessage) doesn't list `username`
  // in its dependency array - by design, so it doesn't resubscribe socket
  // listeners on every render. But that means it was capturing whatever
  // `username` happened to be at mount time and never updating it. If
  // AuthContext hadn't finished hydrating yet the moment the conversation
  // opened, `username` was still empty/stale for that closure, so the
  // is_myself fallback comparison (raw.sender.username === username) came
  // out wrong for messages pushed via socket right after opening the chat -
  // they'd render on "my" side until the REST refetch a moment later
  // overwrote them with the backend's correct is_myself. Keep a ref that's
  // always current instead, so the socket handler reads the live username.
  const usernameRef = useRef(username);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);
  const { theme, isDarkMode, autoplayVideos } = useTheme();
  const [currentConversation, setCurrentConversation] = useState(conversation);
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  // Keep the ref used by useMentionInput in sync with the resolved conversation id
  React.useEffect(() => {
    activeConversationId.current = currentConversationId || conversationId;
  }, [currentConversationId, conversationId]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [backgroundModalVisible, setBackgroundModalVisible] = useState(false);
  // Chat background (Messenger-style): defaults to the conversation's stored
  // background_url, but a live "background_changed" system message overrides
  // it immediately without waiting for a conversations-list refetch.
  const [backgroundOverride, setBackgroundOverride] = useState(undefined);
  const { t } = useTranslation();
  const {
    onMessageSent,
    onMessageRead,
    onMessageDeleted,
    onMessageReacted,
    onMessageRecalled,
    onMessageEdited,
    onTyping,
    sendTyping,
  } = useChatSocket();
  // { id, content } | null — message currently being edited
  const [editingMessage, setEditingMessage] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const typingTimeoutRef = useRef(null);
  const [imageViewer, setImageViewer] = useState({ visible: false, uris: [], index: 0 });
  const [videoViewer, setVideoViewer] = useState({ visible: false, uri: null });
  const [reactionPicker, setReactionPicker] = useState({
    visible: false,
    message: null,
    anchor: null,
  });
  const [reactionModal, setReactionModal] = useState({
    visible: false,
    reactions: null,
  });
  // { id, content, type, file_url, sender } | null - the message currently
  // being replied to, shown in ReplyComposerBar above the input.
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardModal, setForwardModal] = useState({ visible: false, message: null });
  // DEBUG: id -> error string, for surfacing why an image/video thumbnail
  // failed to load directly in the bubble instead of just going blank.
  const [mediaLoadErrors, setMediaLoadErrors] = useState({});
  const [downloadingFileId, setDownloadingFileId] = useState(null);

  // Keep the header visually light until the user scrolls enough.
  // This mirrors the other screens: the back button stays visible, while the
  // profile/title area fades in only after scrolling.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollContentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const centerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Logic to identify the other user in private chat
  const otherUser = isNewConversation
    ? selectedUser
    : currentConversation?.type === "private"
      ? currentConversation?.participants?.[0]
      : null;

  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const otherUsername = otherUser?.username;

  const refreshOtherUserOnlineStatus = React.useCallback(() => {
    if (!otherUsername) return;
    getOnlineStatus(otherUsername)
      .then((res) => setIsOtherUserOnline(!!res.data?.is_online))
      .catch(() => {});
  }, [otherUsername]);

  useEffect(() => {
    refreshOtherUserOnlineStatus();
  }, [refreshOtherUserOnlineStatus]);

  const confirmBlock = () => {
    if (!otherUser) return;
    Alert.alert(
      t("chatConversation.blockTitle"),
      t("chatConversation.blockBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatConversation.blockAction"),
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(otherUser.id);
              Alert.alert(
                t("chatConversation.blockedTitle"),
                t("chatConversation.blockedBody"),
                [{ text: t("common.ok"), onPress: safeGoBack }],
              );
            } catch (e) {
              const errorMessage =
                e.response?.data?.message ||
                e.message ||
                t("chatConversation.blockError");
              Alert.alert(t("common.error"), errorMessage);
            }
          },
        },
      ],
    );
  };

  const handleReportSubmit = async (reason) => {
    // If we have an otherUser, report them directly.
    // If generic (Group), maybe report conversation?
    // Since Api expects reported_user_id, we need a user.
    // Assuming for now report functionality targets the other user in private chat.
    // For group, we might need a different flow or select a member.
    // I'll fallback to alerting if no user.
    if (!otherUser && !isNewConversation) {
      // Maybe report the group? But API needs reported_user_id (currently).
      // We'll report the conversation ID in 'reason' or separate field if extended (not asking to extend generic report).
      alert(t("chatConversation.groupReportUnavailable"));
      return;
    }

    const targetId = otherUser?.id || selectedUser?.id;
    if (!targetId) {
      Alert.alert(t("common.error"), t("chatConversation.reportTargetError"));
      throw new Error(t("chatConversation.reportTargetError"));
    }

    try {
      await reportUser({ reported_user_id: targetId, reason });
      Alert.alert(
        t("chatConversation.thanksTitle"),
        t("chatConversation.reportSent"),
      );
    } catch (e) {
      const errorMessage =
        e.response?.data?.message ||
        e.message ||
        t("chatConversation.reportError");
      Alert.alert(t("common.error"), errorMessage);
      throw e;
    }
  };

  const handleLeaveGroupFromMenu = (targetConversationId) => {
    Alert.alert(
      t("chatConversation.leaveGroupTitle", "Rời nhóm?"),
      t("chatConversation.leaveGroupBody", "Bạn sẽ không nhận được tin nhắn từ nhóm này nữa."),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chatConversation.leaveGroupAction", "Rời nhóm"),
          style: "destructive",
          onPress: async () => {
            try {
              await leaveGroupConversation(targetConversationId);
              safeGoBack();
            } catch (error) {
              Alert.alert(
                t("common.error"),
                error?.response?.data?.message || t("chatConversation.leaveGroupError", "Không thể rời nhóm.")
              );
            }
          },
        },
      ]
    );
  };

  const showOptions = () => {
    const options = [
      t("chatConversation.report"),
      t("chatConversation.changeBackground", "Đổi hình nền"),
      t("chatConversation.blockUser"),
      t("common.cancel"),
    ];
    const destructiveButtonIndex = 2;
    const cancelButtonIndex = 3;

    if (!otherUser) {
      // Group conversation (or the singleton public chat, which has no group management).
      const isPublicChat = isPublicGroupChat(currentConversation);
      const targetConversationId = currentConversationId || conversationId;

      if (isPublicChat) {
        Alert.alert(t("chatConversation.optionsTitle"), null, [
          {
            text: t("chatConversation.report"),
            onPress: () => setReportModalVisible(true),
          },
          { text: t("common.cancel"), style: "cancel" },
        ]);
        return;
      }

      Alert.alert(t("chatConversation.optionsTitle"), null, [
        {
          text: t("chatConversation.groupInfo", "Thông tin nhóm"),
          onPress: () => navigation.navigate("GroupInfoScreen", { conversationId: targetConversationId }),
        },
        {
          text: t("chatConversation.report"),
          onPress: () => setReportModalVisible(true),
        },
        {
          text: t("chatConversation.leaveGroupAction", "Rời nhóm"),
          style: "destructive",
          onPress: () => handleLeaveGroupFromMenu(targetConversationId),
        },
        { text: t("common.cancel"), style: "cancel" },
      ]);
      return;
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) setReportModalVisible(true);
          else if (buttonIndex === 1) setBackgroundModalVisible(true);
          else if (buttonIndex === 2) confirmBlock();
        },
      );
    } else {
      Alert.alert(t("chatConversation.optionsTitle"), null, [
        {
          text: t("chatConversation.report"),
          onPress: () => setReportModalVisible(true),
        },
        {
          text: t("chatConversation.changeBackground", "Đổi hình nền"),
          onPress: () => setBackgroundModalVisible(true),
        },
        {
          text: t("chatConversation.blockUser"),
          onPress: confirmBlock,
          style: "destructive",
        },
        { text: t("common.cancel"), style: "cancel" },
      ]);
    }
  };

  const getHeaderAvatar = () => {
    if (isNewConversation) {
      return selectedUser?.avatar_url;
    }
    if (currentConversation?.type === "private") {
      return currentConversation?.participants[0]?.avatar_url;
    }
    if (isPublicGroupChat(currentConversation) || currentConversation?.name === t("chatConversation.casualGroupName")) {
      return "local:chat.jpg";
    }
    if (currentConversation?.type === "group") {
      return currentConversation?.avatar_url || "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg";
    }
    return "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg";
  };

  // Callers like the notification screen only pass a conversationId (e.g. story
  // reply notifications), not the full conversation object, so otherUser can't be
  // derived. Fetch the conversation details in that case.
  useEffect(() => {
    if (!isNewConversation && !currentConversation && conversationId) {
      getConversations()
        .then((response) => {
          const found = response?.data?.find(
            (c) => String(c.id) === String(conversationId),
          );
          if (found) setCurrentConversation(found);
        })
        .catch((error) => {
          console.log(
            "[ConversationScreen] Error fetching conversation details:",
            error?.response?.data || error?.message,
          );
        });
    }
  }, []);

  // Group metadata (name/avatar/participants) can change from GroupInfoScreen
  // while this screen is still on the stack underneath it — refetch it on
  // refocus so e.g. a just-changed group avatar shows up in the header as
  // soon as you come back, instead of staying stale until a full remount.
  useFocusEffect(
    React.useCallback(() => {
      const activeId = currentConversationId || conversationId;
      if (isNewConversation || !activeId || currentConversation?.type !== "group") {
        return;
      }

      getConversations()
        .then((response) => {
          const found = response?.data?.find((c) => String(c.id) === String(activeId));
          if (found) setCurrentConversation(found);
        })
        .catch((error) => {
          console.log(
            "[ConversationScreen] Error refreshing group conversation on focus:",
            error?.response?.data || error?.message,
          );
        });
      // Deliberately runs once per focus, not on every currentConversation change
      // (which this itself would cause) — id/type are enough to key off.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentConversationId, conversationId, isNewConversation, currentConversation?.type])
  );

  // "Seen by" read receipts (group chats only, matching the web client).
  // Refetches on: opening the conversation, whenever the message count
  // changes (covers new messages arriving and the .message.read-triggered
  // refresh that follows someone else opening the chat), and a light poll
  // as a fallback for reads that happen without any message-list change.
  const [seenParticipants, setSeenParticipants] = useState([]);
  const [seenByModalParticipants, setSeenByModalParticipants] = useState(null);
  const isGroupConversation = currentConversation?.type === "group";
  useEffect(() => {
    const activeId = currentConversationId || conversationId;
    if (isNewConversation || !activeId || !isGroupConversation) {
      setSeenParticipants([]);
      return undefined;
    }

    let cancelled = false;
    const fetchSeen = () => {
      getGroupSeenReceipts(activeId)
        .then((res) => {
          if (!cancelled) setSeenParticipants(res.data?.participants || []);
        })
        .catch(() => {});
    };

    fetchSeen();
    const interval = setInterval(fetchSeen, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentConversationId, conversationId, isNewConversation, isGroupConversation, messages.length]);

  useEffect(() => {
    setBackgroundOverride(undefined);
  }, [currentConversationId, conversationId]);
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (
        m.content_type === "system" &&
        (m.metadata?.event === "background_changed" || m.metadata?.event === "background_reset")
      ) {
        setBackgroundOverride(m.metadata.background_url || null);
        break;
      }
    }
  }, [messages]);
  const chatBackgroundUrl =
    backgroundOverride !== undefined ? backgroundOverride : currentConversation?.background_url || null;

  // The "seen by" list is always empty while the user's own read receipts are
  // off (backend silently skips marking messages read / returns no seen
  // participants in that case) — track the setting so opening the seen-by
  // modal can explain why, instead of just showing an empty list.
  const [readReceiptsOff, setReadReceiptsOff] = useState(false);
  useEffect(() => {
    getNotificationSettings()
      .then((res) => {
        const settings = res.data || res;
        setReadReceiptsOff(settings?.chat_read_receipts === false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNewConversation) {
      loadInitialMessages();
      const idToMark = currentConversationId || conversationId;
      if (idToMark) {
        markConversationAsRead(idToMark).catch((error) => {
          console.log(
            "[ConversationScreen] Error marking conversation as read:",
            error?.response?.data || error?.message,
          );
        });
      }
    }
  }, []);

  const getCacheKey = (id) => `${CONVERSATION_CACHE_KEY}_${username}_${id}`;
  const getTimestampKey = (id) =>
    `${CONVERSATION_TIMESTAMP_KEY}_${username}_${id}`;

  const loadInitialMessages = async () => {
    // Try to load from cache first
    const cachedData = storage.getString(getCacheKey(conversationId));
    const cachedTimestamp = storage.getNumber(getTimestampKey(conversationId));

    if (cachedData && cachedTimestamp) {
      const now = Date.now();
      if (now - cachedTimestamp < CACHE_EXPIRY) {
        // Cache is still valid
        const parsedData = JSON.parse(cachedData);
        const transformed = injectTimeHeaders(parsedData, t);
        setMessages(preserveRecentReactions(transformed));
        setPage(2); // Set page to 2 since we loaded the first page from cache

        // Fetch fresh data in background
        fetchMessages(true, true);
        return;
      }
    }

    // No valid cache, fetch from API
    fetchMessages(true);
  };

  const fetchMessages = async (isRefresh = false, isBackground = false) => {
    try {
      if (isRefresh && !isBackground) {
        setPage(1);
        setHasMore(true);
        setRenderLimit(RENDER_WINDOW_CHUNK);
      }

      if (!hasMore && !isRefresh) return;

      const response = await getConversationMessages(
        currentConversationId || conversationId,
        isRefresh ? 1 : page,
      );

      const newMessages = Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      let previousCache = null;
      if (isRefresh) {
        // Capture the previous cache BEFORE overwriting it, so the background-refresh
        // "did anything change" check below isn't comparing fresh data against itself.
        const cacheId = currentConversationId || conversationId;
        previousCache = storage.getString(getCacheKey(cacheId));
        storage.set(getCacheKey(cacheId), JSON.stringify(newMessages));
        storage.set(getTimestampKey(cacheId), Date.now());
      }

      const transformed = injectTimeHeaders(newMessages, t);

      if (!isBackground) {
        setMessages((prev) => {
          if (isRefresh || prev.length === 0) {
            return preserveRecentReactions(transformed);
          }

          const existingMessages = prev.filter(
            (item) => item.type === "message",
          );
          return injectTimeHeaders([...newMessages, ...existingMessages], t);
        });
        setHasMore(response.data.current_page < response.data.last_page);
        setPage((prev) => (isRefresh ? 2 : prev + 1));
      } else if (JSON.stringify(newMessages) !== previousCache) {
        // Update UI only if new data is different from what was cached before this refresh.
        // This background refresh always fetches page 1 (the newest tail of
        // the conversation) - wholesale replacing `messages` with just that
        // would silently discard any older pages the user had scrolled up
        // to load via pagination. Keep everything already loaded that's
        // older than this fresh page-1 batch, and only replace the tail.
        setMessages((prev) => {
          const freshIds = new Set(newMessages.map((m) => m.id));
          const oldestFreshTime = newMessages.length > 0
            ? new Date(newMessages[0].created_at).getTime()
            : null;
          const preservedOlder = prev.filter((item) => {
            if (item.type !== "message") return false;
            if (freshIds.has(item.id)) return false;
            return !oldestFreshTime || new Date(item.created_at).getTime() < oldestFreshTime;
          });
          const merged = injectTimeHeaders([...preservedOlder, ...newMessages], t);
          return preserveRecentReactions(merged);
        });
        // Don't touch page/hasMore here - this is a freshness sync for the
        // newest page only, not a pagination action.
      }
    } catch (error) {
      console.log("Error fetching messages:", error.response?.data);
    } finally {
      if (!isBackground) {
        setRefreshing(false);
      }
      if (!isBackground && !isRefresh) {
        loadingMoreRef.current = false;
      }
    }
  };

  // Keep the latest fetchMessages closure available to the realtime listeners below
  // without re-subscribing to the socket on every render.
  const fetchMessagesRef = useRef(fetchMessages);
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }); // intentionally omits dep array – always keeps the latest closure without re-subscribing sockets

  // Realtime: refresh messages the instant the backend pushes a chat event for this
  // conversation, replacing the old 5s poll.
  useEffect(() => {
    const activeId = currentConversationId || conversationId;
    if (isNewConversation || !activeId) return undefined;

    const refresh = () => fetchMessagesRef.current(true, true);

    // Optimistically append the just-pushed message straight from the socket
    // payload, instead of waiting on the REST refetch below - that fetch is a
    // full network round trip, which is the actual source of the "delay
    // before a new message shows up while the conversation is open" this is
    // fixing. This is deliberately defensive about the payload shape (which
    // isn't otherwise consumed directly anywhere in this codebase, so it's
    // unverified) - if it doesn't look like a usable message object, this is
    // a no-op and the screen falls back to waiting on the REST refresh
    // below exactly like before, so a wrong assumption here can't corrupt
    // the message list. If it DOES succeed, the REST refresh moments later
    // still runs and replaces this optimistic entry with the authoritative
    // copy, self-correcting anything this got slightly wrong.
    const tryAppendPushedMessage = (e) => {
      const raw = e?.message && typeof e.message === "object" ? e.message : e;
      if (!raw || typeof raw !== "object" || raw.id == null || !raw.sender) {
        return false;
      }

      setMessages((prev) => {
        if (prev.some((m) => m.type === "message" && String(m.id) === String(raw.id))) {
          return prev; // already have it somehow (e.g. our own optimistic send echoed back)
        }
        // Deliberately ignore raw.is_myself here - it comes from the socket
        // broadcast, which the backend appears to compute once from the
        // sender's own perspective and relay verbatim to every participant.
        // Trusting it made a message the OTHER person just sent flash on
        // "my" side of the chat for a moment until the REST refetch below
        // landed and overwrote it with the correct value. Always deriving it
        // locally from the live username ref avoids that flash entirely.
        const withMyself = {
          ...raw,
          is_myself: String(raw.sender?.username) === String(usernameRef.current),
        };
        const existingMessages = prev.filter((item) => item.type === "message");
        return injectTimeHeaders([...existingMessages, withMyself], t);
      });
      return true;
    };

    const refreshAndScroll = (e) => {
      // A real message arrived, so any "typing..." bubble for this conversation is stale.
      clearTimeout(typingTimeoutRef.current);
      setTypingUser(null);

      const distanceFromBottom =
        (scrollContentHeightRef.current || 0) -
        (scrollViewHeightRef.current || 0) -
        (scrollOffsetRef.current || 0);
      const isNearBottom = distanceFromBottom <= 150;

      if (tryAppendPushedMessage(e)) {
        if (isNearBottom) scrollToLatestMessageAnimated();
      }

      // Wait for the fetch (and the setMessages it triggers) to actually complete
      // before scrolling - otherwise this scrolls to the end of the *old* list,
      // before the new message has been added to state. Also the source of
      // truth that reconciles the optimistic append above, if any.
      fetchMessagesRef.current(true, true).then(() => {
        if (isNearBottom) scrollToLatestMessageAnimated();
      });
      // The screen is already open, so this new message is immediately read too -
      // dispatch a read receipt so the sender's "seen" status keeps updating live.
      markConversationAsRead(activeId).catch((error) => {
        console.log(
          "[ConversationScreen] Error marking conversation as read:",
          error?.response?.data || error?.message,
        );
      });
      // Any incoming activity from the other user is a good moment to re-check their online dot.
      refreshOtherUserOnlineStatus();
    };
    const handleTyping = (data) => {
      setTypingUser({ name: data?.name });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUser(null);
      }, 4000);
    };
    const handleReacted = (data) => {
      if (!data?.message_id) return;
      applyReactionUpdate(data.message_id, data.reactions);
    };
    const handleRecalled = (data) => {
      if (!data?.message_id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id
            ? { ...m, is_recalled: true, content: null, file_url: null, metadata: null }
            : m
        )
      );
    };
    const handleEdited = (data) => {
      if (!data?.message_id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id
            ? { ...m, content: data.content, is_edited: true }
            : m
        )
      );
    };

    const unsubscribeSent = onMessageSent(activeId, refreshAndScroll);
    const unsubscribeRead = onMessageRead(activeId, refresh);
    const unsubscribeDeleted = onMessageDeleted(activeId, refresh);
    const unsubscribeTyping = onTyping(activeId, handleTyping);
    const unsubscribeReacted = onMessageReacted(activeId, handleReacted);
    const unsubscribeRecalled = onMessageRecalled(activeId, handleRecalled);
    const unsubscribeEdited = onMessageEdited ? onMessageEdited(activeId, handleEdited) : () => {};

    return () => {
      unsubscribeSent();
      unsubscribeRead();
      unsubscribeDeleted();
      unsubscribeTyping();
      unsubscribeReacted();
      unsubscribeRecalled();
      unsubscribeEdited();
      clearTimeout(typingTimeoutRef.current);
      // NOTE: Do NOT call setTypingUser(null) here.
      // Calling setState inside a useEffect cleanup causes React to schedule
      // another render → cleanup → setState → infinite "Maximum update depth"
      // loop that also blocks the hardware back button.
    };
  }, [
    isNewConversation,
    currentConversationId,
    conversationId,
    onMessageSent,
    onMessageRead,
    onMessageDeleted,
    onMessageReacted,
    onMessageRecalled,
    onMessageEdited,
    onTyping,
    refreshOtherUserOnlineStatus,
  ]);

  // Reconnecting the socket (see ChatSocketContext's AppState listener) only
  // fixes FUTURE events - sockets don't replay whatever was sent while the
  // app was backgrounded and fully disconnected, so a message sent during
  // that window would still just sit missing until the screen was remounted.
  // Catch up explicitly whenever the app comes back to the foreground while
  // this conversation is open.
  useEffect(() => {
    const activeId = currentConversationId || conversationId;
    if (isNewConversation || !activeId) return undefined;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        fetchMessagesRef.current(true, true);
      }
    });
    return () => subscription.remove();
  }, [isNewConversation, currentConversationId, conversationId]);

  const scrollToLatestMessage = () => {
    requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollToEnd({ animated: false });
    });
  };

  const scrollToLatestMessageAnimated = () => {
    requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  // Scrolls to and briefly highlights a message already present in the
  // currently loaded list, if it's laid out yet. Returns false (without
  // side effects) if it isn't loaded/laid out, so callers can fall back to
  // fetching more messages first (see handleJumpToRepliedMessage).
  const scrollToMessageAndHighlight = (targetId) => {
    if (targetId == null) return false;
    const layout = messageLayoutOffsetsRef.current[targetId];
    if (!layout || typeof layout.y !== "number") return false;
    requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollTo({
        y: Math.max(layout.y - 120, 0),
        animated: true,
      });
    });
    setHighlightedMessageId(targetId);
    setTimeout(() => {
      setHighlightedMessageId(null);
      // handleJumpToRepliedMessage may have blown renderLimit open
      // (messages.length or Infinity) to guarantee the jump target was
      // mounted - once the highlight itself fades there's no reason to keep
      // rendering everything for the rest of the session, so drop back to
      // the normal windowed cap. Harmless no-op if it was never widened.
      setRenderLimit((prev) => Math.min(prev, RENDER_WINDOW_CHUNK));
    }, 2500);
    return true;
  };

  const attemptScrollToHighlight = () => {
    const targetId = pendingHighlightMessageIdRef.current;
    if (targetId == null) return false;
    const didScroll = scrollToMessageAndHighlight(targetId);
    if (didScroll) pendingHighlightMessageIdRef.current = null;
    return didScroll;
  };
  // attemptScrollToHighlight is redefined every render (plain closure, not
  // useCallback). It gets passed down into MessagesListContent below, and if
  // passed directly it would be a new prop identity on every keystroke,
  // defeating that component's React.memo. Keep a ref to the latest version
  // instead (same pattern as fetchMessagesRef above) so the prop we hand to
  // MessagesListContent stays referentially stable.
  const attemptScrollToHighlightRef = useRef(attemptScrollToHighlight);
  useEffect(() => {
    attemptScrollToHighlightRef.current = attemptScrollToHighlight;
  });

  // Tapping a ReplyPreviewBubble jumps to the original message. If it's not
  // in the currently loaded page (an older message), keep loading older
  // pages until it turns up or we run out.
  const handleJumpToRepliedMessage = async (replyToId) => {
    if (replyToId == null) return;
    if (scrollToMessageAndHighlight(replyToId)) return;

    // The target might already be loaded in `messages` but simply outside
    // the current render window (see renderLimit/visibleMessages) - expand
    // to cover everything already fetched before falling back to actually
    // fetching more from the server below.
    if (messages.some((m) => String(m.id) === String(replyToId))) {
      setRenderLimit(messages.length);
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (scrollToMessageAndHighlight(replyToId)) return;
    }

    // About to fetch more pages looking for the target - each fetch's fresh
    // message count isn't visible in this closure (state updates are async
    // and this function's `messages` snapshot is already stale by the next
    // line), so there's no reliable count to grow renderLimit to match.
    // Just render everything for the rest of this jump; it's a rare,
    // deliberate action, not the common scrolling path renderLimit exists
    // for.
    setRenderLimit(Infinity);

    const MAX_ATTEMPTS = 8;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (!hasMore) break;
      await fetchMessages(false);
      // Let onLayout populate messageLayoutOffsetsRef for the newly
      // prepended messages before checking again.
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (scrollToMessageAndHighlight(replyToId)) return;
    }

    Toast.show({
      type: "error",
      text1: t("chatConversation.repliedMessageNotFound", "Không tìm thấy tin nhắn gốc"),
    });
  };

  const handleMessagesContentSizeChange = () => {
    if (!initialScrollDoneRef.current && messages.length > 0) {
      initialScrollDoneRef.current = true;
      if (!attemptScrollToHighlight()) {
        scrollToLatestMessage();
      }
      return;
    }
    if (pendingHighlightMessageIdRef.current != null) {
      attemptScrollToHighlight();
    }
  };

  useEffect(() => {
    if (!autoplayVideos || !isFocused) return;
    if (activeInlineVideoIdRef.current) return;
    // Initialize active inline video when the screen first appears or messages change.
    const centerY = scrollOffsetRef.current + (scrollViewHeightRef.current || 0) / 2;
    let found = null;
    const entries = Object.entries(messageLayoutOffsetsRef.current || {});
    for (let i = 0; i < entries.length; i++) {
      const [key, layout] = entries[i];
      if (!layout || typeof layout.y !== "number") continue;
      const top = layout.y;
      const h = layout.height || 0;
      if (centerY >= top && centerY <= top + h) {
        const msg = messages.find((m) => String(m.id) === String(key));
        if (msg && (msg.type === "video" || msg.content_type === "video")) {
          found = key;
        }
        break;
      }
    }
    if (found && found !== activeInlineVideoIdRef.current) {
      activeInlineVideoIdRef.current = found;
      setActiveInlineVideoId(found);
    }
  }, [messages, autoplayVideos, isFocused]);

  const handleMessagesScroll = ({ nativeEvent }) => {
    const offsetY = nativeEvent.contentOffset.y;
    scrollY.setValue(offsetY);
    const isNearTop = offsetY <= 40;
    if (isNearTop && hasMore && !refreshing && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      fetchMessages(false);
    }
    // Reveal more of what's already loaded as the user scrolls back into
    // history, independent of whether there's anything left to fetch from
    // the server - this is a separate, purely local render cap (see
    // renderLimit above), not the "load more" pagination trigger above it.
    if (isNearTop) {
      setRenderLimit((prev) =>
        messages.length > prev && prev < MAX_RENDER_LIMIT
          ? Math.min(prev + RENDER_WINDOW_CHUNK, MAX_RENDER_LIMIT)
          : prev
      );
    }
    const distanceFromBottom = scrollContentHeightRef.current - scrollViewHeightRef.current - offsetY;
    const shouldShow = distanceFromBottom > 150;
    setShowScrollButton((prev) => (prev === shouldShow ? prev : shouldShow));

    // Bottom half of the render window (see renderEndOffset above): once
    // scrolled more than a few screens away from the newest message, unmount
    // whatever's that far below the current view - it's off-screen either
    // way, so dropping it doesn't shift anything currently visible. Coming
    // back within reach (including landing exactly at the bottom, where
    // this evaluates to 0) remounts it. Within the keep-zone - "reading in
    // the middle" - nothing here changes.
    const BOTTOM_KEEP_PX = (scrollViewHeightRef.current || 800) * 3;
    if (distanceFromBottom <= BOTTOM_KEEP_PX) {
      setRenderEndOffset((prev) => (prev === 0 ? prev : 0));
    } else {
      const renderedCount = visibleMessages.length || 1;
      const avgHeight = (scrollContentHeightRef.current || 1) / renderedCount;
      const hiddenCount = Math.max(0, Math.floor((distanceFromBottom - BOTTOM_KEEP_PX) / avgHeight));
      setRenderEndOffset((prev) => (prev === hiddenCount ? prev : hiddenCount));
    }

    scrollOffsetRef.current = offsetY;
    if (!autoplayVideos || !isFocused) {
      if (activeInlineVideoId) {
        activeInlineVideoIdRef.current = null;
        setActiveInlineVideoId(null);
      }
      return;
    }

    const centerY = offsetY + (scrollViewHeightRef.current || 0) / 2;
    let found = null;
    const entries = Object.entries(messageLayoutOffsetsRef.current || {});
    for (let i = 0; i < entries.length; i++) {
      const [key, layout] = entries[i];
      if (!layout || typeof layout.y !== "number") continue;
      const top = layout.y;
      const h = layout.height || 0;
      if (centerY >= top && centerY <= top + h) {
        const id = key;
        const msg = messages.find((m) => String(m.id) === String(id));
        if (msg && (msg.type === "video" || msg.content_type === "video")) {
          found = id;
        }
        break;
      }
    }
    if (found !== activeInlineVideoIdRef.current) {
      activeInlineVideoIdRef.current = found;
      setActiveInlineVideoId(found);
    }
  };

  const launchMediaPicker = async (source) => {
    try {
      let result;
      if (source === "camera_photo" || source === "camera_video") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Toast.show({ type: "error", text1: t("common.error"), text2: t("chatConversation.cameraPermissionDenied") });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: source === "camera_video" ? ["videos"] : ["images"],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 10,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        let assets = result.assets;
        if (assets.length > 1) {
          // The backend only accepts a single media type per multi-attachment
          // send (all images or all videos) - take whatever the first picked
          // asset is and silently drop any assets of the other type instead
          // of erroring out the whole send.
          const firstType = assets[0].type;
          const filtered = assets.filter((asset) => asset.type === firstType);
          if (filtered.length !== assets.length) {
            Toast.show({
              type: "info",
              text1: t("chatConversation.mixedMediaTitle", "Chỉ gửi một loại tệp"),
              text2: t(
                "chatConversation.mixedMediaMessage",
                "Đã bỏ qua các tệp không cùng loại với lựa chọn đầu tiên.",
              ),
            });
          }
          assets = filtered;
        }

        // Android's system Photo Picker can hand back an asset for a
        // cloud-only item (e.g. backed up to Google Photos, not present on
        // the device) with no usable local uri, surfacing its own "Không tải
        // được một số ảnh" dialog first. If the user dismisses that and the
        // asset still comes through without a uri, catch it here instead of
        // silently trying (and failing/hanging on) an upload with garbage
        // data - tell the user plainly instead.
        const unusable = assets.filter((asset) => !asset.uri);
        if (unusable.length > 0) {
          assets = assets.filter((asset) => !!asset.uri);
          Toast.show({
            type: "error",
            text1: t("common.error"),
            text2: t(
              "chatConversation.cloudOnlyMediaError",
              "Một số tệp chỉ có trên Google Photos/iCloud và chưa tải về máy nên không thể gửi. Hãy tải tệp về máy trước rồi thử lại.",
            ),
          });
        }
        if (assets.length === 0) return;

        if (assets[0].type === "video") {
          await sendVideoMessage(assets.length > 1 ? assets : assets[0]);
        } else {
          await sendImageMessage(
            assets.length > 1 ? assets.map((asset) => asset.uri) : assets[0].uri,
          );
        }
      }
    } catch (error) {
      console.error("Error picking media:", error);
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("chatConversation.sendImageError"),
      });
    }
  };

  const pickImage = () => {
    const takePhoto = t("chatConversation.takePhoto", "Chụp ảnh");
    const recordVideo = t("chatConversation.recordVideo", "Quay video");
    const chooseLibrary = t("chatConversation.chooseFromLibrary", "Chọn từ thư viện");
    const cancel = t("common.cancel", "Hủy");

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [cancel, takePhoto, recordVideo, chooseLibrary], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) launchMediaPicker("camera_photo");
          else if (idx === 2) launchMediaPicker("camera_video");
          else if (idx === 3) launchMediaPicker("library");
        },
      );
    } else {
      Alert.alert(t("chatConversation.attachMedia", "Đính kèm ảnh / video"), null, [
        { text: takePhoto, onPress: () => launchMediaPicker("camera_photo") },
        { text: recordVideo, onPress: () => launchMediaPicker("camera_video") },
        { text: chooseLibrary, onPress: () => launchMediaPicker("library") },
        { text: cancel, style: "cancel" },
      ]);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await sendFileMessage(
          asset.uri,
          asset.name || asset.uri.split("/").pop() || "file",
          asset.mimeType || "application/octet-stream",
          asset.size,
        );
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("chatConversation.sendFileError"),
      });
    }
  };

  const sendFileMessage = async (fileUri, fileName, fileType, fileSize) => {
    await sendAttachmentMessage({
      uri: fileUri,
      type: "file",
      fileName,
      fileType,
      fileSize,
    });
  };

  // Accepts either a single image URI (the common case) or an array of URIs
  // (multi-select from the library picker, up to 10) - the single-URI path
  // is unchanged, the array path just repeats the same normalize step per
  // asset and hands the whole batch to sendAttachmentMessage as `attachments`.
  const sendImageMessage = async (imageUriOrUris) => {
    const uris = Array.isArray(imageUriOrUris) ? imageUriOrUris : [imageUriOrUris];
    const attachments = [];
    for (let i = 0; i < uris.length; i++) {
      // The picker can hand back non-JPEG originals (HEIC on iOS, PNG, etc.)
      // while we always declare image/jpeg - re-encode so the upload always
      // matches what it claims to be and passes the backend's mimes validation.
      let normalizedUri = uris[i];
      try {
        const result = await manipulateAsync(uris[i], [], {
          compress: 0.85,
          format: SaveFormat.JPEG,
        });
        normalizedUri = result.uri;
      } catch (error) {
        console.error("Error normalizing image before upload:", error);
      }
      attachments.push({
        uri: normalizedUri,
        fileName: `${Date.now()}_${i}.jpg`,
        fileType: "image/jpeg",
      });
    }

    if (attachments.length > 1) {
      await sendAttachmentMessage({ type: "image", attachments });
    } else {
      await sendAttachmentMessage({
        uri: attachments[0].uri,
        type: "image",
        fileName: attachments[0].fileName,
        fileType: attachments[0].fileType,
      });
    }
  };

  // Accepts either a single picker asset (the common case) or an array of
  // assets (multi-select, up to 10) - same split as sendImageMessage above.
  const sendVideoMessage = async (assetOrAssets) => {
    const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets];
    const attachments = assets.map((asset, i) => ({
      uri: asset.uri,
      fileName: asset.fileName || asset.uri.split("/").pop() || `video_${i}.mp4`,
      fileType: asset.mimeType || "video/mp4",
      fileSize: asset.fileSize,
    }));

    if (attachments.length > 1) {
      await sendAttachmentMessage({ type: "video", attachments });
    } else {
      await sendAttachmentMessage({
        uri: attachments[0].uri,
        type: "video",
        fileName: attachments[0].fileName,
        fileType: attachments[0].fileType,
        fileSize: attachments[0].fileSize,
      });
    }
  };

  const sendAttachmentMessage = async ({
    uri,
    type,
    fileName,
    fileType,
    fileSize,
    // Optional array of { uri, fileName, fileType, fileSize } - present only
    // when multiple assets were picked. When it has 2+ entries we send
    // files[] instead of the singular file field; a single-entry array is
    // treated the same as the plain uri/fileName/fileType/fileSize params.
    attachments,
  }) => {
    const isMulti = Array.isArray(attachments) && attachments.length > 1;
    const primary = isMulti
      ? attachments[0]
      : { uri, fileName, fileType, fileSize };

    // Reject up front anything guaranteed to fail server-side validation -
    // otherwise the user waits through a full (possibly minutes-long) upload
    // attempt just to get a generic error at the end, which is exactly what
    // testers reported for large videos/files with no progress indication.
    const allAttachments = isMulti ? attachments : [primary];
    const maxBytes = type === "video" ? MAX_VIDEO_BYTES : type === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    const oversized = allAttachments.find((att) => typeof att.fileSize === "number" && att.fileSize > maxBytes);
    if (oversized) {
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t(
          "chatConversation.attachmentTooLarge",
          "Tệp quá lớn ({{size}}), giới hạn {{limit}}MB",
          {
            size: formatBytesForToast(oversized.fileSize),
            limit: Math.round(maxBytes / (1024 * 1024)),
          },
        ),
      });
      return;
    }

    const tempId = Date.now().toString();
    // Same reasoning as handleSendMessage: declared before try/catch so the
    // catch block can restore it on failure.
    const replySnapshot = replyingTo;
    try {
      if (sending) return;

      setSending(true);

      const now = new Date().toISOString();

      // Create FormData
      const formData = new FormData();
      if (isMulti) {
        // Multiple attachments - the backend uses files[] instead of file
        // when it's present, so don't also send the singular field.
        attachments.forEach((att) => {
          formData.append("files[]", {
            uri: att.uri,
            type: att.fileType,
            name: att.fileName,
          });
        });
      } else {
        formData.append("file", {
          uri: primary.uri,
          type: primary.fileType,
          name: primary.fileName,
        });
      }
      formData.append("type", type);
      // The backend's `content` column is NOT NULL, and both omitting the
      // field and sending an empty/whitespace-only string have been observed
      // to fail server-side validation ("content must be a string") despite
      // the file being attached. A real, non-empty value is the only thing
      // that's worked reliably in testing, so reuse the same filename value
      // already used for non-image attachments - it's never shown for images
      // anyway since the bubble renders the image itself, not `content`.
      formData.append("content", primary.fileName);
      if (replySnapshot?.id) {
        formData.append("reply_to_message_id", replySnapshot.id);
      }

      // Optimistic message
      const optimisticMessage = {
        id: tempId,
        content: type === "image" ? "" : primary.fileName,
        type,
        file_url: primary.uri, // Use local URI temporarily
        // Optimistic multi-attachment preview: local file:// URIs so the
        // sending bubble's grid shows every picked asset immediately, same
        // as the single-attachment file_url swap below once the real
        // response (with the server's file_urls) comes back.
        file_urls: isMulti ? attachments.map((att) => att.uri) : null,
        file_name: primary.fileName,
        file_size: primary.fileSize,
        is_sending: true,
        upload_progress: 0,
        created_at: now,
        created_at_human: formatMessageTime(now, t),
        is_myself: true,
        read_at: null,
        sender: {
          username: username,
          avatar_url: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
          profile_name: profileName || username,
        },
        reply_to: replySnapshot
          ? {
              id: replySnapshot.id,
              content: replySnapshot.content,
              type: replySnapshot.type,
              file_url: replySnapshot.file_url,
              sender: replySnapshot.sender,
            }
          : undefined,
      };

      setReplyingTo(null);

      // Add optimistic message to UI
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        const messagesToAdd = [];

        // Check if we need a new date header
        const currDate = dayjs(now).startOf("day");
        const lastDate = lastMessage
          ? dayjs(lastMessage.created_at).startOf("day")
          : null;

        if (!lastDate || !currDate.isSame(lastDate)) {
          const today = dayjs().startOf("day");
          const isToday = currDate.isSame(today);
          const isYesterday = currDate.isSame(today.subtract(1, "day"));

          let dateText;
          if (isToday) {
            dateText = t("chatConversation.today");
          } else if (isYesterday) {
            dateText = t("chatConversation.yesterday");
          } else {
            dateText = currDate.format("DD/MM/YYYY");
          }

          messagesToAdd.push({
            id: `date-${tempId}`,
            type: "date",
            date: dateText,
          });
        }

        // Check if we need a new time header
        if (lastMessage && lastMessage.type === "message") {
          const lastTime = dayjs(lastMessage.created_at);
          const currTime = dayjs(now);
          if (currTime.diff(lastTime, "minute") > 5) {
            messagesToAdd.push({
              id: `time-${tempId}`,
              type: "time",
              time: formatMessageTime(now, t),
            });
          }
        }

        messagesToAdd.push(optimisticMessage);
        return [...prev, ...messagesToAdd];
      });

      let response;
      const targetConversationId = currentConversationId || conversationId;

      // Large uploads on mobile networks can take a while; without this the
      // bubble just shows a bare spinner for minutes with no indication
      // anything is actually happening, which is what testers reported as
      // "looks stuck" on big videos.
      const uploadConfig = {
        ...ATTACHMENT_UPLOAD_CONFIG,
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total;
          if (!total) return;
          const percent = Math.round((progressEvent.loaded * 100) / total);
          setMessages((prev) =>
            prev.map((m) =>
              typeof m.id === "string" && m.id.includes(tempId)
                ? { ...m, upload_progress: percent }
                : m,
            ),
          );
        },
      };

      if (isNewConversation && selectedUser) {
        // Create conversation first
        const createResponse = await createConversation(selectedUser.id);
        const newConversationId = createResponse.data.conversation_id;
        setCurrentConversationId(newConversationId);
        setCurrentConversation({
          participants: [
            {
              id: selectedUser.id,
              profile_name: selectedUser.profile_name,
              avatar_url: selectedUser.avatar_url,
              username: selectedUser.username,
            },
          ],
          id: newConversationId,
          latest_message: null,
          type: "private",
        });

        // Send image message
        response = await Api.postFormDataRequest(
          `/v1.0/chat/conversations/${newConversationId}/messages`,
          formData,
          uploadConfig,
        );

        navigation.setParams({
          conversation: {
            participants: [
              {
                id: selectedUser.id,
                profile_name: selectedUser.profile_name,
                avatar_url: selectedUser.avatar_url,
                username: selectedUser.username,
              },
            ],
            id: newConversationId,
            latest_message: null,
            type: "private",
          },
          conversationId: newConversationId,
          isNewConversation: false,
          selectedUser: null,
        });
      } else {
        // Send image message to existing conversation
        response = await Api.postFormDataRequest(
          `/v1.0/chat/conversations/${targetConversationId}/messages`,
          formData,
          uploadConfig,
        );
      }

      // Replace optimistic message with real one
      setMessages((prev) => {
        const baseMessages = prev.filter((msg) => {
          if (!msg || !msg.id || typeof msg.id !== "string") return true;
          return !msg.id.includes(tempId);
        });

        const lastMessage = baseMessages[baseMessages.length - 1];
        const messagesToAdd = [];

        // Check if we need a new date header
        const currDate = dayjs(response.data.created_at).startOf("day");
        const lastDate = lastMessage
          ? dayjs(lastMessage.created_at).startOf("day")
          : null;

        if (!lastDate || !currDate.isSame(lastDate)) {
          const today = dayjs().startOf("day");
          const isToday = currDate.isSame(today);
          const isYesterday = currDate.isSame(today.subtract(1, "day"));

          let dateText;
          if (isToday) {
            dateText = t("chatConversation.today");
          } else if (isYesterday) {
            dateText = t("chatConversation.yesterday");
          } else {
            dateText = currDate.format("DD/MM/YYYY");
          }

          messagesToAdd.push({
            id: `date-${response.data.id}`,
            type: "date",
            date: dateText,
          });
        }

        // Check if we need a new time header
        if (lastMessage && lastMessage.type === "message") {
          const lastTime = dayjs(lastMessage.created_at);
          const currTime = dayjs(response.data.created_at);
          if (currTime.diff(lastTime, "minute") > 5) {
            messagesToAdd.push({
              id: `time-${response.data.id}`,
              type: "time",
              time: formatMessageTime(response.data.created_at, t),
            });
          }
        }

        messagesToAdd.push({
          ...response.data,
          type: "message",
          content_type: response.data.type,
        });
        return [...baseMessages, ...messagesToAdd];
      });

      // Update cache
      const cacheId = currentConversationId || conversationId;
      const cachedData = storage.getString(getCacheKey(cacheId));
      if (cachedData) {
        try {
          const cachedMessages = JSON.parse(cachedData);
          cachedMessages.push(response.data);
          storage.set(getCacheKey(cacheId), JSON.stringify(cachedMessages));
          storage.set(getTimestampKey(cacheId), Date.now());
        } catch (error) {
          console.error("Cache update error:", error);
        }
      }
    } catch (error) {
      console.error(`Error sending ${type} attachment:`, error);

      // Remove optimistic message on error
      setMessages((prev) => {
        return prev.filter((msg) => {
          if (!msg || !msg.id || typeof msg.id !== "string") return true;
          return !msg.id.includes(tempId);
        });
      });

      if (replySnapshot) setReplyingTo(replySnapshot);

      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2:
          type === "image"
            ? t("chatConversation.sendImageError")
            : type === "video"
              ? t(
                  "chatConversation.sendVideoError",
                  "Không thể gửi video. Vui lòng thử lại.",
                )
              : t("chatConversation.sendFileError"),
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendNewMessage = async () => {
    scrollToLatestMessageAnimated();
    const tempId = Date.now().toString();
    // Declared outside the try block (not just above the catch) so it's
    // still in scope if something throws before it would otherwise be set -
    // catch needs it to restore the reply state on failure.
    const replySnapshot = replyingTo;
    try {
      const rawMessage = latestMessageRef.current || message;
      if (!rawMessage.trim() || sending) return;

      const trimmedMessage = rawMessage.trim();
      latestMessageRef.current = "";
      const now = new Date().toISOString();

      const optimisticMessage = {
        id: tempId,
        content: trimmedMessage,
        created_at: now,
        created_at_human: formatMessageTime(now, t),
        is_myself: true,
        is_sending: true,
        type: "message",
        read_at: null,
        sender: {
          username: username,
          avatar_url: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
          profile_name: profileName || username,
        },
        reply_to: replySnapshot
          ? {
              id: replySnapshot.id,
              content: replySnapshot.content,
              type: replySnapshot.type,
              file_url: replySnapshot.file_url,
              sender: replySnapshot.sender,
            }
          : undefined,
      };

      // Clear input immediately
      setMessage("");
      setReplyingTo(null);

      // Add time header if needed and optimistic message
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        const newMessages = [...prev];
        const messagesToAdd = [];

        // Check if we need a new date header
        const currDate = dayjs(now).startOf("day");
        const lastDate = lastMessage
          ? dayjs(lastMessage.created_at).startOf("day")
          : null;

        if (!lastDate || !currDate.isSame(lastDate)) {
          const today = dayjs().startOf("day");
          const isToday = currDate.isSame(today);
          const isYesterday = currDate.isSame(today.subtract(1, "day"));

          let dateText;
          if (isToday) {
            dateText = t("chatConversation.today");
          } else if (isYesterday) {
            dateText = t("chatConversation.yesterday");
          } else {
            dateText = currDate.format("DD/MM/YYYY");
          }

          messagesToAdd.push({
            id: `date-${tempId}`,
            type: "date",
            date: dateText,
          });
        }

        // Check if we need a new time header
        if (lastMessage && lastMessage.type === "message") {
          const lastTime = dayjs(lastMessage.created_at);
          const currTime = dayjs(now);
          if (currTime.diff(lastTime, "minute") > 5) {
            messagesToAdd.push({
              id: `time-${tempId}`,
              type: "time",
              time: formatMessageTime(now, t),
            });
          }
        }

        messagesToAdd.push(optimisticMessage);
        return [...newMessages, ...messagesToAdd];
      });

      setSending(true);

      let response;
      if (isNewConversation) {
        const createResponse = await createConversation(selectedUser.id);
        const newConversationId = createResponse.data.conversation_id;
        setCurrentConversationId(newConversationId);
        setCurrentConversation({
          participants: [
            {
              id: selectedUser.id,
              profile_name: selectedUser.profile_name,
              avatar_url: selectedUser.avatar_url,
              username: selectedUser.username,
            },
          ],
          id: newConversationId,
          latest_message: null,
          type: "private",
        });

        response = await sendMessage(newConversationId, {
          content: trimmedMessage,
          type: "text",
          reply_to_message_id: replySnapshot?.id,
        });

        // Update navigation params
        navigation.setParams({
          conversation: {
            participants: [
              {
                id: selectedUser.id,
                profile_name: selectedUser.profile_name,
                avatar_url: selectedUser.avatar_url,
                username: selectedUser.username,
              },
            ],
            id: newConversationId,
            latest_message: null,
            type: "private",
          },
          conversationId: newConversationId,
          isNewConversation: false,
          selectedUser: null,
        });
      } else {
        response = await sendMessage(currentConversationId, {
          content: trimmedMessage,
          type: "text",
          reply_to_message_id: replySnapshot?.id,
        });
      }

      // Replace optimistic message with real one and update storage
      setMessages((prev) => {
        const baseMessages = prev.filter((msg) => {
          if (!msg || !msg.id || typeof msg.id !== "string") return true;
          return !msg.id.includes(tempId);
        });

        // Get the last real message (excluding the temp message)
        const lastMessage = baseMessages[baseMessages.length - 1];
        const messagesToAdd = [];

        // Check if we need a new date header
        const currDate = dayjs(response.data.created_at).startOf("day");
        const lastDate = lastMessage
          ? dayjs(lastMessage.created_at).startOf("day")
          : null;

        if (!lastDate || !currDate.isSame(lastDate)) {
          const today = dayjs().startOf("day");
          const isToday = currDate.isSame(today);
          const isYesterday = currDate.isSame(today.subtract(1, "day"));

          let dateText;
          if (isToday) {
            dateText = t("chatConversation.today");
          } else if (isYesterday) {
            dateText = t("chatConversation.yesterday");
          } else {
            dateText = currDate.format("DD/MM/YYYY");
          }

          messagesToAdd.push({
            id: `date-${response.data.id}`,
            type: "date",
            date: dateText,
          });
        }

        // Check if we need a new time header
        if (lastMessage && lastMessage.type === "message") {
          const lastTime = dayjs(lastMessage.created_at);
          const currTime = dayjs(response.data.created_at);
          if (currTime.diff(lastTime, "minute") > 5) {
            messagesToAdd.push({
              id: `time-${response.data.id}`,
              type: "time",
              time: formatMessageTime(response.data.created_at, t),
            });
          }
        }

        messagesToAdd.push(response.data);
        return [...baseMessages, ...messagesToAdd];
      });

      // Flush any reaction the user made while this message was still
      // in-flight under its temp id - it couldn't be sent to the server
      // then since the server doesn't know that id.
      const queuedReactionType = pendingReactionsRef.current[tempId];
      if (queuedReactionType) {
        delete pendingReactionsRef.current[tempId];
        reactToMessage(response.data.id, queuedReactionType)
          .then((res) => applyReactionUpdate(response.data.id, res.data.reactions))
          .catch((error) => {
            console.error("Error flushing queued reaction:", error?.response?.data || error);
            applyReactionUpdate(response.data.id, response.data.reactions);
          });
      }

      const cachedData = storage.getString(getCacheKey(currentConversationId));
      if (cachedData) {
        try {
          const cachedMessages = JSON.parse(cachedData);
          cachedMessages.push(response.data);
          storage.set(getCacheKey(currentConversationId), JSON.stringify(cachedMessages));
          storage.set(getTimestampKey(currentConversationId), Date.now());
        } catch (error) {
          console.error("Cache update error:", error);
        }
      }
    } catch (error) {
      console.error("Error in handleSendMessage:", error.response?.data || error);

      setMessages((prev) => {
        return prev.filter((msg) => {
          if (!msg || !msg.id || typeof msg.id !== "string") return true;
          return !msg.id.includes(tempId);
        });
      });

      // Give the reply context back so retrying the send doesn't require
      // re-selecting what to reply to.
      if (replySnapshot) setReplyingTo(replySnapshot);

      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("chatConversation.sendMessageError"),
      });
    } finally {
      setSending(false);
    }
  };

  // Reactions ---------------------------------------------------------------

  const applyReactionUpdate = (messageId, reactions) => {
    recentlyReactedRef.current[messageId] = { reactions, ts: Date.now() };
    setMessages((prev) =>
      prev.map((m) =>
        m.type === "message" && m.id === messageId ? { ...m, reactions } : m,
      ),
    );
  };

  const buildOptimisticReaction = (message, type) => {
    const current = message.reactions || { summary: [], total: 0, my_reactions: [] };
    let summary = (current.summary || []).map((s) => ({ ...s }));

    const existing = summary.find((s) => s.type === type);
    if (existing) {
      existing.count += 1;
    } else {
      summary.push({ type, count: 1, users: [] });
    }

    return {
      summary,
      total: summary.reduce((sum, s) => sum + s.count, 0),
      my_reactions: [...(current.my_reactions || []), type],
    };
  };

  const buildOptimisticRemove = (message) => {
    const current = message.reactions || { summary: [], total: 0, my_reactions: [] };
    const myReactions = current.my_reactions || [];
    if (myReactions.length === 0) return current;

    // Remove all my reactions from summary counts
    const removeCounts = myReactions.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const summary = (current.summary || [])
      .map((s) => ({ ...s, count: Math.max(0, s.count - (removeCounts[s.type] || 0)) }))
      .filter((s) => s.count > 0);

    return {
      summary,
      total: summary.reduce((sum, s) => sum + s.count, 0),
      my_reactions: [],
    };
  };

  const openReactionPicker = (item, evt) => {
    // Used to also require a numeric (persisted) id here, which meant
    // long-pressing a message you'd JUST sent did nothing at all until its
    // temp id was replaced by the real one - the picker never opened, so
    // there was nothing to even queue a reaction against. Reacting to a
    // still-sending message is already handled downstream
    // (handleSelectReaction queues it via pendingReactionsRef when
    // message.is_sending), so only bail here if there's no message at all.
    // Reply/forward still individually guard on a numeric id, since those
    // genuinely need a real server id to act on.
    if (!item) return;

    const pageX = evt?.nativeEvent?.pageX ?? Dimensions.get("window").width / 2;
    const pageY = evt?.nativeEvent?.pageY ?? 200;

    setReactionPicker({
      visible: true,
      message: item,
      anchor: {
        x: pageX,
        y: Math.max(60, pageY - 56),
        alignRight: item.is_myself,
      },
    });
  };

  const closeReactionPicker = () => {
    setReactionPicker((prev) => ({ ...prev, visible: false }));
  };

  const handleReplyToMessage = () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item || typeof item.id !== "number") return;

    const contentType =
      item.type === "image" || item.type === "video" || item.type === "file"
        ? item.type
        : item.content_type === "image" || item.content_type === "video" || item.content_type === "file"
          ? item.content_type
          : "text";

    setReplyingTo({
      id: item.id,
      content: contentType === "text" ? item.content : null,
      type: contentType,
      file_url: item.file_url ?? null,
      sender: item.sender,
    });
    inputRef.current?.focus?.();
  };

  const cancelReply = () => setReplyingTo(null);

  const handleForwardMessage = () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item || typeof item.id !== "number") return;
    setForwardModal({ visible: true, message: item });
  };

  const closeForwardModal = () => setForwardModal({ visible: false, message: null });

  const handleCopyMessage = () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item) return;

    const textToCopy = item.content || "";
    if (!textToCopy) return;
    Clipboard.setString(textToCopy);
    Toast.show({ type: "success", text1: t("chatConversation.copied", "Đã sao chép") });
  };

  const handleDownloadMessage = async () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item) return;

    const isVideo = item.content_type === "video" || item.type === "video";
    const url = item.file_url;
    if (!url) return;

    try {
      await downloadMediaToLibrary(url, isVideo ? "video" : "image");
      Toast.show({ type: "success", text1: t("chatConversation.downloadSuccess", "Đã lưu vào thư viện") });
    } catch (error) {
      const message = error?.message === "PERMISSION_DENIED"
        ? t("chatConversation.downloadPermissionDenied", "Cần quyền truy cập thư viện ảnh để tải xuống")
        : t("chatConversation.downloadError", "Không thể tải xuống, vui lòng thử lại");
      Toast.show({ type: "error", text1: message });
    }
  };

  const handleRecallMessage = () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item) return;

    Alert.alert(
      t("chatConversation.recallTitle", "Thu hồi tin nhắn"),
      t("chatConversation.recallConfirm", "Tin nhắn sẽ bị thu hồi với tất cả mọi người."),
      [
        { text: t("settings.cancel", "Hủy"), style: "cancel" },
        {
          text: t("chatConversation.recall", "Thu hồi"),
          style: "destructive",
          onPress: async () => {
            // Optimistic update
            setMessages((prev) =>
              prev.map((m) =>
                m.id === item.id
                  ? { ...m, is_recalled: true, content: null, file_url: null, metadata: null }
                  : m
              )
            );
            try {
              await recallMessage(item.id);
            } catch (e) {
              // Revert on error
              setMessages((prev) =>
                prev.map((m) => (m.id === item.id ? item : m))
              );
              Toast.show({ type: "error", text1: t("common.error"), text2: e?.message });
            }
          },
        },
      ]
    );
  };

  const handleEditMessageAction = () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item || item.is_recalled) return;
    setEditingMessage({ id: item.id, originalContent: item.content });
    setMessage(item.content || "");
    inputRef.current?.focus?.();
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessage("");
  };

  const handleSendMessage = async () => {
    if (editingMessage) {
      await handleSubmitEdit();
      return;
    }
    await handleSendNewMessage();
  };

  const handleSubmitEdit = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    const { id, originalContent } = editingMessage;

    setEditingMessage(null);
    setMessage("");
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: trimmed, is_edited: true } : m
      )
    );

    try {
      await editMessage(id, trimmed);
    } catch (e) {
      // Revert on error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: originalContent, is_edited: m.is_edited } : m
        )
      );
      Toast.show({ type: "error", text1: t("common.error"), text2: t("chatConversation.editMessageError", "Không thể chỉnh sửa tin nhắn") });
    }
  };

  const handleSelectReaction = async (type) => {
    const message = reactionPicker.message;
    closeReactionPicker();
    if (!message) return;

    applyReactionUpdate(message.id, buildOptimisticReaction(message, type));

    if (message.is_sending) {
      // Message hasn't been assigned its real server id yet - queue the
      // reaction to be sent once it has (see pendingReactionsRef above).
      // The optimistic UI update above already makes it look instant.
      pendingReactionsRef.current[message.id] = type;
      return;
    }

    const previousReactions = message.reactions;
    try {
      const response = await reactToMessage(message.id, type);
      applyReactionUpdate(message.id, response.data.reactions);
    } catch (error) {
      console.error("Error reacting to message:", error?.response?.data || error);
      applyReactionUpdate(message.id, previousReactions);
    }
  };

  const handleDoubleTapMessage = async (message) => {
    if (!message || message.is_recalled) return;

    const hasLoved = message.reactions?.my_reactions?.includes("love");
    const previousReactions = message.reactions;

    if (hasLoved) {
      applyReactionUpdate(message.id, buildOptimisticRemove(message));
      try {
        const response = await removeMessageReaction(message.id);
        applyReactionUpdate(message.id, response.data.reactions);
      } catch (error) {
        console.error("Error removing message reaction on double tap:", error?.response?.data || error);
        applyReactionUpdate(message.id, previousReactions);
      }
    } else {
      applyReactionUpdate(message.id, buildOptimisticReaction(message, "love"));
      try {
        const response = await reactToMessage(message.id, "love");
        applyReactionUpdate(message.id, response.data.reactions);
      } catch (error) {
        console.error("Error reacting to message on double tap:", error?.response?.data || error);
        applyReactionUpdate(message.id, previousReactions);
      }
    }
  };

  const handleRemoveAllReactions = async () => {
    const message = reactionPicker.message;
    closeReactionPicker();
    if (!message || !(message.reactions?.my_reactions?.length > 0)) return;

    const previousReactions = message.reactions;
    applyReactionUpdate(message.id, buildOptimisticRemove(message));

    try {
      const response = await removeMessageReaction(message.id);
      applyReactionUpdate(message.id, response.data.reactions);
    } catch (error) {
      console.error("Error removing message reaction:", error?.response?.data || error);
      applyReactionUpdate(message.id, previousReactions);
    }
  };

  const renderReactionModal = () => {
    const { visible, reactions } = reactionModal;
    if (!visible || !reactions) return null;

    const summary = reactions.summary || [];
    const sorted = [...summary].sort((a, b) => b.count - a.count);

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionModal({ visible: false, reactions: null })}
      >
        <TouchableWithoutFeedback
          onPress={() => setReactionModal({ visible: false, reactions: null })}
        >
          <View style={styles.reactionModalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.reactionModalContainer,
                  { backgroundColor: isDarkMode ? "#1c1c1e" : "#ffffff" },
                ]}
              >
                <Text
                  style={[
                    styles.reactionModalTitle,
                    { color: theme.text },
                  ]}
                >
                  {t("chatConversation.reactionCount", "{{count}} lượt thả cảm xúc", { count: reactions.total })}
                </Text>
                {sorted.map((s) => (
                  <View key={s.type} style={styles.reactionModalRow}>
                    <Text style={styles.reactionModalEmoji}>
                      {REACTION_EMOJI_BY_TYPE[s.type] || "👍"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      {(s.users || []).map((u) => (
                        <View key={u.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text
                            style={[styles.reactionModalUser, { color: theme.text, flex: 1 }]}
                            numberOfLines={1}
                          >
                            {u.profile_name || u.username}
                          </Text>
                          {u.count > 1 && (
                            <Text style={[styles.reactionModalCount, { color: theme.subText, marginLeft: 6 }]}>
                              ×{u.count}
                            </Text>
                          )}
                        </View>
                      ))}
                      {(!s.users || s.users.length === 0) && (
                        <Text style={[styles.reactionModalUser, { color: theme.subText }]}>
                          {t("chatConversation.reactionTimes", "{{count}} lượt", { count: s.count })}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // Media viewers -------------------------------------------------------------

  const openImageViewer = (uri) => setImageViewer({ visible: true, uris: [uri], index: 0 });
  // Same viewer, but opened from a multi-attachment grid - takes the full
  // gallery of resolved URLs plus the index of the thumbnail that was
  // tapped, so react-native-image-viewing can start there and let the user
  // swipe through the rest.
  const openImageViewerGallery = (uris, index = 0) =>
    setImageViewer({ visible: true, uris, index });
  const openVideoViewer = (uri) => setVideoViewer({ visible: true, uri });

  // react-native-image-viewing's default header positions the close button
  // with RN's own <SafeAreaView>, which is an iOS-only no-op - on Android it
  // applies no top inset at all, so the button sits right under (behind) the
  // status bar and can't be tapped. Supply our own header using the safe
  // area insets we already have.
  const ImageViewerHeader = () => (
    <View style={{ paddingTop: insets.top + 8, paddingRight: 12, alignItems: "flex-end" }}>
      <TouchableOpacity
        onPress={() => setImageViewer({ visible: false, uris: [], index: 0 })}
        style={styles.imageViewerCloseButton}
        hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  // Downloads a file attachment and hands it to the native share sheet, the
  // same pattern StudyMaterialDetailScreen uses: on iOS documentDirectory is
  // sandboxed, so the share sheet is the actual delivery of the file, not a
  // best-effort extra.
  const handleOpenFile = async (item) => {
    const fileUrl = resolveMediaUrl(item.file_url);
    if (!fileUrl || downloadingFileId) return;

    try {
      setDownloadingFileId(item.id);

      const proposedName = item.file_name || item.content || fileUrl.split("/").pop() || "file";
      const safeName = proposedName.replace(/[\\/:*?"<>|]/g, "_");
      const fileUri = `${FileSystem.documentDirectory}${safeName}`;

      const existing = await FileSystem.getInfoAsync(fileUri);
      if (existing.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }

      const result = await FileSystem.downloadAsync(fileUrl, fileUri);

      if (result?.status !== 200) {
        throw new Error(`Unexpected status ${result?.status}`);
      }

      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({
          type: "error",
          text1: t("common.error"),
          text2: t(
            "chatConversation.shareUnavailable",
            "Sharing isn't available on this device (Simulator doesn't support it).",
          ),
        });
        return;
      }

      await Sharing.shareAsync(result.uri, { dialogTitle: safeName });
    } catch (error) {
      console.error("[ChatMedia] file download/share failed", error);
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: error?.message || t("chatConversation.sendFileError"),
      });
    } finally {
      setDownloadingFileId(null);
    }
  };

  // Stable handle for MessageRow/ReactionBadge (both React.memo'd) to call
  // back into - kept fresh every render via this ref instead of passing the
  // functions directly as props, so MessageRow's props (and therefore
  // whether React.memo can skip re-rendering it) don't change identity just
  // because e.g. `mediaLoadErrors` or `downloadingFileId` changed for some
  // *other* message.
  const messageHandlersRef = useRef({});
  useEffect(() => {
    messageHandlersRef.current = {
      openImageViewer,
      openImageViewerGallery,
      openVideoViewer,
      handleOpenFile,
      handleDoubleTapMessage,
      openReactionPicker,
      handleJumpToRepliedMessage,
      setReplyingTo,
      setReactionModal,
      lastTapRef,
      focusInput: () => inputRef.current?.focus?.(),
      showSeenBy: setSeenByModalParticipants,
    };
  });

  const handleImageLoadError = React.useCallback((id, reason) => {
    setMediaLoadErrors((prev) => ({ ...prev, [id]: reason }));
  }, []);


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {(messageSuggestions.length > 0 || messageSuggestionsLoading) && (
        <View
          style={{
            position: "absolute",
            bottom: (chatKeyboardHeight || insets.bottom) + 72,
            left: 0,
            right: 0,
            zIndex: 50,
          }}
          pointerEvents="box-none"
        >
          <MentionSuggestions
            suggestions={messageSuggestions}
            onSelect={onSelectMessageMention}
            loading={messageSuggestionsLoading}
          />
        </View>
      )}
      {/* Header */}
      <View
        pointerEvents="box-none"
        style={[
          styles.headerOverlay,
          {
            paddingTop: insets.top,
            height: HEADER_HEIGHT,
            backgroundColor: "transparent",
          },
        ]}
      >
        <View style={styles.headerContent}>
          <LiquidButton size={ICON_BUTTON_SIZE} providerId="ConversationScreen" onPress={safeGoBack} forceNoGlass={isAndroid}>
            <Ionicons name="chevron-back" size={22} color={theme.primary} />
          </LiquidButton>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} pointerEvents="box-none">
            <LiquidButton
              forceNoGlass={isAndroid}
              onPress={() => {
                if (currentConversation?.type === "group") {
                  if (!isPublicGroupChat(currentConversation)) {
                    navigation.navigate("GroupInfoScreen", {
                      conversationId: currentConversationId || conversationId,
                    });
                  }
                  return;
                }
                navigation.navigate("ProfileScreen", { username: otherUser?.username });
              }}
              providerId="ConversationScreen"
              size={BUTTON_SIZE}
              style={[
                styles.headerCenterPill,
                {
                  borderColor: theme.border,
                  height: BUTTON_SIZE,
                  borderRadius: BUTTON_SIZE / 2,
                  paddingHorizontal: 12,
                  maxWidth: CENTER_MAX_WIDTH,
                },
              ]}
            >
              <View style={styles.headerAvatarOuter}>
                <View style={styles.headerAvatarWrapper}>
                  <Image
                    source={
                      getHeaderAvatar() === "local:chat.jpg"
                        ? require("../../../assets/chat.jpg")
                        : { uri: getHeaderAvatar() || "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg" }
                    }
                    style={styles.headerAvatarLarge}
                  />
                </View>
                {currentConversation?.type !== "group" && isOtherUserOnline ? (
                  <View style={styles.headerOnlineDot} />
                ) : null}
              </View>
              <View style={[styles.headerTextContainer, { flexShrink: 1, minWidth: 0 }]}>
                <Text
                  style={[styles.headerName, { color: theme.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {isNewConversation
                    ? selectedUser.profile_name
                    : currentConversation?.type === "group"
                      ? isPublicGroupChat(currentConversation)
                        ? t("chatConversation.casualGroupName")
                        : currentConversation?.name || t("chatConversation.casualGroupName")
                      : currentConversation?.participants[0]?.profile_name}
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.subText }]} numberOfLines={1} ellipsizeMode="tail">
                  {currentConversation?.type === "group"
                    ? `${currentConversation?.participants?.length || 0} ${t("chatConversation.members") || "members"}`
                    : otherUser?.username ? "@" + otherUser.username : ""}
                </Text>
              </View>
            </LiquidButton>
          </View>

          <LiquidButton size={ICON_BUTTON_SIZE} providerId="ConversationScreen" onPress={showOptions} forceNoGlass={isAndroid}>
            <Ionicons name="ellipsis-vertical" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      </View>
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />

      <ChatBackgroundModal
        visible={backgroundModalVisible}
        conversationId={currentConversationId || conversationId}
        onClose={() => setBackgroundModalVisible(false)}
        onBackgroundChanged={(url) => {
          setBackgroundOverride(url);
          setCurrentConversation((prev) => (prev ? { ...prev, background_url: url } : prev));
        }}
      />

      <Modal
        visible={!!seenByModalParticipants}
        transparent
        animationType="fade"
        onRequestClose={() => setSeenByModalParticipants(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSeenByModalParticipants(null)}>
          <View style={styles.seenByBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.seenByBox, { backgroundColor: theme.background }]}>
                <Text style={[styles.seenByTitle, { color: theme.text }]}>
                  {t("chatConversation.seenBy", "Đã xem")}
                </Text>
                <FlatList
                  data={seenByModalParticipants || []}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <View style={styles.seenByParticipantRow}>
                      <Image source={{ uri: item.avatar_url }} style={styles.seenByParticipantAvatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.seenByParticipantName, { color: theme.text }]} numberOfLines={1}>
                          {item.profile_name || item.username}
                        </Text>
                        <Text style={[styles.seenByParticipantTime, { color: theme.subText }]}>
                          {formatTime(item.last_read_at)}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ImageView
        images={imageViewer.uris.map((u) => ({ uri: u }))}
        imageIndex={imageViewer.index}
        visible={imageViewer.visible}
        onRequestClose={() => setImageViewer({ visible: false, uris: [], index: 0 })}
        HeaderComponent={ImageViewerHeader}
      />

      {videoViewer.uri && (
        <VideoViewerModal
          visible={videoViewer.visible}
          uri={videoViewer.uri}
          onClose={() => setVideoViewer({ visible: false, uri: null })}
          insetsTop={insets.top}
        />
      )}

      {renderReactionModal()}

      <MessageReactionPicker
        visible={reactionPicker.visible}
        anchor={reactionPicker.anchor}
        myReactions={reactionPicker.message?.reactions?.my_reactions || []}
        onSelect={handleSelectReaction}
        onRemoveAll={handleRemoveAllReactions}
        onCopy={
          reactionPicker.message?.content &&
          !reactionPicker.message?.is_recalled &&
          reactionPicker.message?.type !== "image" &&
          reactionPicker.message?.type !== "video" &&
          reactionPicker.message?.type !== "file" &&
          reactionPicker.message?.content_type !== "image" &&
          reactionPicker.message?.content_type !== "video" &&
          reactionPicker.message?.content_type !== "file"
            ? handleCopyMessage
            : undefined
        }
        onDownload={
          !reactionPicker.message?.is_recalled &&
          reactionPicker.message?.file_url &&
          (reactionPicker.message?.type === "image" ||
            reactionPicker.message?.type === "video" ||
            reactionPicker.message?.content_type === "image" ||
            reactionPicker.message?.content_type === "video")
            ? handleDownloadMessage
            : undefined
        }
        onReply={reactionPicker.message?.is_recalled ? undefined : handleReplyToMessage}
        onForward={reactionPicker.message?.is_recalled ? undefined : handleForwardMessage}
        onEdit={
          reactionPicker.message?.is_myself &&
          !reactionPicker.message?.is_recalled &&
          (reactionPicker.message?.type === "message" || reactionPicker.message?.content_type == null || reactionPicker.message?.content_type === "text") &&
          reactionPicker.message?.content_type !== "image" &&
          reactionPicker.message?.content_type !== "video" &&
          reactionPicker.message?.content_type !== "file" &&
          reactionPicker.message?.type !== "image" &&
          reactionPicker.message?.type !== "video" &&
          reactionPicker.message?.type !== "file"
            ? handleEditMessageAction
            : undefined
        }
        onRecall={
          reactionPicker.message?.is_myself && !reactionPicker.message?.is_recalled
            ? handleRecallMessage
            : undefined
        }
        onViewSeenBy={
          isGroupConversation &&
          reactionPicker.message?.is_myself &&
          !reactionPicker.message?.is_sending
            ? () => {
                closeReactionPicker();
                if (readReceiptsOff) {
                  Toast.show({
                    type: "info",
                    text1: t("chatConversation.readReceiptsOffTitle"),
                    text2: t("chatConversation.readReceiptsOffDesc"),
                  });
                  return;
                }
                const message = reactionPicker.message;
                const createdAt = new Date(message.created_at).getTime();
                setSeenByModalParticipants(
                  seenParticipants.filter(
                    (p) => p.last_read_at && new Date(p.last_read_at).getTime() >= createdAt
                  )
                );
              }
            : undefined
        }
        onClose={closeReactionPicker}
      />

      <ForwardMessageModal
        visible={forwardModal.visible}
        message={forwardModal.message}
        onClose={closeForwardModal}
      />

      {/* (profile block and floating button moved into header) */}

      {/* AndroidGlassBackdrop must be an ancestor of any live-transformed
          content, never a descendant - KeyboardGestureArea interactively
          transforms its subtree per-frame outside RN's normal layout pass
          (for the iOS-style drag-to-dismiss-keyboard gesture), which
          previously sat ABOVE the glass provider here and desynced its
          native blur capture from what was actually being drawn, making it
          render blank/transparent on Android. Wrapping it the other way
          around - glass outermost, gesture area only around the scrollable
          message list that's meant to be draggable - fixes the capture
          while keeping the gesture. The input bar (KeyboardStickyView) stays
          a sibling of the glass provider, not nested inside it, per
          liquid-glass-kit's own requirement that LiquidGlassViews (used
          inside CommentBar) be siblings of their AndroidGlassBackdrop, not
          descendants. */}
      <View style={{ flex: 1 }}>
        {chatBackgroundUrl ? (
          <Image source={{ uri: chatBackgroundUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        {chatBackgroundUrl ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDarkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)" },
            ]}
          />
        ) : null}
        <AndroidGlassBackdrop providerId="ConversationScreen" style={{ flex: 1 }}>
        <KeyboardGestureArea
          interpolator="ios"
          style={{ flex: 1 }}
          textInputNativeID="chat-input"
        >
        <KeyboardChatScrollView
          ref={messagesScrollRef}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingTop: HEADER_HEIGHT + 12, paddingBottom: 100 },
          ]}
          keyboardDismissMode="interactive"
          onScroll={handleMessagesScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(w, h) => {
            scrollContentHeightRef.current = h;
            handleMessagesContentSizeChange(w, h);
          }}
          onLayout={(e) => {
            scrollViewHeightRef.current = e.nativeEvent.layout.height;
          }}
        >
          <MessagesListContent
            messages={visibleMessages}
            isGroupChat={currentConversation?.type === "group"}
            theme={theme}
            isDarkMode={isDarkMode}
            t={t}
            username={username}
            navigation={navigation}
            mediaLoadErrors={mediaLoadErrors}
            downloadingFileId={downloadingFileId}
            messageHandlersRef={messageHandlersRef}
            onImageError={handleImageLoadError}
            activeInlineVideoId={activeInlineVideoId}
            autoplayVideos={autoplayVideos}
            highlightedMessageId={highlightedMessageId}
            messageLayoutOffsetsRef={messageLayoutOffsetsRef}
            pendingHighlightMessageIdRef={pendingHighlightMessageIdRef}
            attemptScrollToHighlightRef={attemptScrollToHighlightRef}
            seenParticipants={seenParticipants}
          />
          {typingUser && (
            <Text
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: theme.subText,
                paddingHorizontal: 12,
                paddingTop: 4,
              }}
            >
              {currentConversation?.type === "group" && typingUser.name
                ? `${typingUser.name} ${t("chatConversation.isTyping", "đang nhập...")}`
                : t("chatConversation.typing", "Đang nhập...")}
            </Text>
          )}
          <View style={{ height: isAndroid ? 82 : 24 }} />
        </KeyboardChatScrollView>
        </KeyboardGestureArea>
        </AndroidGlassBackdrop>
      </View>

        {/* Input Bar - positioned above messages */}
        <KeyboardStickyView
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "transparent",
            zIndex: 10,
            paddingBottom: insets.bottom,
          }}
          // The `opened` lift is intentionally 20px short of the keyboard's
          // real height - that gap is meant to be absorbed by paddingBottom
          // (insets.bottom) above, which is ~34 on notched iPhones/Android
          // gesture nav. On devices with no bottom safe area (iPhone
          // 6s/7/8/SE - physical home button, insets.bottom === 0) nothing
          // absorbs it, so the bar renders 20px below the keyboard's top
          // edge. Drop the offset to 0 there so it lifts exactly to the
          // keyboard's edge instead.
          offset={{ opened: insets.bottom > 0 ? 20 : 0 }}
        >
          {showScrollButton && (
            <TouchableOpacity
              onPress={scrollToLatestMessageAnimated}
              style={{
                alignSelf: "center",
                marginBottom: 8,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDarkMode ? "#1e1e1e" : "#ffffff",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 5,
                borderWidth: 1,
                borderColor: isDarkMode ? "#333" : "#e0e0e0",
              }}
            >
              <Ionicons name="chevron-down" size={22} color={isDarkMode ? "#fff" : "#333"} />
            </TouchableOpacity>
          )}
          {editingMessage && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: isDarkMode ? "#1a1a1a" : "#f0f0f0",
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
              }}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.primary} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.primary }} numberOfLines={1}>
                  {t("chatConversation.editingMessage", "Đang chỉnh sửa tin nhắn")}
                </Text>
                <Text style={{ fontSize: 13, color: theme.subText }} numberOfLines={1}>
                  {editingMessage.originalContent}
                </Text>
              </View>
              <TouchableOpacity onPress={cancelEdit} hitSlop={10} style={{ marginLeft: 8, padding: 4 }}>
                <Ionicons name="close" size={18} color={theme.subText} />
              </TouchableOpacity>
            </View>
          )}
          <ReplyComposerBar
            replyingTo={editingMessage ? null : replyingTo}
            currentUsername={username}
            onCancel={cancelReply}
          />
          <View
            style={{
              backgroundColor: "transparent",
              paddingHorizontal: 12,
              paddingTop: 0,
              paddingBottom: 0,
            }}
          >
            <CommentBar
              ref={inputRef}
              providerId="ConversationScreen"
              placeholderText={t("chat.typeMessage")}
              onSubmit={handleSendMessage}
              onChangeText={(text) => {
                latestMessageRef.current = text;
                messageMentionProps.onChangeText(text);
                sendTyping(currentConversationId || conversationId);
              }}
              value={message}
              disabled={!message.trim() || sending}
              isSubmitting={sending}
              allowBroadcastMention={currentConversation?.type === "group"}
              forceNoGlass={isAndroid}
              style={{
                paddingHorizontal: 12,
                paddingBottom: isAndroid ? 14 : 0,
                paddingTop: isAndroid ? 10 : 0,
                backgroundColor: "transparent",
                marginTop: 0,
              }}
              leftAccessory={
                <View style={{ flexDirection: "row" }}>
                  <TouchableOpacity
                    style={styles.attachButton}
                    onPress={pickImage}
                    disabled={sending}
                  >
                    <Ionicons
                      name="image-outline"
                      size={20}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.attachButton, { marginLeft: 6 }]}
                    onPress={pickDocument}
                    disabled={sending}
                  >
                    <Ionicons
                      name="attach-outline"
                      size={20}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                </View>
              }
              nativeID="chat-input"
            />
          </View>
        </KeyboardStickyView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "space-between",
    height: "100%",
  },
  headerCenterContent: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerRightAction: {
    width: 44,
    alignItems: "flex-end",
  },
  headerCenterPill: {
    width: 'auto',
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  floatingOptions: {
    position: "absolute",
    right: 12,
    top: "40%",
    zIndex: 11,
  },
  floatingOptionsInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerProfile: {
    position: "absolute",
    left: 56,
    right: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  headerAvatarOuter: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  headerAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#16a34a",
  },
  headerAvatarLarge: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTextContainer: {
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
    opacity: 0.75,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "flex-end",
  },
  myMessageContainer: {
    justifyContent: "flex-end",
  },
  theirMessageContainer: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 20,
    overflow: "hidden",
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  chatMessageBubble: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderRadius: 20,
  },
  imageMessageBubble: {
    padding: 0,
    overflow: "hidden",
  },
  fileMessageBubble: {
    padding: 10,
    minWidth: 180,
  },
  fileMessageContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  fileIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(49,149,39,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  fileMessageName: {
    fontSize: 14,
    fontWeight: "600",
  },
  fileMessageSub: {
    fontSize: 11,
    marginTop: 2,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  uploadProgressText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  messageText: {
    fontSize: 16,
    flexShrink: 1,
  },
  messageTime: {
    fontSize: 12,
  },
  myMessageTime: {
    textAlign: "right",
    marginRight: 4,
  },
  theirMessageTime: {
    marginLeft: 4,
  },
  storyReplyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 4,
    paddingHorizontal: 16,
    marginTop: 8,
    maxWidth: "100%",
  },
  storyReplyHeaderRight: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
  },
  storyReplyText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    marginLeft: 4,
    fontStyle: "italic",
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  storyReplyTextRight: {
    textAlign: "right",
    marginLeft: 0,
    marginRight: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "rgba(49,149,39,0.12)",
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    padding: 8,
    borderRadius: 20,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  messageDate: {
    fontSize: 13,
    textAlign: "center",
    marginVertical: 16,
  },
  timeHeaderContainer: {
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  timeHeaderText: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  dateHeaderContainer: {
    alignItems: "center",
    marginVertical: 24,
    paddingHorizontal: 8,
  },
  dateHeaderText: {
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    fontWeight: "600",
  },
  systemMessageContainer: {
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  systemMessageText: {
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  senderName: {
    fontSize: 12,
    marginLeft: 48,
    marginBottom: 4,
    marginTop: 8,
    fontWeight: "500",
  },
  groupMessageWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  myMessageFooter: {
    justifyContent: "flex-end",
    marginRight: 4,
  },
  theirMessageFooter: {
    justifyContent: "flex-start",
    marginLeft: 4,
  },
  readStatus: {
    marginLeft: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  doubleCheck: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkOverlap: {
    marginRight: -6,
  },
  seenByRow: {
    marginLeft: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  seenAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  videoPlaceholder: {
    backgroundColor: "#000",
  },
  mediaErrorFallback: {
    backgroundColor: "#3a1a1a",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  mediaErrorText: {
    color: "#fff",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  videoPlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  videoViewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  seenByBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  seenByBox: {
    width: "100%",
    maxHeight: "60%",
    borderRadius: 16,
    padding: 16,
  },
  seenByTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  seenByParticipantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  seenByParticipantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  seenByParticipantName: {
    fontSize: 14,
    fontWeight: "600",
  },
  seenByParticipantTime: {
    fontSize: 12,
    marginTop: 1,
  },
  videoViewerClose: {
    position: "absolute",
    right: 20,
    zIndex: 1,
    padding: 6,
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  videoViewerPlayer: {
    width: "100%",
    height: "100%",
  },
  reactionBadgeRow: {
    position: "absolute",
    bottom: -14,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reactionIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionPillBadge: {
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionPillCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  reactionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  reactionModalContainer: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  reactionModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 14,
    textAlign: "center",
  },
  reactionModalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  reactionModalEmoji: {
    fontSize: 28,
  },
  reactionModalUser: {
    fontSize: 14,
    fontWeight: "500",
  },
  reactionModalCount: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default ConversationScreen;
