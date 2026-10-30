import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  BackHandler,
  AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import ImageView from "react-native-image-viewing";
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
  getGroupDetails,
  addGroupDeputy,
  removeGroupDeputy,
  removeGroupParticipant,
} from "../../../services/api/Api";
import ReportModal from "../../../components/ReportModal";
import ChatBackgroundModal from "../../../components/ChatBackgroundModal";
import MessageReactionPicker, { REACTION_EMOJI_BY_TYPE } from "../../../components/MessageReactionPicker";
import { downloadMediaToLibrary } from "../../../utils/mediaDownload";
import ForwardMessageModal from "../../../components/ForwardMessageModal";
import { Alert, ActionSheetIOS, Clipboard } from "react-native";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import "dayjs/locale/ru";
import { storage } from "../../../global/storage";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
import { isPublicGroupChat } from "../../../utils/chatHelpers";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { compressVideoForUpload } from "../../../utils/mediaCompression";
import { beginUpload } from "../../../services/uploadQueue";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Api from "../../../services/api/ApiByAxios";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  KeyboardChatScrollView,
  KeyboardGestureArea,
  KeyboardController,
  AndroidSoftInputModes,
} from "react-native-keyboard-controller";
import {
  resolveMediaUrl,
  CONVERSATION_CACHE_KEY,
  CONVERSATION_TIMESTAMP_KEY,
  CACHE_EXPIRY,
  ATTACHMENT_UPLOAD_CONFIG,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_FILE_BYTES,
  formatBytesForToast,
  formatMessageTime,
  injectTimeHeaders,
  reuseUnchanged,
} from "./conversation/chatUtils";
import { VideoViewerModal } from "./conversation/VideoViewerModal";
import { styles } from "./conversation/styles";
import { MessagesListContent } from "./conversation/MessagesListContent";
import ConversationHeader, { CHAT_HEADER_BAR_HEIGHT } from "./conversation/ConversationHeader";
import ChatComposer, { CHAT_COMPOSER_DEFAULT_HEIGHT } from "./conversation/ChatComposer";
import SeenByModal from "./conversation/SeenByModal";
import TypingIndicator from "./conversation/TypingIndicator";

const ConversationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  // Flat header bar under the status bar (see ConversationHeader).
  const HEADER_HEIGHT = CHAT_HEADER_BAR_HEIGHT + insets.top;
  const isAndroid = Platform.OS === "android";
  // The composer's text lives in ChatComposer (typing re-renders only it);
  // this ref always holds what the input shows, and composerRef changes it.
  const latestMessageRef = React.useRef("");
  const composerRef = useRef(null);
  // Measured height of the composer bar, for the list's bottom padding.
  const [composerHeight, setComposerHeight] = useState(CHAT_COMPOSER_DEFAULT_HEIGHT + insets.bottom);
  const [messages, setMessagesRaw] = useState([]);
  // Every update of the list goes through reuseUnchanged: entries whose
  // content did not change keep the object already on screen (and the whole
  // array is kept when nothing changed), so the memoized rows skip
  // themselves. Refetches otherwise replaced every message with a fresh copy
  // and re-rendered every bubble after each incoming message or read receipt.
  const setMessages = React.useCallback((update) => {
    setMessagesRaw((prev) =>
      reuseUnchanged(prev, typeof update === "function" ? update(prev) : update)
    );
  }, []);
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

  // Android: the message bar is a KeyboardStickyView, moved by
  // react-native-keyboard-controller. The app's window is in "pan" mode
  // (app.json), in which the library is not told when an OPEN keyboard
  // changes height - so the bar stayed where the taller keyboard had put it.
  // "Resize" is the mode the library is built for; it is switched on for
  // this screen only and handed back when leaving. iOS has no such mode.
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      try {
        KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_RESIZE);
      } catch {}
      return () => {
        try {
          KeyboardController.setDefaultMode();
        } catch {}
      };
    }, [])
  );

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
  // The same two values for code that runs across several awaits (loading
  // page after page while looking for a message): state is frozen in the
  // closure that started the loop, so it asked for the same page every time.
  // fetchMessages reads and writes these; the state mirrors them for the UI.
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  // Every loaded message is always rendered - unlike the old approach here
  // (manually slicing `messages` to a JS-estimated "window" based on scroll
  // position, unmounting/remounting rows as that estimate crossed
  // thresholds), which caused visible stutter: the estimate was only ever
  // an average height guess, so it frequently mounted/unmounted rows mid-
  // gesture, changing the ScrollView's content height while a scroll was in
  // progress. `removeClippedSubviews` used to do the equivalent job at the
  // native view layer instead (real, measured clipping, no JS-estimated
  // thresholds), but it's now disabled - see the comment on it below - so
  // every mounted row really does just stay mounted, full stop.
  const visibleMessages = messages;
  // Autoplay's "which video is centered" check (handleMessagesScroll below)
  // used to scan messageLayoutOffsetsRef - which keeps a layout entry for
  // every message ever mounted, growing unbounded as history is scrolled -
  // on every single onScroll frame (throttled to 16ms, i.e. up to 60x/sec).
  // For an all-text conversation that's a full ref scan every frame for
  // zero benefit, and it gets slower the longer someone scrolls back -
  // exactly the "scrolling gets janky the further you go" symptom. Narrow
  // the scan to just the (usually empty, always small) set of video message
  // ids so there's nothing to do at all in the common no-video case.
  const videoMessageIdsKey = useMemo(
    () =>
      messages
        .filter((m) => m.type === "video" || m.content_type === "video")
        .map((m) => String(m.id))
        .join(","),
    [messages],
  );
  const videoMessageIds = useMemo(
    () => (videoMessageIdsKey ? videoMessageIdsKey.split(",") : []),
    [videoMessageIdsKey],
  );
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
  // Prepending older messages at the top grows content ABOVE the current
  // viewport - a plain (non-inverted) ScrollView doesn't compensate for
  // that on its own, so the same messages the user was reading jump
  // downward by however tall the newly-added page is, and offsetY stays
  // pinned near 0 ("isNearTop") the whole time, re-triggering another
  // "load more" immediately. Set right before fetchMessages(false) fires
  // from pagination; consumed once in onContentSizeChange to scroll by
  // the height actually added, landing the user back where they were
  // instead of still sitting at the very top edge.
  const pendingLoadMoreAdjustRef = useRef(null);
  // Clears pendingLoadMoreAdjustRef a beat after the last height-growth
  // event, instead of after just the first one - see onContentSizeChange.
  const pendingLoadMoreAdjustTimeoutRef = useRef(null);
  const isFocused = useIsFocused();
  // For handlers that outlive a render (socket, timers, AppState).
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const pendingHighlightMessageIdRef = useRef(highlightMessageId ?? null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [sending, setSending] = useState(false);
  const { username, profileName, blockUserInContext } = useContext(AuthContext);
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
  const [reportMessageTarget, setReportMessageTarget] = useState(null);
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
  // Keyed by user_id so multiple people (or the AI) can show as typing at
  // once instead of the most recent one clobbering everyone else.
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutsRef = useRef({});
  // A busy conversation can fire onMessageSent/onMessageRead/onMessageDeleted
  // several times within milliseconds of each other (a burst of replies, or
  // a group where everyone's "read" receipt lands at once) - each one used
  // to trigger its own full fetchMessages(true, true) round trip (network
  // request + JSON.stringify diff + injectTimeHeaders over the whole list),
  // all synchronous JS-thread work. A burst of those overlapping was enough
  // to visibly stall the UI thread - including eating scroll gesture frames,
  // which is what made scrolling feel like it "stuck" - right as new
  // messages were coming in. Coalescing a burst into one trailing fetch
  // keeps the eventual-consistency behavior (nothing here skips reconciling
  // with the server) while cutting that repeated work down to once per lull.
  const backgroundRefreshTimerRef = useRef(null);
  const backgroundRefreshWantsScrollRef = useRef(false);
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollContentHeightRef = useRef(0);
  const scrollViewHeightRef = useRef(0);

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

  // `afterBlock` defaults to the original behavior (this screen only ever
  // had one other person to block: the private chat's own otherUser, after
  // which the conversation itself is moot, hence navigating back). Blocking
  // someone spotted via their avatar in a group (see openSenderActions
  // below) shouldn't leave the group's conversation - it passes its own
  // afterBlock that just toasts instead.
  const confirmBlock = (targetUser = otherUser, afterBlock) => {
    if (!targetUser) return;
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
              await blockUser(targetUser.id);
              // Keep the local blocked list in sync so the feed/story/chat
              // list filters apply immediately, not only after next launch.
              if (targetUser.username && blockUserInContext) {
                await blockUserInContext(targetUser.username);
              }
              if (afterBlock) {
                afterBlock();
              } else {
                Alert.alert(
                  t("chatConversation.blockedTitle"),
                  t("chatConversation.blockedBody"),
                  [{ text: t("common.ok"), onPress: safeGoBack }],
                );
              }
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

  // Same {text, onPress, style} option list either way - iOS gets a real
  // native ActionSheet, Android falls back to Alert.alert (see the
  // Alert.alert = CustomAlert.alert override at the top of App.js, which is
  // what lets more than the usual 2-3 Android AlertDialog buttons stack
  // into a real scrollable list here).
  const showActionList = (title, options) => {
    if (Platform.OS === "ios") {
      const cancelButtonIndex = options.findIndex((o) => o.style === "cancel");
      const destructiveButtonIndex = options
        .map((o, i) => (o.style === "destructive" ? i : -1))
        .filter((i) => i >= 0);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: options.map((o) => o.text),
          cancelButtonIndex: cancelButtonIndex >= 0 ? cancelButtonIndex : undefined,
          destructiveButtonIndex,
        },
        (index) => options[index]?.onPress?.(),
      );
    } else {
      Alert.alert(title, null, options);
    }
  };

  // Messenger-style per-sender action sheet, opened by tapping the small
  // avatar next to someone else's message bubble (see MessageRow below).
  // Only ever offers actions this app actually has - no calling, no
  // Facebook profile link, nothing that isn't a real feature here.
  const openSenderActions = async (sender) => {
    // This is a per-USER action sheet - Yoyo AI isn't a real participant
    // (can't be messaged-as-a-new-conversation from here since it already
    // has its own dedicated entry point, can't be blocked/managed as a
    // group member), so tapping its avatar is a no-op.
    if (!sender?.id || sender.is_ai) return;

    const name = sender.profile_name || sender.username || t("chatConversation.anonymous");
    const isGroup = currentConversation?.type === "group";
    const activeId = currentConversationId || conversationId;

    const goToProfile = () => navigation.navigate("ProfileScreen", { username: sender.username });

    const goToMessage = async () => {
      try {
        const response = await getConversations();
        const existing = (response?.data || []).find(
          (conv) =>
            conv.type === "private" &&
            conv.participants?.some((p) => p.id === sender.id),
        );
        if (existing) {
          navigation.push("ConversationScreen", {
            conversation: existing,
            conversationId: existing.id,
          });
          return;
        }
      } catch (e) {
        // Fall through to starting a new conversation below, same as
        // ProfileScreen's own Message button.
      }
      navigation.push("ConversationScreen", {
        isNewConversation: true,
        selectedUser: {
          id: sender.id,
          profile_name: sender.profile_name,
          avatar_url: sender.avatar_url,
          username: sender.username,
        },
      });
    };

    const options = [];

    // Doesn't apply in a private 1-1 - we're already messaging this exact
    // person, there's nowhere else to send "Message" to.
    if (currentConversation?.type !== "private") {
      options.push({ text: t("follow.message", "Nhắn tin"), onPress: goToMessage });
    }
    options.push({ text: t("chatConversation.viewProfile", "Xem trang cá nhân"), onPress: goToProfile });

    if (isGroup && activeId) {
      try {
        const res = await getGroupDetails(activeId);
        const group = res?.data;
        const participant = group?.participants?.find((p) => p.id === sender.id);

        if (group && participant && participant.role !== "owner") {
          if (group.is_owner) {
            options.push(
              participant.role === "deputy"
                ? {
                    text: t("chatConversation.removeDeputyAction", "Gỡ vai trò phó nhóm"),
                    onPress: () =>
                      removeGroupDeputy(activeId, sender.id).catch((e) =>
                        Toast.show({
                          type: "error",
                          text1: e.response?.data?.message || t("chatConversation.removeDeputyError", "Không thể gỡ vai trò phó nhóm."),
                        }),
                      ),
                  }
                : {
                    text: t("chatConversation.makeDeputyAction", "Chỉ định làm phó nhóm"),
                    onPress: () =>
                      addGroupDeputy(activeId, sender.id).catch((e) =>
                        Toast.show({
                          type: "error",
                          text1: e.response?.data?.message || t("chatConversation.makeDeputyError", "Không thể chỉ định phó nhóm."),
                        }),
                      ),
                  },
            );
          }

          // Same rule GroupInfoScreen's member list uses to decide whether
          // to even show a "..." button for this member (canAct there): a
          // non-owner deputy may only act on plain members, never on a
          // fellow deputy. perm_remove_members alone doesn't encode that -
          // without this, a deputy could remove another deputy from here,
          // which GroupInfoScreen deliberately prevents.
          const canActOnThisMember = group.is_owner || (group.is_deputy && participant.role === "member");

          if (canActOnThisMember && group.permissions?.can?.perm_remove_members) {
            options.push({
              text: t("chatConversation.removeMemberAction", "Xóa khỏi nhóm"),
              style: "destructive",
              onPress: () => {
                Alert.alert(
                  t("chatConversation.removeMemberTitle", "Xóa thành viên?"),
                  t("chatConversation.removeMemberBody", "{{name}} sẽ bị xóa khỏi nhóm.", { name }),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("chatConversation.removeMemberAction", "Xóa"),
                      style: "destructive",
                      onPress: () =>
                        removeGroupParticipant(activeId, sender.id).catch((e) =>
                          Toast.show({
                            type: "error",
                            text1: e.response?.data?.message || t("chatConversation.removeMemberError", "Không thể xóa thành viên."),
                          }),
                        ),
                    },
                  ],
                );
              },
            });
          }
        }
      } catch (e) {
        // Couldn't load group permissions - just skip the management
        // options rather than failing the whole sheet.
      }
    }

    options.push({
      text: t("chatConversation.blockUser"),
      style: "destructive",
      onPress: () =>
        confirmBlock(sender, () =>
          Toast.show({ type: "success", text1: t("chatConversation.blockedTitle") }),
        ),
    });

    options.push({ text: t("common.cancel"), style: "cancel" });

    showActionList(name, options);
  };

  const handleReportMessage = () => {
    const message = reactionPicker.message;
    closeReactionPicker();
    if (message) setReportMessageTarget(message);
  };

  const handleReportMessageSubmit = async (reason) => {
    const message = reportMessageTarget;
    if (!message) return;

    try {
      await reportUser({
        message_id: message.id,
        reported_user_id: message.sender?.id,
        reason,
      });
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
    const privateConversationId = currentConversationId || conversationId;
    const openGallery = () =>
      navigation.navigate("MediaGalleryScreen", { conversationId: privateConversationId });

    const options = [
      t("chatConversation.gallery", "Bộ sưu tập"),
      t("chatConversation.report"),
      t("chatConversation.changeBackground", "Đổi hình nền"),
      t("chatConversation.blockUser"),
      t("common.cancel"),
    ];
    const destructiveButtonIndex = 3;
    const cancelButtonIndex = 4;

    if (!otherUser) {
      // Group conversation (or the singleton public chat, which has no group management).
      const isPublicChat = isPublicGroupChat(currentConversation);
      const targetConversationId = currentConversationId || conversationId;

      if (isPublicChat) {
        Alert.alert(t("chatConversation.optionsTitle"), null, [
          {
            text: t("chatConversation.gallery", "Bộ sưu tập"),
            onPress: () => navigation.navigate("MediaGalleryScreen", { conversationId: targetConversationId }),
          },
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
          text: t("chatConversation.gallery", "Bộ sưu tập"),
          onPress: () => navigation.navigate("MediaGalleryScreen", { conversationId: targetConversationId }),
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
          if (buttonIndex === 0) openGallery();
          else if (buttonIndex === 1) setReportModalVisible(true);
          else if (buttonIndex === 2) setBackgroundModalVisible(true);
          else if (buttonIndex === 3) confirmBlock();
        },
      );
    } else {
      Alert.alert(t("chatConversation.optionsTitle"), null, [
        {
          text: t("chatConversation.gallery", "Bộ sưu tập"),
          onPress: openGallery,
        },
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
      return currentConversation?.participants?.[0]?.avatar_url;
    }
    if (isPublicGroupChat(currentConversation) || currentConversation?.name === t("chatConversation.casualGroupName")) {
      return "local:chat.jpg";
    }
    if (currentConversation?.type === "group") {
      return currentConversation?.avatar_url || null;
    }
    return currentConversation?.avatar_url || currentConversation?.participants?.[0]?.avatar_url || null;
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
      // Keep the same (already empty) array: a new [] on every run is a new
      // prop for the message list, which then walks every message again.
      setSeenParticipants((prev) => (prev.length ? [] : prev));
      return undefined;
    }

    let cancelled = false;
    const fetchSeen = () => {
      // Not while another screen covers the chat or the app is in the
      // background; the next tick after returning catches up.
      if (!isFocusedRef.current || AppState.currentState !== "active") return;
      getGroupSeenReceipts(activeId)
        .then((res) => {
          if (cancelled) return;
          const next = res.data?.participants || [];
          // The 15-second poll usually returns what is already shown; keep
          // the array we have then, so the message list is left alone.
          setSeenParticipants((prev) =>
            JSON.stringify(prev) === JSON.stringify(next) ? prev : next
          );
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
        pageRef.current = 2;
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
    // How many messages this call brought back (0 also when it failed).
    let loadedCount = 0;
    try {
      if (isRefresh && !isBackground) {
        pageRef.current = 1;
        hasMoreRef.current = true;
        setPage(1);
        setHasMore(true);
      }

      if (!hasMoreRef.current && !isRefresh) return;

      const response = await getConversationMessages(
        currentConversationId || conversationId,
        isRefresh ? 1 : pageRef.current,
      );
      loadedCount = Array.isArray(response.data?.data) ? response.data.data.length : 0;

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
          // The API's pagination is offset-from-the-end (computed off the
          // conversation's current total message count), so if new messages
          // arrive between page fetches, that offset shifts and an "older
          // page" request can come back overlapping what's already loaded -
          // dedupe by id or the same message renders twice.
          const existingIds = new Set(existingMessages.map((m) => m.id));
          const dedupedOlder = newMessages.filter((m) => !existingIds.has(m.id));
          return injectTimeHeaders([...dedupedOlder, ...existingMessages], t);
        });
        hasMoreRef.current = response.data.current_page < response.data.last_page;
        pageRef.current = isRefresh ? 2 : pageRef.current + 1;
        setHasMore(hasMoreRef.current);
        setPage(pageRef.current);
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
        // Nothing was added (empty page, or the request failed): forget the
        // "keep the scroll position" note taken before loading. Left set, the
        // next thing that made the list taller - a new message, the typing
        // bubble - was treated as that older page and yanked the scroll up.
        if (loadedCount === 0) pendingLoadMoreAdjustRef.current = null;
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
  // Read through a ref by the realtime effect below. As a dependency it made
  // that effect tear itself down whenever this callback changed (when the
  // conversation's details load, after the first message of a new chat) -
  // and its cleanup clears the typing timers and the pending refresh, which
  // left a "typing..." bubble stuck and dropped a reconcile fetch.
  const refreshOtherUserOnlineStatusRef = useRef(refreshOtherUserOnlineStatus);
  refreshOtherUserOnlineStatusRef.current = refreshOtherUserOnlineStatus;

  useEffect(() => {
    const activeId = currentConversationId || conversationId;
    if (isNewConversation || !activeId) return undefined;

    // Trailing-debounced background refresh - see backgroundRefreshTimerRef
    // above. `wantsScroll` from any call within the debounce window wins
    // (OR'd together), so a burst that includes a "scroll to latest" request
    // still scrolls once the coalesced fetch actually lands.
    const scheduleBackgroundRefresh = (wantsScroll) => {
      backgroundRefreshWantsScrollRef.current = backgroundRefreshWantsScrollRef.current || wantsScroll;
      clearTimeout(backgroundRefreshTimerRef.current);
      backgroundRefreshTimerRef.current = setTimeout(() => {
        const shouldScroll = backgroundRefreshWantsScrollRef.current;
        backgroundRefreshWantsScrollRef.current = false;
        fetchMessagesRef.current(true, true).then(() => {
          if (shouldScroll) scrollToLatestAndStick();
        });
      }, 400);
    };

    const refresh = () => scheduleBackgroundRefresh(false);

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

    const clearTypingUser = (userId) => {
      clearTimeout(typingTimeoutsRef.current[userId]);
      delete typingTimeoutsRef.current[userId];
      setTypingUsers((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const clearAllTypingUsers = () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};
      setTypingUsers({});
    };

    const refreshAndScroll = (e) => {
      // A real message arrived, so any "typing..." bubble for this conversation is stale.
      clearAllTypingUsers();

      const distanceFromBottom =
        (scrollContentHeightRef.current || 0) -
        (scrollViewHeightRef.current || 0) -
        (scrollOffsetRef.current || 0);
      const isNearBottom = distanceFromBottom <= 150;

      if (tryAppendPushedMessage(e)) {
        if (isNearBottom) scrollToLatestAndStick();
      }

      // Reconciles the optimistic append above with the server's copy -
      // debounced (see scheduleBackgroundRefresh) so a burst of messages
      // coalesces into one fetch instead of one each.
      scheduleBackgroundRefresh(isNearBottom);
      // The screen is open and in front, so this new message is read at once -
      // send a read receipt so the sender's "seen" status keeps updating live.
      // Not when another screen covers this one or the app is in the
      // background: the user has not seen it (it is marked when they return).
      if (isFocusedRef.current && AppState.currentState === "active")
      markConversationAsRead(activeId).catch((error) => {
        console.log(
          "[ConversationScreen] Error marking conversation as read:",
          error?.response?.data || error?.message,
        );
      });
      // Any incoming activity from the other user is a good moment to re-check their online dot.
      refreshOtherUserOnlineStatusRef.current();
    };
    const handleTyping = (data) => {
      if (!data?.user_id) return;

      // Yoyo AI has no client to whisper from - its typing state arrives as
      // a real broadcast (isAi: true) with an explicit start/stop instead of
      // a whisper that just expires on its own.
      if (data.isAi && data.starting === false) {
        clearTypingUser(data.user_id);
        return;
      }

      setTypingUsers((prev) => {
        const current = prev[data.user_id];
        // Already shown the same way: keep the state as it is (a new object
        // on every whisper re-rendered the whole screen while someone typed).
        if (current && current.isAi === !!data.isAi && current.avatarUrl === data.avatar_url) {
          return prev;
        }
        return {
          ...prev,
          [data.user_id]: { userId: data.user_id, isAi: !!data.isAi, avatarUrl: data.avatar_url },
        };
      });
      clearTimeout(typingTimeoutsRef.current[data.user_id]);
      typingTimeoutsRef.current[data.user_id] = setTimeout(() => {
        clearTypingUser(data.user_id);
      }, data.isAi ? 20000 : 4000);
    };
    const handleReacted = (data) => {
      if (!data?.message_id) return;
      applyReactionUpdate(data.message_id, data.reactions);
    };
    const handleRecalled = (data) => {
      if (!data?.message_id) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.message_id) {
            return { ...m, is_recalled: true, content: null, file_url: null, metadata: null };
          }
          // Any OTHER message quoting this one in its reply preview carries
          // its own denormalized snapshot of it (m.reply_to) that never gets
          // touched by the update above - without this it would keep
          // showing the pre-recall content forever.
          if (m.reply_to?.id === data.message_id) {
            return {
              ...m,
              reply_to: { ...m.reply_to, is_recalled: true, content: null, file_url: null },
            };
          }
          return m;
        })
      );
    };
    const handleEdited = (data) => {
      if (!data?.message_id) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.message_id) {
            return { ...m, content: data.content, is_edited: true };
          }
          if (m.reply_to?.id === data.message_id) {
            return { ...m, reply_to: { ...m.reply_to, content: data.content } };
          }
          return m;
        })
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
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      clearTimeout(backgroundRefreshTimerRef.current);
      clearTimeout(pendingLoadMoreAdjustTimeoutRef.current);
      // NOTE: Do NOT call setTypingUsers({}) here.
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
        // What arrived while the app was away is read now.
        if (isFocusedRef.current) markConversationAsRead(activeId).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [isNewConversation, currentConversationId, conversationId]);

  // Coming back to this screen (from a profile, group info...) reads what
  // arrived meanwhile. Not on the first focus: opening the conversation
  // already marks it.
  const wasFocusedRef = useRef(isFocused);
  useEffect(() => {
    const was = wasFocusedRef.current;
    wasFocusedRef.current = isFocused;
    if (!isFocused || was) return;
    const activeId = currentConversationId || conversationId;
    if (isNewConversation || !activeId) return;
    markConversationAsRead(activeId).catch(() => {});
  }, [isFocused, isNewConversation, currentConversationId, conversationId]);

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

  // A scroll to the end issued right when a message is added runs before
  // the new row (or the images above it) has been laid out, so the list
  // stopped short and the new message sat half under the composer. For a
  // moment after asking, every growth of the content scrolls to the end
  // again (see onContentSizeChange). Touching the list cancels it.
  const stickToLatestUntilRef = useRef(0);
  const stickToLatestAnimatedRef = useRef(true);
  const scrollToLatestAndStick = (animated = true, ms = 1000) => {
    stickToLatestUntilRef.current = Date.now() + ms;
    stickToLatestAnimatedRef.current = animated;
    if (animated) scrollToLatestMessageAnimated();
    else scrollToLatestMessage();
  };
  // Waits for the first page before looking further back for a message
  // opened from a notification (see handleMessagesContentSizeChange).
  const olderHighlightTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(olderHighlightTimerRef.current), []);

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
    }, 2500);
    return true;
  };

  const attemptScrollToHighlight = () => {
    const targetId = pendingHighlightMessageIdRef.current;
    if (targetId == null) return false;
    const didScroll = scrollToMessageAndHighlight(targetId);
    if (didScroll) {
      pendingHighlightMessageIdRef.current = null;
      stickToLatestUntilRef.current = 0;
    }
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

    // Every loaded message is always rendered (see the removeClippedSubviews
    // comment near visibleMessages), so if the target is already in
    // `messages` it's already mounted - the only reason scrollToMessageAndHighlight
    // just failed is that its layout hasn't been measured yet. Otherwise, it
    // isn't loaded at all yet and needs fetching further below.
    if (messages.some((m) => String(m.id) === String(replyToId))) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (scrollToMessageAndHighlight(replyToId)) return;
    }

    const MAX_ATTEMPTS = 8;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Through the refs: `hasMore` / `fetchMessages` here belong to the
      // render that started this loop and never change during it.
      if (!hasMoreRef.current) break;
      await fetchMessagesRef.current(false);
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
        const targetId = pendingHighlightMessageIdRef.current;
        if (targetId == null) {
          // Images above load after this, growing the list: keep it at the
          // newest message while they do.
          scrollToLatestAndStick(false, 1500);
        } else {
          scrollToLatestMessage();
          // A message from a notification that is older than what loaded:
          // once the fresh first page has had time to arrive, load older
          // pages until it turns up, the way jump-to-reply does.
          clearTimeout(olderHighlightTimerRef.current);
          olderHighlightTimerRef.current = setTimeout(() => {
            if (String(pendingHighlightMessageIdRef.current) !== String(targetId)) return;
            pendingHighlightMessageIdRef.current = null;
            messageHandlersRef.current.handleJumpToRepliedMessage?.(targetId);
          }, 1500);
        }
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
    if (videoMessageIds.length === 0) return;
    // Initialize active inline video when the screen first appears or messages change.
    const centerY = scrollOffsetRef.current + (scrollViewHeightRef.current || 0) / 2;
    let found = null;
    for (let i = 0; i < videoMessageIds.length; i++) {
      const key = videoMessageIds[i];
      const layout = messageLayoutOffsetsRef.current[key];
      if (!layout || typeof layout.y !== "number") continue;
      const top = layout.y;
      const h = layout.height || 0;
      if (centerY >= top && centerY <= top + h) {
        found = key;
        break;
      }
    }
    if (found && found !== activeInlineVideoIdRef.current) {
      activeInlineVideoIdRef.current = found;
      setActiveInlineVideoId(found);
    }
  }, [messages, autoplayVideos, isFocused, videoMessageIds]);

  const handleMessagesScroll = ({ nativeEvent }) => {
    const offsetY = nativeEvent.contentOffset.y;
    const isNearTop = offsetY <= 40;
    if (isNearTop && hasMore && !refreshing && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      pendingLoadMoreAdjustRef.current = {
        prevHeight: scrollContentHeightRef.current,
        prevOffsetY: offsetY,
      };
      fetchMessages(false);
    }
    const distanceFromBottom = scrollContentHeightRef.current - scrollViewHeightRef.current - offsetY;
    const shouldShow = distanceFromBottom > 150;
    setShowScrollButton((prev) => (prev === shouldShow ? prev : shouldShow));

    scrollOffsetRef.current = offsetY;
    if (!autoplayVideos || !isFocused) {
      if (activeInlineVideoId) {
        activeInlineVideoIdRef.current = null;
        setActiveInlineVideoId(null);
      }
      return;
    }

    if (videoMessageIds.length === 0) {
      if (activeInlineVideoIdRef.current) {
        activeInlineVideoIdRef.current = null;
        setActiveInlineVideoId(null);
      }
      return;
    }

    const centerY = offsetY + (scrollViewHeightRef.current || 0) / 2;
    let found = null;
    for (let i = 0; i < videoMessageIds.length; i++) {
      const key = videoMessageIds[i];
      const layout = messageLayoutOffsetsRef.current[key];
      if (!layout || typeof layout.y !== "number") continue;
      const top = layout.y;
      const h = layout.height || 0;
      if (centerY >= top && centerY <= top + h) {
        found = key;
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
          // iOS exports video as 720p H.264 (ignored on Android).
          videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.8,
          // iOS exports video as 720p H.264 (ignored on Android).
          videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
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
  // `originals` (optional, same order as the URIs): the pasted files, so a PNG /
  // GIF / WebP (keyboard stickers) is sent as it is instead of being flattened
  // into a JPEG (transparency and animation would be lost).
  const sendImageMessage = async (imageUriOrUris, originals) => {
    const uris = Array.isArray(imageUriOrUris) ? imageUriOrUris : [imageUriOrUris];
    const attachments = [];
    // Shown in the upload bar / notification, so the user sees it even after
    // leaving the conversation.
    const upload = beginUpload({ kind: "message" });
    upload.report("compressingImage");
    for (let i = 0; i < uris.length; i++) {
      // The picker can hand back non-JPEG originals (HEIC on iOS, PNG, etc.)
      // while we always declare image/jpeg - re-encode so the upload always
      // matches what it claims to be and passes the backend's mimes validation.
      const keepType = String(originals?.[i]?.type || "").toLowerCase();
      if (/^image\/(png|gif|webp)$/.test(keepType)) {
        attachments.push({
          uri: uris[i],
          fileName: `${Date.now()}_${i}.${keepType.split("/")[1]}`,
          fileType: keepType,
          fileSize: originals[i].fileSize,
        });
        continue;
      }
      let normalizedUri = uris[i];
      try {
        const result = await manipulateAsync(uris[i], [], {
          compress: 0.8,
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

    try {
      if (attachments.length > 1) {
        await sendAttachmentMessage({ type: "image", attachments, upload });
      } else {
        await sendAttachmentMessage({
          uri: attachments[0].uri,
          type: "image",
          fileName: attachments[0].fileName,
          fileType: attachments[0].fileType,
          upload,
        });
      }
    } finally {
      // No-op when the send already closed it (sent or failed).
      upload.end();
    }
  };

  // Accepts either a single picker asset (the common case) or an array of
  // assets (multi-select, up to 10) - same split as sendImageMessage above.
  const sendVideoMessage = async (assetOrAssets) => {
    const assets = Array.isArray(assetOrAssets) ? assetOrAssets : [assetOrAssets];

    // Compressed on the device to 720p H.264 before sending (the API no
    // longer does it). The upload bar / notification say so while it runs,
    // also after the user has left the conversation.
    const upload = beginUpload({ kind: "message" });
    const attachments = [];
    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const originalName = asset.fileName || asset.uri.split("/").pop() || `video_${i}.mp4`;
        const count = { current: i + 1, total: assets.length };
        upload.report("compressingVideo", { ...count, progress: i / assets.length });
        const compressed = await compressVideoForUpload(asset.uri, (ratio) =>
          upload.report("compressingVideo", { ...count, progress: (i + ratio) / assets.length }),
        );
        attachments.push({
          uri: compressed.uri,
          // The compressor always writes an MP4.
          fileName: compressed.compressed ? `${originalName.replace(/\.[^.]*$/, "")}.mp4` : originalName,
          fileType: compressed.compressed ? "video/mp4" : asset.mimeType || "video/mp4",
          // Unknown after compression; the size check already passed on the original.
          fileSize: compressed.compressed ? undefined : asset.fileSize,
        });
      }
      if (attachments.length > 1) {
        await sendAttachmentMessage({ type: "video", attachments, upload });
      } else {
        await sendAttachmentMessage({
          uri: attachments[0].uri,
          type: "video",
          fileName: attachments[0].fileName,
          fileType: attachments[0].fileType,
          fileSize: attachments[0].fileSize,
          upload,
        });
      }
    } finally {
      // No-op when the send already closed it (sent or failed).
      upload.end();
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
    // Handle from beginUpload() when the caller already opened one (while
    // compressing); otherwise one is opened here.
    upload: givenUpload,
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
    let upload = givenUpload || null;
    // Outside `try`: its `finally` clears the sending flag, which must not
    // happen for a send that never started.
    if (sending) return;
    try {
      setSending(true);
      upload = upload || beginUpload({ kind: "message" });
      upload.report(type === "video" ? "uploadingVideo" : "uploading", { progress: 0 });

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
        // Same reason as the text message above: without type "message" the
        // sending bubble vanished whenever another message arrived mid-upload.
        type: "message",
        content_type: type,
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

      // Add optimistic message to UI, and show it.
      scrollToLatestAndStick();
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
          upload.report(type === "video" ? "uploadingVideo" : "uploading", {
            progress: progressEvent.loaded / total,
          });
          setMessages((prev) => {
            // Many events report the same rounded percentage; mapping the
            // whole list for each of them was all wasted.
            const current = prev.find((m) => typeof m.id === "string" && m.id.includes(tempId));
            if (!current || current.upload_progress === percent) return prev;
            return prev.map((m) =>
              typeof m.id === "string" && m.id.includes(tempId)
                ? { ...m, upload_progress: percent }
                : m,
            );
          });
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

      upload.succeed();

      // Replace optimistic message with real one
      setMessages((prev) => {
        const baseMessages = prev.filter((msg) => {
          // Already here under its real id (a refresh landed first): it is
          // appended below, so this copy goes.
          if (msg && msg.type === "message" && msg.id === response.data.id) return false;
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
      // The toast below tells the user; this only clears the bar and the
      // notification.
      upload?.end();

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

  // True from the tap until the request settles (see handleSendNewMessage).
  const sendingRef = useRef(false);

  const handleSendNewMessage = async () => {
    scrollToLatestAndStick();
    const tempId = Date.now().toString();
    // Declared outside the try block (not just above the catch) so it's
    // still in scope if something throws before it would otherwise be set -
    // catch needs it to restore the reply state on failure.
    const replySnapshot = replyingTo;
    // Guards outside `try` (its `finally` clears the sending flag), and on a
    // ref: `sending` is state, so two quick taps both saw it false and sent
    // the message twice.
    if (sendingRef.current || sending) return;
    const rawMessage = latestMessageRef.current;
    if (!rawMessage.trim()) return;
    const trimmedMessage = rawMessage.trim();
    sendingRef.current = true;
    try {
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
      composerRef.current?.clear();
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
          // Already here under its real id (a refresh landed first): it is
          // appended below, so this copy goes.
          if (msg && msg.type === "message" && msg.id === response.data.id) return false;
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

        // The same shape every other message in the list has (see
        // injectTimeHeaders): type "message" + content_type. Pushed raw it
        // kept the API's type ("text"), and everything that looks for
        // type === "message" skipped it until the next refetch - reactions
        // on it did not show, and it dropped out of the list when the next
        // message arrived.
        messagesToAdd.push({
          ...response.data,
          type: "message",
          content_type: response.data.content_type ?? response.data.type,
        });
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

      // And the text: it was cleared from the input when the send started.
      // Only if nothing new was typed meanwhile.
      composerRef.current?.restoreIfEmpty(trimmedMessage);

      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("chatConversation.sendMessageError"),
      });
    } finally {
      sendingRef.current = false;
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
    // Multi-attachment messages only ever carry `file_url` as the FIRST
    // attachment's uri (see sendAttachmentMessage's `primary = attachments[0]`
    // above) - downloading just that one silently dropped every other
    // attached photo/video. `file_urls` (plural) has the full set.
    const urls = Array.isArray(item.file_urls) && item.file_urls.length > 0
      ? item.file_urls
      : item.file_url
        ? [item.file_url]
        : [];
    if (urls.length === 0) return;

    try {
      for (const url of urls) {
        await downloadMediaToLibrary(url, isVideo ? "video" : "image");
      }
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
            // Optimistic update - also patches any other message's reply_to
            // snapshot of this one, same as the realtime handleRecalled
            // handler does for everyone else's clients (recall broadcasts
            // via ->toOthers(), so the sender never gets their own here).
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === item.id) {
                  return { ...m, is_recalled: true, content: null, file_url: null, metadata: null };
                }
                if (m.reply_to?.id === item.id) {
                  return {
                    ...m,
                    reply_to: { ...m.reply_to, is_recalled: true, content: null, file_url: null },
                  };
                }
                return m;
              })
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
    if (!item || item.is_recalled || item.is_sending) return;
    setEditingMessage({ id: item.id, originalContent: item.content });
    composerRef.current?.setText(item.content || "");
    inputRef.current?.focus?.();
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    composerRef.current?.clear();
  };

  const MAX_PASTED_IMAGES = 10;
  const [pendingImages, setPendingImages] = useState([]);
  const handlePasteImages = React.useCallback((images) => {
    setPendingImages((prev) => [...prev, ...images].slice(0, MAX_PASTED_IMAGES));
  }, []);

  const handleSendMessage = async () => {
    if (editingMessage) {
      await handleSubmitEdit();
      return;
    }
    // Pasted images (keyboard stickers / GIFs, paste menu) wait in the bar
    // for Send; they go first, then the text.
    if (pendingImages.length > 0) {
      const images = pendingImages;
      setPendingImages([]);
      await sendImageMessage(
        images.map((file) => file.uri),
        images
      );
    }
    if (latestMessageRef.current.trim()) {
      await handleSendNewMessage();
    }
  };

  const handleSubmitEdit = async () => {
    // The ref, like sending: on Android the last word being composed
    // reaches it before it reaches state.
    const trimmed = latestMessageRef.current.trim();
    if (!trimmed || sending) return;
    const { id, originalContent } = editingMessage;

    setEditingMessage(null);
    composerRef.current?.clear();
    // Optimistic update - also patches any other message's reply_to
    // snapshot of this one (see handleRecallMessage's comment above for why).
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) return { ...m, content: trimmed, is_edited: true };
        if (m.reply_to?.id === id) return { ...m, reply_to: { ...m.reply_to, content: trimmed } };
        return m;
      })
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
  // useCallback: as a plain arrow it was a new component type on every
  // render, so the viewer remounted its header with each keystroke.
  const ImageViewerHeader = React.useCallback(() => (
    <View style={{ paddingTop: insets.top + 8, paddingRight: 12, alignItems: "flex-end" }}>
      <TouchableOpacity
        onPress={() => setImageViewer({ visible: false, uris: [], index: 0 })}
        style={styles.imageViewerCloseButton}
        hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  ), [insets.top]);

  // One array per set of pictures, not a new one on every render.
  const imageViewerImages = useMemo(
    () => imageViewer.uris.map((u) => ({ uri: u })),
    [imageViewer.uris],
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
      openSenderActions,
    };
  });

  const handleImageLoadError = React.useCallback((id, reason) => {
    setMediaLoadErrors((prev) => ({ ...prev, [id]: reason }));
  }, []);


  // ConversationHeader / ChatComposer / SeenByModal are memoized; they get
  // callbacks that never change identity and always run this render's
  // handlers (the same idea as messageHandlersRef above).
  const uiHandlersRef = useRef({});
  uiHandlersRef.current = {
    goBack: safeGoBack,
    showOptions,
    openTitle: () => {
      if (currentConversation?.type === "group") {
        if (!isPublicGroupChat(currentConversation)) {
          navigation.navigate("GroupInfoScreen", {
            conversationId: currentConversationId || conversationId,
          });
        }
        return;
      }
      navigation.navigate("ProfileScreen", { username: otherUser?.username });
    },
    typing: () => sendTyping(currentConversationId || conversationId),
    submit: handleSendMessage,
    cancelEdit,
    cancelReply,
    scrollToLatest: scrollToLatestMessageAnimated,
    pasteImages: handlePasteImages,
    removePendingImage: (index) => setPendingImages((prev) => prev.filter((_, i) => i !== index)),
    pickImage,
    pickDocument,
    closeSeenBy: () => setSeenByModalParticipants(null),
    openSeenByProfile: (profileUsername) => {
      setSeenByModalParticipants(null);
      navigation.push("ProfileScreen", { username: profileUsername });
    },
  };
  const uiActions = useMemo(() => {
    const call = (name) => (...args) => uiHandlersRef.current[name](...args);
    return Object.fromEntries(Object.keys(uiHandlersRef.current).map((name) => [name, call(name)]));
  }, []);

  const pendingImageUris = useMemo(() => pendingImages.map((file) => file.uri), [pendingImages]);

  const headerAvatarUrl = getHeaderAvatar();
  const headerAvatarSource = useMemo(
    () =>
      headerAvatarUrl === "local:chat.jpg"
        ? require("../../../assets/chat.jpg")
        : { uri: headerAvatarUrl || "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg" },
    [headerAvatarUrl]
  );
  const headerTitle = isNewConversation
    ? selectedUser.profile_name
    : currentConversation?.type === "group"
      ? isPublicGroupChat(currentConversation)
        ? t("chatConversation.casualGroupName")
        : currentConversation?.name || t("chatConversation.casualGroupName")
      : currentConversation?.participants[0]?.profile_name;
  const headerUsername =
    currentConversation?.type !== "group" && otherUser?.username ? otherUser.username : null;
  const headerSubtitle =
    currentConversation?.type === "group"
      ? `${currentConversation?.participants?.length || 0} ${t("chatConversation.members") || "members"}`
      : "";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ConversationHeader
        insetsTop={insets.top}
        avatarSource={headerAvatarSource}
        avatarUrl={headerAvatarUrl}
        profileTheme={otherUser?.profile_theme}
        showOnlineDot={currentConversation?.type !== "group" && isOtherUserOnline}
        title={headerTitle}
        username={headerUsername}
        subtitle={headerSubtitle}
        onBack={uiActions.goBack}
        onPressTitle={uiActions.openTitle}
        onOptions={uiActions.showOptions}
      />
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />

      <ReportModal
        visible={!!reportMessageTarget}
        onClose={() => setReportMessageTarget(null)}
        onSubmit={handleReportMessageSubmit}
        title={t("chatConversation.reportMessage", "Báo cáo tin nhắn")}
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

      <SeenByModal
        participants={seenByModalParticipants}
        onClose={uiActions.closeSeenBy}
        onOpenProfile={uiActions.openSeenByProfile}
      />

      <ImageView
        images={imageViewerImages}
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
        onReport={
          // Only other people's messages, and never the AI's - there's no
          // account behind those to report.
          !reactionPicker.message?.is_myself &&
          !reactionPicker.message?.sender?.is_ai &&
          !reactionPicker.message?.is_sending
            ? handleReportMessage
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
            { paddingTop: HEADER_HEIGHT + 12, paddingBottom: composerHeight + 12 },
          ]}
          keyboardDismissMode="interactive"
          onScroll={handleMessagesScroll}
          onScrollBeginDrag={() => {
            stickToLatestUntilRef.current = 0;
          }}
          scrollEventThrottle={16}
          // Was Platform.OS === "android" for native-level view recycling
          // (real measured clipping instead of the old JS-estimated mount/
          // unmount windowing - see the visibleMessages comment above), but
          // Android's implementation detaches clipped views from the native
          // hierarchy entirely, and image/video views frequently fail to
          // redraw when scrolled back into view afterward - the thumbnail
          // just stays blank until something else forces a re-render.
          // Disabled outright rather than risk that for the sake of the
          // scroll perf gain.
          removeClippedSubviews={false}
          onContentSizeChange={(w, h) => {
            const pending = pendingLoadMoreAdjustRef.current;
            if (pending && h > pending.prevHeight) {
              // The newly-prepended older page's images/avatars/reply
              // previews often haven't finished laying out yet when this
              // first fires, so content height keeps growing in several
              // more steps after the first compensation - a one-shot
              // correction only accounted for the first step and let every
              // later step silently push the viewport up past what the user
              // was reading, all the way to the top. Keep re-anchoring on
              // every growth step (rolling prevHeight/prevOffsetY) instead
              // of clearing after the first, until growth actually stops.
              const grownBy = h - pending.prevHeight;
              const targetY = pending.prevOffsetY + grownBy;
              pending.prevHeight = h;
              pending.prevOffsetY = targetY;
              requestAnimationFrame(() => {
                messagesScrollRef.current?.scrollTo({ y: targetY, animated: false });
              });
              console.log("[ChatWindow] compensated scroll after load-more", {
                grownBy: Math.round(grownBy),
                targetY: Math.round(targetY),
              });
              clearTimeout(pendingLoadMoreAdjustTimeoutRef.current);
              pendingLoadMoreAdjustTimeoutRef.current = setTimeout(() => {
                pendingLoadMoreAdjustRef.current = null;
              }, 500);
            } else if (!pendingLoadMoreAdjustRef.current && Date.now() < stickToLatestUntilRef.current) {
              messagesScrollRef.current?.scrollToEnd({ animated: stickToLatestAnimatedRef.current });
            }
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
          <TypingIndicator typingUsers={typingUsers} participants={currentConversation?.participants} />
          <View style={{ height: isAndroid ? 82 : 24 }} />
        </KeyboardChatScrollView>
        </KeyboardGestureArea>
        </AndroidGlassBackdrop>
      </View>

      <ChatComposer
        ref={composerRef}
        inputRef={inputRef}
        latestMessageRef={latestMessageRef}
        actions={uiActions}
        sending={sending}
        pendingImageUris={pendingImageUris}
        editingMessage={editingMessage}
        replyingTo={replyingTo}
        currentUsername={username}
        showScrollButton={showScrollButton}
        isGroup={currentConversation?.type === "group"}
        fetchMentionSuggestions={fetchMessageMentionSuggestions}
        bottomInset={insets.bottom}
        onHeightChange={setComposerHeight}
      />
    </View>
  );
};

// MediaGalleryScreen imports the full-screen video player from here.
export { VideoViewerModal } from "./conversation/VideoViewerModal";

export default ConversationScreen;
