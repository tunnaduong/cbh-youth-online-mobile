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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
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
} from "../../../services/api/Api";
import ReportModal from "../../../components/ReportModal";
import CommentBar from "../../../components/CommentBar";
import MessageReactionPicker, {
  REACTION_EMOJI_BY_TYPE,
} from "../../../components/MessageReactionPicker";
import { Alert, ActionSheetIOS, KeyboardAvoidingView } from "react-native";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import "dayjs/locale/ru";
import { storage } from "../../../global/storage";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
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

const ConversationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const BUTTON_SIZE = 47;
  // Back/3-dot buttons are plain icon buttons (no label), so they read as
  // oversized next to the center profile pill at the same BUTTON_SIZE - keep
  // the pill's height but shrink just the two icon buttons.
  const ICON_BUTTON_SIZE = 40;
  const HEADER_HEIGHT = BUTTON_SIZE + 14 + insets.top;
  const CENTER_MAX_WIDTH = Dimensions.get("window").width - ICON_BUTTON_SIZE * 2 - 32;
  // Reserve space for avatar + small gap inside the pill so text never pushes avatar out
  const AVATAR_WRAPPER_SIZE = 40;
  const CENTER_TEXT_MAX = Math.max(80, CENTER_MAX_WIDTH - (AVATAR_WRAPPER_SIZE + 12));
  const isAndroid = Platform.OS === "android";
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    dayjs.locale(i18n.language || "vi");
  }, [i18n.language]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const inputRef = useRef(null);
  const messagesScrollRef = useRef(null);
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
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const { t } = useTranslation();
  const {
    onMessageSent,
    onMessageRead,
    onMessageDeleted,
    onMessageReacted,
    onTyping,
    sendTyping,
  } = useChatSocket();
  const [typingUser, setTypingUser] = useState(null);
  const typingTimeoutRef = useRef(null);
  const [imageViewer, setImageViewer] = useState({ visible: false, uri: null });
  const [videoViewer, setVideoViewer] = useState({ visible: false, uri: null });
  const [reactionPicker, setReactionPicker] = useState({
    visible: false,
    message: null,
    anchor: null,
  });
  // DEBUG: id -> error string, for surfacing why an image/video thumbnail
  // failed to load directly in the bubble instead of just going blank.
  const [mediaLoadErrors, setMediaLoadErrors] = useState({});
  const [downloadingFileId, setDownloadingFileId] = useState(null);

  // Keep the header visually light until the user scrolls enough.
  // This mirrors the other screens: the back button stays visible, while the
  // profile/title area fades in only after scrolling.
  const scrollY = useRef(new Animated.Value(0)).current;

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
                [{ text: t("common.ok"), onPress: () => navigation.goBack() }],
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
            (c) => c.id === conversationId,
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
  });

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
    const unsubscribeSent = onMessageSent(activeId, refreshAndScroll);
    const unsubscribeRead = onMessageRead(activeId, refresh);
    const unsubscribeDeleted = onMessageDeleted(activeId, refresh);
    const unsubscribeTyping = onTyping(activeId, handleTyping);
    const unsubscribeReacted = onMessageReacted(activeId, handleReacted);

    return () => {
      unsubscribeSent();
      unsubscribeRead();
      unsubscribeDeleted();
      unsubscribeTyping();
      unsubscribeReacted();
      clearTimeout(typingTimeoutRef.current);
      setTypingUser(null);
    };
  }, [
    isNewConversation,
    currentConversationId,
    conversationId,
    onMessageSent,
    onMessageRead,
    onMessageDeleted,
    onMessageReacted,
    onTyping,
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

  const attemptScrollToHighlight = () => {
    const targetId = pendingHighlightMessageIdRef.current;
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
    pendingHighlightMessageIdRef.current = null;
    setTimeout(() => setHighlightedMessageId(null), 2500);
    return true;
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
  };

  const pickImage = async () => {
    try {
      // Launch the combined image/video picker - the same attach button handles both.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.type === "video") {
          await sendVideoMessage(asset);
        } else {
          await sendImageMessage(asset.uri);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("chatConversation.sendImageError"),
      });
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

  // Mobile OS clipboards only ever carry text/HTML or a raster image - there's
  // no cross-app "copy this video/file" primitive on iOS or Android the way
  // there is on desktop, so genuine video/file paste isn't something this (or
  // any) app can support. This covers what actually is possible: an image
  // copied from the gallery/another app/a keyboard's image picker, pasted and
  // sent immediately (no extra tap), same as the attach buttons. As a bonus,
  // if some other app put a local media file's path on the clipboard as
  // plain text (some file managers do this instead of real image data), that
  // gets picked up too - video included, in that one case.
  const pasteFromClipboard = async () => {
    try {
      const hasImage = await Clipboard.hasImageAsync();
      if (hasImage) {
        const clipboardImage = await Clipboard.getImageAsync({ format: "png" });
        if (clipboardImage?.data) {
          const base64 = clipboardImage.data.split(",").pop();
          const fileUri = `${FileSystem.cacheDirectory}pasted_${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await sendImageMessage(fileUri);
          return;
        }
      }

      const hasString = await Clipboard.hasStringAsync();
      if (hasString) {
        const text = (await Clipboard.getStringAsync())?.trim();
        const isLocalMediaFile = /^(file|content):\/\/.+\.(jpe?g|png|gif|webp|heic|mp4|mov|avi|webm|mkv)$/i.test(
          text || "",
        );
        if (isLocalMediaFile) {
          const isVideo = /\.(mp4|mov|avi|webm|mkv)$/i.test(text);
          if (isVideo) {
            await sendVideoMessage({ uri: text, fileName: text.split("/").pop() });
          } else {
            await sendImageMessage(text);
          }
          return;
        }
      }

      Toast.show({
        type: "info",
        text1: t("chatConversation.pasteNothingTitle", "Không có gì để dán"),
        text2: t(
          "chatConversation.pasteNothingBody",
          "Chỉ hỗ trợ dán ảnh từ clipboard.",
        ),
      });
    } catch (error) {
      console.error("Error pasting from clipboard:", error);
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("chatConversation.pasteError", "Không thể dán từ clipboard."),
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
      };

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

  const handleSendMessage = async () => {
    scrollToLatestMessageAnimated();
    const tempId = Date.now().toString();
    try {
      if (!message.trim() || sending) return;

      const trimmedMessage = message.trim();
      const now = new Date().toISOString();
      console.log("[Debug] Starting to send message:", {
        trimmedMessage,
        isNewConversation,
        selectedUser: selectedUser?.id,
        currentConversationId,
      });

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
      };

      // Clear input immediately
      setMessage("");

      console.log("[Debug] Adding optimistic message:", optimisticMessage);

      // Add time header if needed and optimistic message
      setMessages((prev) => {
        console.log("[Debug] Current messages:", prev);
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
        const result = [...newMessages, ...messagesToAdd];
        console.log("[Debug] Updated messages with optimistic:", result);
        return result;
      });

      setSending(true);

      let response;
      if (isNewConversation) {
        // Create conversation first
        console.log(
          "[Debug] Creating new conversation for user:",
          selectedUser?.id,
        );
        const createResponse = await createConversation(selectedUser.id);
        console.log(
          "[Debug] Create conversation response:",
          createResponse.data,
        );

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

        // Then send message
        console.log(
          "[Debug] Sending first message to new conversation:",
          newConversationId,
        );
        response = await sendMessage(newConversationId, {
          content: trimmedMessage,
          type: "text",
        });
        console.log("[Debug] Send message response:", response.data);

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
        console.log(
          "[Debug] Sending message to existing conversation:",
          currentConversationId,
        );
        response = await sendMessage(currentConversationId, {
          content: trimmedMessage,
          type: "text",
        });
        console.log("[Debug] Send message response:", response.data);
      }

      // Replace optimistic message with real one and update storage
      setMessages((prev) => {
        console.log(
          "[Debug] Replacing optimistic message. Current messages:",
          prev,
        );
        // First, get all messages except the temporary ones
        const baseMessages = prev.filter((msg) => {
          // Check if msg and msg.id exist before using includes
          if (!msg || !msg.id || typeof msg.id !== "string") {
            console.log("[Debug] Found invalid message:", msg);
            return true;
          }
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
        const updatedMessages = [...baseMessages, ...messagesToAdd];
        console.log("[Debug] Final messages after update:", updatedMessages);
        return updatedMessages;
      });

      // Update cached messages
      const cachedData = storage.getString(getCacheKey(currentConversationId));
      console.log("[Debug] Current cache for conversation:", {
        conversationId: currentConversationId,
        hasCachedData: !!cachedData,
      });

      if (cachedData) {
        try {
          const cachedMessages = JSON.parse(cachedData);
          cachedMessages.push(response.data);
          storage.set(
            getCacheKey(currentConversationId),
            JSON.stringify(cachedMessages),
          );
          storage.set(getTimestampKey(currentConversationId), Date.now());
          console.log("[Debug] Cache updated successfully");
        } catch (error) {
          console.error("[Debug] Cache update error:", error);
        }
      }
    } catch (error) {
      console.error("[Debug] Error in handleSendMessage:", {
        error: error.response?.data || error,
        tempId,
        isNewConversation,
        selectedUser: selectedUser?.id,
        currentConversationId,
      });

      setMessages((prev) => {
        console.log("[Debug] Removing failed message. Current messages:", prev);
        return prev.filter((msg) => {
          if (!msg || !msg.id || typeof msg.id !== "string") return true;
          return !msg.id.includes(tempId);
        });
      });

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
    const current = message.reactions || { summary: [], total: 0, my_reaction: null };
    const prevMine = current.my_reaction;
    let summary = (current.summary || []).map((s) => ({ ...s }));

    if (prevMine) {
      summary = summary
        .map((s) => (s.type === prevMine ? { ...s, count: Math.max(0, s.count - 1) } : s))
        .filter((s) => s.count > 0);
    }

    const existing = summary.find((s) => s.type === type);
    if (existing) {
      existing.count += 1;
    } else {
      summary.push({ type, count: 1, users: [] });
    }

    return {
      summary,
      total: summary.reduce((sum, s) => sum + s.count, 0),
      my_reaction: type,
    };
  };

  const buildOptimisticRemove = (message) => {
    const current = message.reactions || { summary: [], total: 0, my_reaction: null };
    if (!current.my_reaction) return current;

    const summary = (current.summary || [])
      .map((s) => (s.type === current.my_reaction ? { ...s, count: Math.max(0, s.count - 1) } : s))
      .filter((s) => s.count > 0);

    return {
      summary,
      total: summary.reduce((sum, s) => sum + s.count, 0),
      my_reaction: null,
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

  const handleRemoveReaction = async () => {
    const message = reactionPicker.message;
    closeReactionPicker();
    if (!message || !message.reactions?.my_reaction) return;

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
    const sideStyle = item.is_myself ? { left: -6 } : { right: -6 };

    if (!hasReactions) {
      return (
        <TouchableOpacity
          onPress={(evt) => openReactionPicker(item, evt)}
          style={[
            styles.reactionAddBadge,
            sideStyle,
            {
              backgroundColor: isDarkMode ? "#262626" : "#ffffff",
              borderColor: theme.border,
            },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="happy-outline" size={13} color={theme.subText} />
        </TouchableOpacity>
      );
    }

    const topEmoji =
      [...reactions.summary].sort((a, b) => b.count - a.count)[0]?.type;

    return (
      <TouchableOpacity
        onPress={(evt) => openReactionPicker(item, evt)}
        style={[
          styles.reactionPillBadge,
          sideStyle,
          {
            backgroundColor: isDarkMode ? "#262626" : "#ffffff",
            borderColor: reactions.my_reaction ? theme.primary : theme.border,
            borderWidth: reactions.my_reaction ? 1.5 : 1,
          },
        ]}
      >
        <Text style={styles.reactionPillEmoji}>
          {REACTION_EMOJI_BY_TYPE[topEmoji] || "👍"}
        </Text>
        {reactions.total > 1 && (
          <Text style={[styles.reactionPillCount, { color: theme.subText }]}>
            {reactions.total}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // Media viewers -------------------------------------------------------------

  const openImageViewer = (uri) => {
    console.log("[ChatMedia] openImageViewer", { uri });
    setImageViewer({ visible: true, uri });
  };
  const openVideoViewer = (uri) => {
    console.log("[ChatMedia] openVideoViewer", { uri });
    setVideoViewer({ visible: true, uri });
  };

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

  const renderMessage = (itemOrInfo, indexArg) => {
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

    // Get previous and next messages (skip date/time headers)
    let prevMessage = null;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].type !== "date" && messages[i].type !== "time") {
        prevMessage = messages[i];
        break;
      }
    }

    let nextMessage = null;
    for (let i = index + 1; i < messages.length; i++) {
      if (messages[i].type !== "date" && messages[i].type !== "time") {
        nextMessage = messages[i];
        break;
      }
    }

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

    return (
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
                isImageMessage && resolvedFileUrl
                  ? () => openImageViewer(resolvedFileUrl)
                  : isVideoMessage && resolvedFileUrl
                    ? () => openVideoViewer(resolvedFileUrl)
                    : isFileMessage && resolvedFileUrl
                      ? () => handleOpenFile(item)
                      : undefined
              }
            >
              {isImageMessage && item.file_url ? (
                <>
                  {console.log("[ChatMedia] rendering image", {
                    id: item.id,
                    raw_file_url: item.file_url,
                    resolved: resolvedFileUrl,
                  })}
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
                      onLoad={() =>
                        console.log("[ChatMedia] image loaded OK", {
                          id: item.id,
                          resolved: resolvedFileUrl,
                        })
                      }
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
              ) : isVideoMessage ? (
                <>
                  {console.log("[ChatMedia] rendering video", {
                    id: item.id,
                    raw_file_url: item.file_url,
                    resolved_file_url: resolvedFileUrl,
                    raw_metadata: item.metadata,
                    resolved_thumbnail: resolvedThumbnailUrl,
                  })}
                  {resolvedThumbnailUrl ? (
                    <Image
                      source={{ uri: resolvedThumbnailUrl }}
                      style={styles.messageImage}
                      resizeMode={"cover"}
                      onError={(e) =>
                        console.error("[ChatMedia] video thumbnail FAILED to load", {
                          id: item.id,
                          resolved_thumbnail: resolvedThumbnailUrl,
                          reason: e?.nativeEvent?.error,
                        })
                      }
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
              ) : isFileMessage ? (
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
              ) : (
                <Text
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
                >
                  {item.content}
                </Text>
              )}
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
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
          <LiquidButton size={ICON_BUTTON_SIZE} providerId="ConversationScreen" onPress={() => navigation.goBack()}>
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
              <View style={[styles.headerTextContainer, { maxWidth: CENTER_TEXT_MAX, flexShrink: 1 }]}> 
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
                    : "@" + otherUser?.username || ""}
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

      <MessageReactionPicker
        visible={reactionPicker.visible}
        anchor={reactionPicker.anchor}
        currentReaction={reactionPicker.message?.reactions?.my_reaction}
        onSelect={handleSelectReaction}
        onRemove={handleRemoveReaction}
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
          onContentSizeChange={handleMessagesContentSizeChange}
        >
          {messages.map((value, index) => (
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
              {renderMessage(value, index)}
            </View>
          ))}
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
                setMessage(text);
                sendTyping(currentConversationId || conversationId);
              }}
              value={message}
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
                  <TouchableOpacity
                    style={[styles.attachButton, { marginLeft: 6 }]}
                    onPress={pasteFromClipboard}
                    disabled={sending}
                  >
                    <Ionicons
                      name="clipboard-outline"
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
  headerAvatarWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    backgroundColor: "transparent",
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
  reactionAddBadge: {
    position: "absolute",
    bottom: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionPillBadge: {
    position: "absolute",
    bottom: -12,
    minWidth: 32,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  reactionPillEmoji: {
    fontSize: 13,
  },
  reactionPillCount: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 3,
  },
});

export default ConversationScreen;
