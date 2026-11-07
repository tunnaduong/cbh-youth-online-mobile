import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getConversations, getOnlineStatus } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
import { useFocusEffect } from "@react-navigation/native";
import { useUnreadCountsContext } from "../../../contexts/UnreadCountsContext";
import { AuthContext } from "../../../contexts/AuthContext";
import { useChatSocket } from "../../../contexts/ChatSocketContext";
import dayjs from "dayjs";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { isPublicGroupChat } from "../../../utils/chatHelpers";
import { getSystemMessageText } from "../../../utils/systemMessageText";
import CustomLoading from "../../../components/CustomLoading";
import FastImage from "../../../components/FastImage";
import UserNameRow from "../../../components/profile/UserNameRow";
import AvatarFrame from "../../../components/profile/AvatarFrame";

// Time of a conversation's last message
const formatMessageTime = (timestamp, t) => {
  const time = dayjs(timestamp);
  if (!time.isValid()) return "";
  const now = dayjs();
  if (time.isSame(now, "day")) return time.format("HH:mm");
  const yesterdayLabel = typeof t === "function"
    ? t("chat.yesterday")
    : (t || "Yesterday");
  if (time.isSame(now.subtract(1, "day"), "day")) return yesterdayLabel;
  return time.isSame(now, "year") ? time.format("DD/MM") : time.format("DD/MM/YY");
};

export default function ChatScreen({ navigation, scrollTriggerRef }) {
  const { theme, isDarkMode } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'unread' | 'group'
  const [showFilterPills, setShowFilterPills] = useState(false);
  const { t } = useTranslation();

  const listExtraData = useMemo(() => ({ t, theme, isDarkMode }), [t, theme, isDarkMode]);
  const insets = useSafeAreaInsets();
  const { refreshChatCount } = useUnreadCountsContext();
  const { blockedUsers, username } = useContext(AuthContext);

  const conversationsCacheKey = `conversations_${username}`;
  const { onMessageSent, onMessageRead, onMessageDeleted, onMessageRecalled, onMessageEdited } = useChatSocket();
  const flatListRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY);
  };

  const scrollToTopOrReload = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) return;
    lastTriggerTimeRef.current = now;

    if (isProcessingRef.current) return;

    const isAtTop = scrollPositionRef.current <= 10;

    if (isAtTop) {
      isProcessingRef.current = true;
      setRefreshing(true);
      fetchConversations().finally(() => {
        setTimeout(() => {
          setRefreshing(false);
          isProcessingRef.current = false;
          scrollPositionRef.current = 0;
        }, 1000);
      });
    } else {
      isProcessingRef.current = true;
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
      setTimeout(() => {
        scrollPositionRef.current = 0;
        isProcessingRef.current = false;
      }, 600);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setPullRefreshing(true);
    setRefreshing(true);
    fetchConversations().finally(() => {
      setTimeout(() => {
        setPullRefreshing(false);
        setRefreshing(false);
      }, 1000);
    });
  }, []);

  useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [refreshChatCount])
  );

  useEffect(() => {
    const cached = storage.getString(conversationsCacheKey);
    if (cached) {
      setConversations(JSON.parse(cached));
    }
    setRefreshing(true);
    fetchConversations().finally(() => {
      setTimeout(() => setRefreshing(false), 1000);
    });
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await getConversations();
      setConversations(response.data);
      storage.set(conversationsCacheKey, JSON.stringify(response.data));
      refreshChatCount();
      fetchOnlineStatuses(response.data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      Toast.show({
        type: "error",
        text1: t('profile.errorTitle'),
        text2: t('home.loadingError'),
      });
    }
  };

  const fetchOnlineStatuses = async (convos) => {
    const usernames = [
      ...new Set(
        convos
          .filter((c) => c.type === "private" && c.participants[0]?.username)
          .map((c) => c.participants[0].username)
      ),
    ];
    if (usernames.length === 0) return;

    const results = await Promise.all(
      usernames.map((u) =>
        getOnlineStatus(u)
          .then((res) => [u, !!res.data?.is_online])
          .catch(() => [u, undefined])
      )
    );

    setOnlineStatuses((prev) => {
      const next = { ...prev };
      results.forEach(([u, isOnline]) => {
        if (isOnline !== undefined) next[u] = isOnline;
      });
      return next;
    });
  };

  const fetchConversationsRef = useRef(null);
  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  });

  const conversationIdsKey = useMemo(
    () => conversations.map((c) => c.id).join(","),
    [conversations]
  );

  useEffect(() => {
    const ids = conversationIdsKey ? conversationIdsKey.split(",") : [];
    if (ids.length === 0) return undefined;

    let refreshTimer = null;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => fetchConversationsRef.current?.(), 400);
    };
    const unsubscribers = ids.flatMap((id) => {
      const numId = Number(id);
      const handleRecalled = (data) => {
        if (!data?.message_id) return;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === numId && c.latest_message?.id === data.message_id
              ? { ...c, latest_message: { ...c.latest_message, is_recalled: true, content: null } }
              : c
          )
        );
      };
      const handleEdited = (data) => {
        if (!data?.message_id) return;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === numId && c.latest_message?.id === data.message_id
              ? { ...c, latest_message: { ...c.latest_message, content: data.content, is_edited: true } }
              : c
          )
        );
      };
      return [
        onMessageSent(id, refresh),
        onMessageRead(id, refresh),
        onMessageDeleted(id, refresh),
        onMessageRecalled ? onMessageRecalled(id, handleRecalled) : null,
        onMessageEdited ? onMessageEdited(id, handleEdited) : null,
      ].filter(Boolean);
    });

    return () => {
      clearTimeout(refreshTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [conversationIdsKey, onMessageSent, onMessageRead, onMessageDeleted, onMessageRecalled, onMessageEdited]);

  const unreadTotalCount = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((item) => {
      if (
        item.type === "private" &&
        item.participants[0]?.username &&
        blockedUsers &&
        blockedUsers.includes(item.participants[0].username)
      ) {
        return false;
      }

      if (activeFilter === "unread" && !(item.unread_count > 0)) {
        return false;
      }

      if (activeFilter === "group" && !(item.type === "group" || isPublicGroupChat(item))) {
        return false;
      }

      const participantName =
        item.type === "private" ? item.participants[0]?.profile_name : item.name;
      const messageContent = item.latest_message?.content || "";

      if (!search.trim()) return true;

      const searchLower = search.toLowerCase();
      return (
        participantName?.toLowerCase().includes(searchLower) ||
        messageContent.toLowerCase().includes(searchLower)
      );
    });
  }, [conversations, blockedUsers, activeFilter, search]);

  const getChatName = (conversation) => {
    if (conversation.type === "private") {
      return conversation.participants[0]?.profile_name || "Unknown User";
    }
    if (isPublicGroupChat(conversation)) {
      return t("chatConversation.casualGroupName", "Tán gẫu linh tinh");
    }
    return conversation.name || "Unnamed Group";
  };

  const getAvatar = (conversation) => {
    if (conversation.type === "private") {
      return conversation.participants?.[0]?.avatar_url;
    }
    if (isPublicGroupChat(conversation)) {
      return "local:chat.jpg";
    }
    return conversation.avatar_url || conversation.participants?.[0]?.avatar_url || null;
  };

  const getProfileTheme = (conversation) =>
    conversation.type === "private" ? conversation.participants[0]?.profile_theme : null;

  const renderLastMessagePreview = (latestMessage) => {
    if (!latestMessage) return t("chat.noMessages", "Chưa có tin nhắn");

    if (latestMessage.is_recalled) {
      return (
        <>
          <Ionicons name="arrow-undo-outline" size={14} color={theme.subText} />{" "}
          {t("chatConversation.recalled", "Tin nhắn đã bị thu hồi")}
        </>
      );
    }

    const type = latestMessage.type || latestMessage.content_type;

    if (type === "call" || latestMessage.metadata?.call_id) {
      const isVideo = latestMessage.metadata?.call_type === "video";
      const isMissed =
        latestMessage.metadata?.status === "missed" ||
        latestMessage.metadata?.end_reason === "missed" ||
        latestMessage.metadata?.end_reason === "cancelled";
      return (
        <>
          <Ionicons
            name={isMissed ? "call-outline" : isVideo ? "videocam-outline" : "call-outline"}
            size={14}
            color={isMissed ? "#EF4444" : theme.subText}
            style={isMissed ? { transform: [{ rotate: "135deg" }] } : undefined}
          />{" "}
          {latestMessage.content || (isMissed ? t("call.missedAudio", "Cuộc gọi nhỡ") : t("call.voiceCall", "Cuộc gọi"))}
        </>
      );
    }

    if (type === "system") {
      return getSystemMessageText(latestMessage, t);
    }

    if (type === "image") {
      return (
        <>
          <Ionicons name="image-outline" size={14} color={theme.subText} />{" "}
          {t("chat.photo", "[Hình ảnh]")}
        </>
      );
    }
    if (type === "video") {
      return (
        <>
          <Ionicons name="videocam-outline" size={14} color={theme.subText} />{" "}
          {t("chat.video", "[Video]")}
        </>
      );
    }
    if (type === "file") {
      return (
        <>
          <Ionicons name="document-text-outline" size={14} color={theme.subText} />{" "}
          {latestMessage.file_name || latestMessage.content}
        </>
      );
    }

    const sharedTopic = latestMessage.metadata?.shared_topic;
    if (sharedTopic) {
      return (
        <>
          <Ionicons name="share-outline" size={14} color={theme.subText} />{" "}
          {sharedTopic.title || t("sharePost.sharedAPost", "Đã chia sẻ một bài viết")}
        </>
      );
    }

    const content = latestMessage.content || t("chat.noMessages", "Chưa có tin nhắn");
    if (latestMessage.is_edited) {
      return `${content} ${t("chatConversation.edited", "(Đã sửa)")}`;
    }
    return content;
  };

  const ConversationAvatar = ({ item }) => {
    const [loadError, setLoadError] = useState(false);
    const avatar = getAvatar(item);
    const name = getChatName(item);
    const initial = name?.trim()?.[0]?.toUpperCase() || "?";
    const isLocal = avatar === "local:chat.jpg";
    const isPlaceholder =
      !avatar ||
      (typeof avatar === "string" &&
        (avatar.includes("placeholder-user.jpg") ||
          avatar.includes("default-avatar.png") ||
          avatar.trim() === ""));

    if (loadError || (!isLocal && isPlaceholder)) {
      return (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: isDarkMode ? "#27272A" : "#DCFCE7" }]}>
          <Text style={[styles.avatarFallbackInitial, { color: isDarkMode ? "#4ADE80" : "#15803D" }]}>
            {initial}
          </Text>
        </View>
      );
    }

    return (
      <FastImage
        source={isLocal ? require("../../../assets/chat.jpg") : { uri: avatar }}
        style={[styles.avatar, { backgroundColor: theme.border }]}
        onError={() => setLoadError(true)}
      />
    );
  };

  const renderItem = ({ item }) => {
    const unread = (item.unread_count || 0) > 0;
    const isMyself = item.latest_message?.is_myself;
    const isGroup = item.type === "group" || isPublicGroupChat(item);
    const chatName = getChatName(item);

    let senderPrefix = "";
    if (isMyself) {
      const you = t('chat.you', 'Bạn');
      senderPrefix = you.includes(":") ? (you.endsWith(" ") ? you : `${you} `) : `${you}: `;
    } else if (isGroup && item.latest_message?.sender_profile_name) {
      senderPrefix = `${item.latest_message.sender_profile_name}: `;
    }

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDarkMode ? "#1C1E24" : "#FFFFFF",
            borderColor: isDarkMode ? "#272A34" : "#F1F5F9",
          },
        ]}
        activeOpacity={0.75}
        onPress={() => {
          navigation.navigate("ConversationScreen", {
            conversationId: item.id,
            conversation: item,
          });
        }}
      >
        {/* Left: Avatar with Online indicator */}
        <View style={styles.avatarWrapper}>
          <ConversationAvatar item={item} />
          <AvatarFrame theme={getProfileTheme(item)} size={50} />
          {item.type === "private" && onlineStatuses[item.participants[0]?.username] ? (
            <View style={[styles.onlineDot, { borderColor: isDarkMode ? "#1C1E24" : "#FFFFFF" }]} />
          ) : null}
        </View>

        {/* Center: Name & Last Message */}
        <View style={styles.info}>
          <UserNameRow
            name={chatName}
            theme={getProfileTheme(item)}
            style={[styles.name, { color: theme.text }]}
          />
          <Text
            style={[
              styles.lastMessage,
              {
                color: unread ? (isDarkMode ? "#F3F4F6" : "#0F172A") : theme.subText,
                fontWeight: unread ? "600" : "400",
              },
            ]}
            numberOfLines={1}
          >
            {senderPrefix}
            {renderLastMessagePreview(item.latest_message)}
          </Text>
        </View>

        {/* Right: Meta (Time + Status indicator) */}
        <View style={styles.meta}>
          <Text
            style={[
              styles.time,
              {
                color: unread ? (isDarkMode ? "#4ADE80" : "#16A34A") : theme.subText,
                fontWeight: unread ? "600" : "400",
              },
            ]}
          >
            {item.latest_message?.created_at
              ? formatMessageTime(item.latest_message.created_at, t)
              : ""}
          </Text>

          <View style={styles.statusContainer}>
            {unread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? "99+" : item.unread_count}
                </Text>
              </View>
            ) : isMyself ? (
              (item.latest_message?.is_read || item.latest_message?.read_at) ? (
                // Tin nhắn đã được đọc → 2 tick xanh
                <View style={styles.doubleCheckRow}>
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#22C55E"
                    style={styles.checkOverlap}
                  />
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#22C55E"
                  />
                </View>
              ) : (
                // Chưa được đọc → 1 tick xám
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={theme.subText}
                />
              )
            ) : (isPublicGroupChat(item) || item.is_muted) ? (
              <Ionicons
                name="notifications-off-outline"
                size={16}
                color={theme.subText}
              />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const screenBg = isDarkMode ? "#121316" : "#F8FAF9";

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      {/* Top Ambient Green Gradient */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(34, 197, 94, 0.12)", "rgba(34, 197, 94, 0.02)", "transparent"]
            : ["#DCFCE7", "#EBF9F0", "rgba(248, 250, 249, 0)"]
        }
        style={styles.ambientGlow}
        pointerEvents="none"
      />

      {/* Header Container */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + (Platform.OS === "ios" ? 4 : 8) }]}>
        {/* Left: Frog Mascot + Radiating Doodles + "Tin nhắn" Title */}
        <View style={styles.headerLeft}>
          <View style={styles.mascotWrapper}>
            <View style={styles.actionLinesWrapper}>
              <View style={[styles.actionLine, styles.actionLine1]} />
              <View style={[styles.actionLine, styles.actionLine2]} />
              <View style={[styles.actionLine, styles.actionLine3]} />
            </View>
            <FastImage
              source={require("../../../assets/logo.png")}
              style={styles.mascotLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.titleWrapper}>
            <Text style={[styles.headerTitle, { color: isDarkMode ? "#4ADE80" : "#15803D" }]}>
              {t('chat.title', 'Tin nhắn')}
            </Text>
            <Text style={styles.sparkleStar}>✦</Text>
          </View>
        </View>

        {/* Right: Action Buttons (Group, Add) */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.headerBtn,
              { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.18)" : "rgba(34, 197, 94, 0.12)" },
            ]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("CreateGroupScreen")}
          >
            <Ionicons name="people-outline" size={20} color={isDarkMode ? "#4ADE80" : "#15803D"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerBtn,
              { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.18)" : "rgba(34, 197, 94, 0.12)" },
            ]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("NewConversationScreen")}
          >
            <Ionicons name="add" size={24} color={isDarkMode ? "#4ADE80" : "#15803D"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: isDarkMode ? "#1B1E24" : "#FFFFFF",
              borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.subText} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t('chat.search', 'Tìm kiếm cuộc trò chuyện...')}
            placeholderTextColor={theme.placeholder || "#9CA3AF"}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={theme.subText} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            {
              backgroundColor:
                showFilterPills || activeFilter !== "all"
                  ? isDarkMode
                    ? "#15803D"
                    : "#16A34A"
                  : isDarkMode
                  ? "rgba(34, 197, 94, 0.18)"
                  : "rgba(34, 197, 94, 0.12)",
            },
          ]}
          activeOpacity={0.7}
          onPress={() => setShowFilterPills((prev) => !prev)}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={
              showFilterPills || activeFilter !== "all"
                ? "#FFFFFF"
                : isDarkMode
                ? "#4ADE80"
                : "#15803D"
            }
          />
        </TouchableOpacity>
      </View>

      {/* Filter Pills (Tất cả, Chưa đọc, Nhóm) */}
      {showFilterPills && (
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "all"
                ? styles.filterPillActive
                : {
                    backgroundColor: isDarkMode ? "#1B1E24" : "#FFFFFF",
                    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                  },
            ]}
            onPress={() => setActiveFilter("all")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "all" ? styles.filterPillTextActive : { color: theme.subText },
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "unread"
                ? styles.filterPillActive
                : {
                    backgroundColor: isDarkMode ? "#1B1E24" : "#FFFFFF",
                    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                  },
            ]}
            onPress={() => setActiveFilter("unread")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "unread" ? styles.filterPillTextActive : { color: theme.subText },
              ]}
            >
              Chưa đọc {unreadTotalCount > 0 ? `(${unreadTotalCount})` : ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              activeFilter === "group"
                ? styles.filterPillActive
                : {
                    backgroundColor: isDarkMode ? "#1B1E24" : "#FFFFFF",
                    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                  },
            ]}
            onPress={() => setActiveFilter("group")}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === "group" ? styles.filterPillTextActive : { color: theme.subText },
              ]}
            >
              Nhóm
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading indicator */}
      {refreshing && (
        <View style={styles.loadingContainer}>
          <CustomLoading size={44} showBackdrop />
        </View>
      )}

      {/* Conversations List */}
      <AndroidGlassBackdrop providerId="Chat" style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={filteredConversations}
          extraData={listExtraData}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={["transparent"]}
              progressBackgroundColor="transparent"
              style={{ backgroundColor: "transparent" }}
              progressViewOffset={-1000}
            />
          }
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: 110 + insets.bottom,
            flexGrow: filteredConversations.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image
                source={require("../../../assets/sad_frog.png")}
                style={styles.emptyImage}
              />
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                {search
                  ? t('chat.noConversations', 'Không tìm thấy cuộc trò chuyện')
                  : t('chat.noMessages', 'Chưa có tin nhắn')}
              </Text>
            </View>
          }
        />
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 0,
  },
  headerContainer: {
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  mascotWrapper: {
    position: "relative",
    width: 44,
    height: 44,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  mascotLogo: {
    width: 40,
    height: 40,
  },
  actionLinesWrapper: {
    position: "absolute",
    top: -7,
    left: 11,
    width: 22,
    height: 14,
  },
  actionLine: {
    position: "absolute",
    width: 2.5,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: "#EAB308",
  },
  actionLine1: {
    top: 6,
    left: 1,
    transform: [{ rotate: "-40deg" }],
  },
  actionLine2: {
    top: 0,
    left: 8,
    transform: [{ rotate: "0deg" }],
  },
  actionLine3: {
    top: 5,
    left: 15,
    transform: [{ rotate: "35deg" }],
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sparkleStar: {
    fontSize: 16,
    color: "#EAB308",
    marginLeft: 4,
    marginTop: -14,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
    zIndex: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  filterPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
    zIndex: 10,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  loadingContainer: {
    position: "absolute",
    top: 140,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  avatarWrapper: {
    position: "relative",
    width: 50,
    height: 50,
    marginRight: 13,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackInitial: {
    fontSize: 20,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
  },
  info: {
    flex: 1,
    justifyContent: "center",
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  lastMessage: {
    fontSize: 13.5,
  },
  meta: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 44,
    minWidth: 42,
  },
  time: {
    fontSize: 12,
  },
  statusContainer: {
    minHeight: 20,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  doubleCheckRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkOverlap: {
    marginRight: -7,
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    backgroundColor: "#22C55E",
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyImage: {
    height: 90,
    width: 90,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
