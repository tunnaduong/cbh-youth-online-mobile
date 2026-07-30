import React, { useState, useRef, useEffect, useContext } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import ImageView from "react-native-image-viewing";
import { useVideoPlayer, VideoView } from "expo-video";
// import FastImage from "../../../components/FastImage";
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
} from "../../../services/api/Api";
import MentionText from "../../../components/MentionText";
import MentionSuggestions, { useMentionInput } from "../../../components/MentionSuggestions";
import ReportModal from "../../../components/ReportModal";
import CommentBar from "../../../components/CommentBar";
import ReplyPreviewBubble from "../../../components/ReplyPreviewBubble";
import ReplyComposerBar from "../../../components/ReplyComposerBar";
import MessageReactionPicker, {
  REACTION_EMOJI_BY_TYPE,
  REACTION_EMOJIS,
} from "../../../components/MessageReactionPicker";
import { Alert, ActionSheetIOS, KeyboardAvoidingView, Clipboard } from "react-native";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import "dayjs/locale/ru";
import { storage } from "../../../global/storage";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
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
// far too short for multi-MB attachment uploads (video allows up to 100MB on
// the backend), which was surfacing as a generic axios "Network Error".
const ATTACHMENT_UPLOAD_CONFIG = { timeout: 120000 };

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
  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = false;
    if (uri) p.play();
  });

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
        {uri && (
          <VideoView
            style={styles.videoViewerPlayer}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        )}
      </View>
    </Modal>
  );
};

const SWIPE_THRESHOLD = 55;
const SWIPE_ICON_OFFSET = 44;

const SwipeableMessage = ({ children, isMyMessage, onSwipe }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggeredRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
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
  const [messages, setMessages] = useState([]);

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

  const { mentionProps: messageMentionProps, suggestions: messageSuggestions, onSelectMention: onSelectMessageMention, loading: messageSuggestionsLoading, inMentionMode: messageInMentionMode } = useMentionInput({
    value: message,
    onChange: setMessage,
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
  const pendingHighlightMessageIdRef = useRef(highlightMessageId ?? null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [sending, setSending] = useState(false);
  const { username, profileName } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const [currentConversation, setCurrentConversation] = useState(conversation);
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  // Keep the ref used by useMentionInput in sync with the resolved conversation id
  React.useEffect(() => {
    activeConversationId.current = currentConversationId || conversationId;
  }, [currentConversationId, conversationId]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
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
  const [imageViewer, setImageViewer] = useState({ visible: false, uri: null });
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
    try {
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
      if (targetId) {
        await reportUser({ reported_user_id: targetId, reason });
        Alert.alert(
          t("chatConversation.thanksTitle"),
          t("chatConversation.reportSent"),
        );
      } else {
        Alert.alert(t("common.error"), t("chatConversation.reportTargetError"));
      }
    } catch (e) {
      const errorMessage =
        e.response?.data?.message ||
        e.message ||
        t("chatConversation.reportError");
      Alert.alert(t("common.error"), errorMessage);
    }
  };

  const showOptions = () => {
    const options = [
      t("chatConversation.report"),
      t("chatConversation.blockUser"),
      t("common.cancel"),
    ];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 2;

    if (!otherUser) {
      // If no user to block (e.g. group), show limited options or alert
      // For simple implementation, just show Report if applicable or nothing
      // Or show "Thông tin nhóm" etc.
      // I will just show 'Report' if I can report group, else nothing specific for now blocks unless user asked for group blocking.
      // User asked "user can report ... from chat".
      // Use limited options
      Alert.alert(t("chatConversation.optionsTitle"), null, [
        {
          text: t("chatConversation.report"),
          onPress: () => setReportModalVisible(true),
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
          else if (buttonIndex === 1) confirmBlock();
        },
      );
    } else {
      Alert.alert(t("chatConversation.optionsTitle"), null, [
        {
          text: t("chatConversation.report"),
          onPress: () => setReportModalVisible(true),
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
    // Special case for "Tán gẫu linh tinh" group
    if (
      currentConversation?.type === "group" &&
      (currentConversation?.name?.trim().normalize("NFC").toLowerCase() ===
        "tán gẫu linh tinh" ||
        currentConversation?.name === t("chatConversation.casualGroupName"))
    ) {
      return "local:chat.jpg";
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
        setMessages(transformed);
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
            return transformed;
          }

          const existingMessages = prev.filter(
            (item) => item.type === "message",
          );
          return injectTimeHeaders([...newMessages, ...existingMessages], t);
        });
        setHasMore(response.data.current_page < response.data.last_page);
        setPage((prev) => (isRefresh ? 2 : prev + 1));
      } else if (JSON.stringify(newMessages) !== previousCache) {
        // Update UI only if new data is different from what was cached before this refresh
        setMessages(transformed);
        setPage(2);
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
    const refreshAndScroll = () => {
      // A real message arrived, so any "typing..." bubble for this conversation is stale.
      clearTimeout(typingTimeoutRef.current);
      setTypingUser(null);

      // Wait for the fetch (and the setMessages it triggers) to actually complete
      // before scrolling - otherwise this scrolls to the end of the *old* list,
      // before the new message has been added to state.
      fetchMessagesRef.current(true, true).then(() => {
        scrollToLatestMessageAnimated();
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
    const y = messageLayoutOffsetsRef.current[targetId];
    if (y == null) return false;
    requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollTo({
        y: Math.max(y - 120, 0),
        animated: true,
      });
    });
    setHighlightedMessageId(targetId);
    setTimeout(() => setHighlightedMessageId(null), 2500);
    return true;
  };

  const attemptScrollToHighlight = () => {
    const targetId = pendingHighlightMessageIdRef.current;
    if (targetId == null) return false;
    const didScroll = scrollToMessageAndHighlight(targetId);
    if (didScroll) pendingHighlightMessageIdRef.current = null;
    return didScroll;
  };

  // Tapping a ReplyPreviewBubble jumps to the original message. If it's not
  // in the currently loaded page (an older message), keep loading older
  // pages until it turns up or we run out.
  const handleJumpToRepliedMessage = async (replyToId) => {
    if (replyToId == null) return;
    if (scrollToMessageAndHighlight(replyToId)) return;

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

  const handleMessagesScroll = ({ nativeEvent }) => {
    const offsetY = nativeEvent.contentOffset.y;
    scrollY.setValue(offsetY);
    const isNearTop = offsetY <= 40;
    if (isNearTop && hasMore && !refreshing && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      fetchMessages(false);
    }
    const distanceFromBottom = scrollContentHeightRef.current - scrollViewHeightRef.current - offsetY;
    const shouldShow = distanceFromBottom > 150;
    setShowScrollButton((prev) => (prev === shouldShow ? prev : shouldShow));
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
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.type === "video") {
          await sendVideoMessage(asset);
        } else {
          await sendImageMessage(asset.uri);
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

  const sendImageMessage = async (imageUri) => {
    // The picker can hand back non-JPEG originals (HEIC on iOS, PNG, etc.)
    // while we always declare image/jpeg - re-encode so the upload always
    // matches what it claims to be and passes the backend's mimes validation.
    let normalizedUri = imageUri;
    try {
      const result = await manipulateAsync(imageUri, [], {
        compress: 0.85,
        format: SaveFormat.JPEG,
      });
      normalizedUri = result.uri;
    } catch (error) {
      console.error("Error normalizing image before upload:", error);
    }

    await sendAttachmentMessage({
      uri: normalizedUri,
      type: "image",
      fileName: `${Date.now()}.jpg`,
      fileType: "image/jpeg",
    });
  };

  const sendVideoMessage = async (asset) => {
    const fileName =
      asset.fileName || asset.uri.split("/").pop() || "video.mp4";
    await sendAttachmentMessage({
      uri: asset.uri,
      type: "video",
      fileName,
      fileType: asset.mimeType || "video/mp4",
      fileSize: asset.fileSize,
    });
  };

  const sendAttachmentMessage = async ({
    uri,
    type,
    fileName,
    fileType,
    fileSize,
  }) => {
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
      formData.append("file", {
        uri,
        type: fileType,
        name: fileName,
      });
      formData.append("type", type);
      // The backend's `content` column is NOT NULL, and both omitting the
      // field and sending an empty/whitespace-only string have been observed
      // to fail server-side validation ("content must be a string") despite
      // the file being attached. A real, non-empty value is the only thing
      // that's worked reliably in testing, so reuse the same filename value
      // already used for non-image attachments - it's never shown for images
      // anyway since the bubble renders the image itself, not `content`.
      formData.append("content", fileName);
      if (replySnapshot?.id) {
        formData.append("reply_to_message_id", replySnapshot.id);
      }

      // Optimistic message
      const optimisticMessage = {
        id: tempId,
        content: type === "image" ? "" : fileName,
        type,
        file_url: uri, // Use local URI temporarily
        file_name: fileName,
        file_size: fileSize,
        is_sending: true,
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
          ATTACHMENT_UPLOAD_CONFIG,
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
          ATTACHMENT_UPLOAD_CONFIG,
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
      console.log('[Send] raw message state:', JSON.stringify(message));
      if (!message.trim() || sending) return;

      const trimmedMessage = message.trim();
      console.log('[Send] trimmedMessage:', JSON.stringify(trimmedMessage));
      const now = new Date().toISOString();

      const optimisticMessage = {
        id: tempId,
        content: trimmedMessage,
        created_at: now,
        created_at_human: formatMessageTime(now, t),
        is_myself: true,
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
    // Only persisted messages (numeric backend id) can be reacted to - optimistic
    // messages still carry a string tempId while the upload/send is in flight.
    if (!item || typeof item.id !== "number") return;

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

  const handleCopyMessage = () => {
    const item = reactionPicker.message;
    closeReactionPicker();
    if (!item) return;

    const textToCopy = item.content || "";
    if (!textToCopy) return;
    Clipboard.setString(textToCopy);
    Toast.show({ type: "success", text1: t("chatConversation.copied", "Đã sao chép") });
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

    const previousReactions = message.reactions;
    applyReactionUpdate(message.id, buildOptimisticReaction(message, type));

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

  const renderReactionBadge = (item) => {
    // Reactions aren't available yet for a message still in flight.
    if (typeof item.id !== "number") return null;

    const reactions = item.reactions;
    const hasReactions = reactions && reactions.total > 0;

    // For my messages: row anchored at bottom-left → [...] [👍]
    // For theirs: row anchored at bottom-right → [👍] [...]
    const rowAnchor = item.is_myself
      ? { left: -6 }
      : { right: -6 };

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
        onPress={(evt) => openReactionPicker(item, evt)}
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
        onPress={() => setReactionModal({ visible: true, reactions })}
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
    const children = item.is_myself
      ? [dotsBtn, pill]
      : [pill, dotsBtn];

    return (
      <View
        style={[
          styles.reactionBadgeRow,
          rowAnchor,
        ]}
      >
        {children}
      </View>
    );
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

  const openImageViewer = (uri) => setImageViewer({ visible: true, uri });
  const openVideoViewer = (uri) => setVideoViewer({ visible: true, uri });

  // react-native-image-viewing's default header positions the close button
  // with RN's own <SafeAreaView>, which is an iOS-only no-op - on Android it
  // applies no top inset at all, so the button sits right under (behind) the
  // status bar and can't be tapped. Supply our own header using the safe
  // area insets we already have.
  const ImageViewerHeader = () => (
    <View style={{ paddingTop: insets.top + 8, paddingRight: 12, alignItems: "flex-end" }}>
      <TouchableOpacity
        onPress={() => setImageViewer({ visible: false, uri: null })}
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

  const renderMessage = (itemOrInfo, indexArg, prevArg, nextArg) => {
    // Array.map passes the message directly, while FlatList passes { item, index }.
    const item = itemOrInfo?.item ?? itemOrInfo;
    const index = itemOrInfo?.item ? itemOrInfo.index : indexArg;

    if (!item) {
      return null;
    }

    if (item.type === "date") {
      return (
        <View
          style={styles.dateHeaderContainer}
          key={item.is_myself ? "my" + item.id : "their" + item.id}
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
            {item.date}
          </Text>
        </View>
      );
    }

    if (item.type === "time") {
      return (
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
            {item.time}
          </Text>
        </View>
      );
    }

    // Check if this is a group chat
    const isGroupChat = currentConversation?.type === "group";

    // prevArg/nextArg are pre-computed message neighbours passed from the map
    // site, so we avoid an O(n) scan inside every renderMessage call.
    const prevMessage = prevArg !== undefined ? prevArg : (() => {
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i].type !== "date" && messages[i].type !== "time") return messages[i];
      }
      return null;
    })();

    const nextMessage = nextArg !== undefined ? nextArg : (() => {
      for (let i = index + 1; i < messages.length; i++) {
        if (messages[i].type !== "date" && messages[i].type !== "time") return messages[i];
      }
      return null;
    })();

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

    const isFirstInGroup =
      index === 0 || !prevMessage || prevMessage.is_myself !== item.is_myself;

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
    const isImageMessage =
      item.type === "image" || item.content_type === "image";
    const isVideoMessage =
      item.type === "video" || item.content_type === "video";
    const isFileMessage = item.type === "file" || item.content_type === "file";
    const resolvedFileUrl = resolveMediaUrl(item.file_url);
    const resolvedThumbnailUrl = resolveMediaUrl(item.metadata?.thumbnail_url);

    const handleSwipeReply = () => {
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
            <Image
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
                { maxWidth: undefined },
                isImageMessage || isVideoMessage
                  ? styles.imageMessageBubble
                  : isFileMessage
                    ? styles.fileMessageBubble
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
              onLongPress={(evt) => openReactionPicker(item, evt)}
              delayLongPress={350}
              onPress={
                item.is_recalled ? undefined : () => {
                  const now = Date.now();
                  const lastTap = lastTapRef.current[item.id] || 0;
                  if (now - lastTap < 300) {
                    handleDoubleTapMessage(item);
                  } else {
                    lastTapRef.current[item.id] = now;
                    if (isImageMessage && resolvedFileUrl) {
                      openImageViewer(resolvedFileUrl);
                    } else if (isVideoMessage && resolvedFileUrl) {
                      openVideoViewer(resolvedFileUrl);
                    } else if (isFileMessage && resolvedFileUrl) {
                      handleOpenFile(item);
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
                  onPress={() => handleJumpToRepliedMessage(item.reply_to.id)}
                />
              )}
              {!item.is_recalled && isImageMessage && item.file_url ? (
                <>
                  {mediaLoadErrors[item.id] ? (
                    <View style={[styles.messageImage, styles.mediaErrorFallback]}>
                      <Ionicons name="image-outline" size={28} color="#fff" />
                      <Text style={styles.mediaErrorText} numberOfLines={2}>
                        {t("chatConversation.loadImageError", "Không tải được ảnh")}
                        {"\n"}
                        {mediaLoadErrors[item.id]}
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: resolvedFileUrl }}
                      style={styles.messageImage}
                      resizeMode={"cover"}
                      onError={(e) => {
                        const reason = e?.nativeEvent?.error || "unknown error";
                        console.error("[ChatMedia] image FAILED to load", {
                          id: item.id,
                          raw_file_url: item.file_url,
                          resolved: resolvedFileUrl,
                          reason,
                        });
                        setMediaLoadErrors((prev) => ({ ...prev, [item.id]: reason }));
                      }}
                    />
                  )}
                  {item.is_sending && (
                    <View style={styles.imageLoadingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </>
              ) : !item.is_recalled && isVideoMessage ? (
                <>
                  {resolvedThumbnailUrl ? (
                    <Image
                      source={{ uri: resolvedThumbnailUrl }}
                      style={styles.messageImage}
                      resizeMode={"cover"}
                      onError={undefined}
                    />
                  ) : (
                    <View style={[styles.messageImage, styles.videoPlaceholder]} />
                  )}
                  <View style={styles.videoPlayOverlay}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                  {item.is_sending && (
                    <View style={styles.imageLoadingOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                </>
              ) : !item.is_recalled && isFileMessage ? (
                <View style={styles.fileMessageContent}>
                  <View style={styles.fileIconWrapper}>
                    {downloadingFileId === item.id ? (
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
                        ? t("chatConversation.sending", "Đang gửi...")
                        : downloadingFileId === item.id
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
                  onMentionPress={(username) =>
                    navigation.navigate("ProfileScreen", { username })
                  }
                >
                  {item.content}
                </MentionText>
              ) : null}
            </Pressable>
            {renderReactionBadge(item)}
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
            {item.is_myself && (
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
          </View>
        )}
      </View>
      </SwipeableMessage>
    );
  };

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
          <LiquidButton size={ICON_BUTTON_SIZE} providerId="ConversationScreen" onPress={safeGoBack}>
            <Ionicons name="chevron-back" size={22} color={theme.primary} />
          </LiquidButton>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} pointerEvents="box-none">
            <LiquidButton
              onPress={() =>
                currentConversation?.type !== "group" &&
                navigation.navigate("ProfileScreen", { username: otherUser?.username })
              }
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
                      ? currentConversation?.name
                          ?.trim()
                          .normalize("NFC")
                          .toLowerCase() === "tán gẫu linh tinh"
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

          <LiquidButton size={ICON_BUTTON_SIZE} providerId="ConversationScreen" onPress={showOptions}>
            <Ionicons name="ellipsis-vertical" size={22} color={theme.primary} />
          </LiquidButton>
        </View>
      </View>
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />

      <ImageView
        images={imageViewer.uri ? [{ uri: imageViewer.uri }] : []}
        imageIndex={0}
        visible={imageViewer.visible}
        onRequestClose={() => setImageViewer({ visible: false, uri: null })}
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
        onReply={reactionPicker.message?.is_recalled ? undefined : handleReplyToMessage}
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
        onClose={closeReactionPicker}
      />

      {/* (profile block and floating button moved into header) */}

      <KeyboardGestureArea
        interpolator="ios"
        style={{ flex: 1 }}
        textInputNativeID="chat-input"
      >
        {/* Messages List */}
        <AndroidGlassBackdrop providerId="ConversationScreen" style={{ flex: 1 }}>
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
          {(() => {
            // Pre-compute nearest real-message neighbours for each item so
            // renderMessage doesn't have to O(n)-scan the array itself.
            const realMessages = [];
            messages.forEach((m, i) => {
              if (m.type !== "date" && m.type !== "time") realMessages.push({ m, i });
            });
            const realIdxOf = new Map(realMessages.map(({ m, i }, ri) => [i, ri]));

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
                  if (messages[i].type !== "date" && messages[i].type !== "time") { prev = messages[i]; break; }
                }
                for (let i = index + 1; i < messages.length; i++) {
                  if (messages[i].type !== "date" && messages[i].type !== "time") { next = messages[i]; break; }
                }
              }

              return (
                <View
                  key={`${value.type}-${value.id}-${index}`}
                  onLayout={(e) => {
                    if (value.type === "message" && value.id != null) {
                      messageLayoutOffsetsRef.current[value.id] =
                        e.nativeEvent.layout.y;
                      if (pendingHighlightMessageIdRef.current === value.id) {
                        attemptScrollToHighlight();
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
                  {renderMessage(value, index, prev, next)}
                </View>
              );
            });
          })()}
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
        </AndroidGlassBackdrop>

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
          offset={{ opened: 20 }}
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
                messageMentionProps.onChangeText(text);
                sendTyping(currentConversationId || conversationId);
              }}
              value={message}
              inMentionMode={messageInMentionMode}
              disabled={!message.trim() || sending}
              isSubmitting={sending}
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
      </KeyboardGestureArea>
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
  messageText: {
    fontSize: 16,
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
