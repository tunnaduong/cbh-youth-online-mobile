import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  DeviceEventEmitter,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
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
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { isPublicGroupChat } from "../../../utils/chatHelpers";
import CustomLoading from "../../../components/CustomLoading";

const formatMessageTime = (timestamp) => {
  // ... same formatMessageTime function ...
};

export default function ChatScreen({ navigation, scrollTriggerRef }) {
  const { theme, isDarkMode } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { refreshChatCount } = useUnreadCountsContext();
  const { blockedUsers } = useContext(AuthContext);
  const { onMessageSent, onMessageRead, onMessageDeleted, onMessageRecalled, onMessageEdited } = useChatSocket();
  const flatListRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  const lastScrollYRef = useRef(0);

  const scrollY = useRef(new Animated.Value(0)).current;

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, -10],
    extrapolate: "clamp",
  });

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY);
    scrollY.setValue(offsetY);

    lastScrollYRef.current = offsetY;
  };

  const scrollToTopOrReload = React.useCallback(() => {
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

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchConversations().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    });
  }, []);

  React.useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  useFocusEffect(
    React.useCallback(() => {
      fetchConversations();
      refreshChatCount();
    }, [refreshChatCount])
  );

  useEffect(() => {
    const cached = storage.getString("conversations");
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
      storage.set("conversations", JSON.stringify(response.data));
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

  // Fetch the online status of every private-chat partner shown in the list.
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
      usernames.map((username) =>
        getOnlineStatus(username)
          .then((res) => [username, !!res.data?.is_online])
          .catch(() => [username, undefined])
      )
    );

    setOnlineStatuses((prev) => {
      const next = { ...prev };
      results.forEach(([username, isOnline]) => {
        if (isOnline !== undefined) next[username] = isOnline;
      });
      return next;
    });
  };

  // Keep the latest fetchConversations closure available to the realtime listeners
  // below without re-subscribing to the socket on every render.
  const fetchConversationsRef = useRef(null);
  useEffect(() => {
    fetchConversationsRef.current = fetchConversations;
  });

  const conversationIdsKey = React.useMemo(
    () => conversations.map((c) => c.id).join(","),
    [conversations]
  );

  // Realtime: refresh the conversation list (unread badges, last message, ordering)
  // the instant any of these conversations gets a chat event.
  useEffect(() => {
    const ids = conversationIdsKey ? conversationIdsKey.split(",") : [];
    if (ids.length === 0) return undefined;

    const refresh = () => fetchConversationsRef.current?.();
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

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [conversationIdsKey, onMessageSent, onMessageRead, onMessageDeleted, onMessageRecalled, onMessageEdited]);

  const filteredConversations = conversations.filter((item) => {
    if (
      item.type === "private" &&
      item.participants[0]?.username &&
      blockedUsers &&
      blockedUsers.includes(item.participants[0].username)
    ) {
      return false;
    }

    const participantName =
      item.type === "private" ? item.participants[0]?.profile_name : item.name;
    const messageContent = item.latest_message?.content || "";

    const searchLower = search.toLowerCase();
    return (
      participantName?.toLowerCase().includes(searchLower) ||
      messageContent.toLowerCase().includes(searchLower)
    );
  });

  const getChatName = (conversation) => {
    if (conversation.type === "private") {
      return conversation.participants[0]?.profile_name || "Unknown User";
    }
    if (isPublicGroupChat(conversation)) {
      return t("chatConversation.casualGroupName");
    }
    return conversation.name || "Unnamed Group";
  };

  const getAvatar = (conversation) => {
    if (conversation.type === "private") {
      return conversation.participants[0]?.avatar_url;
    }
    if (isPublicGroupChat(conversation)) {
      return "local:chat.jpg";
    }
    return conversation.avatar_url || null;
  };

  const renderLastMessagePreview = (latestMessage) => {
    if (!latestMessage) return t("chat.noMessages");

    if (latestMessage.is_recalled) {
      return (
        <>
          <Ionicons name="arrow-undo-outline" size={14} color={theme.subText} />{" "}
          {t("chatConversation.recalled", "Tin nhắn đã bị thu hồi")}
        </>
      );
    }

    const type = latestMessage.type || latestMessage.content_type;

    if (type === "image") {
      return (
        <>
          <Ionicons name="image-outline" size={14} color={theme.subText} />{" "}
          {t("chat.photo")}
        </>
      );
    }
    if (type === "video") {
      return (
        <>
          <Ionicons name="videocam-outline" size={14} color={theme.subText} />{" "}
          {t("chat.video")}
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

    const content = latestMessage.content || t("chat.noMessages");
    if (latestMessage.is_edited) {
      return `${content} ${t("chatConversation.edited", "(Đã sửa)")}`;
    }
    return content;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.conversation, { backgroundColor: theme.background }]}
      onPress={() => {
        navigation.navigate("ConversationScreen", {
          conversationId: item.id,
          conversation: item,
        });
      }}
    >
      <View style={styles.avatarWrapper}>
        <Image
          source={
            getAvatar(item) === "local:chat.jpg"
              ? require("../../../assets/chat.jpg")
              : {
                uri:
                  getAvatar(item) ||
                  "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg",
              }
          }
          style={[styles.avatar, { backgroundColor: theme.border }]}
        />
        {item.type === "private" && onlineStatuses[item.participants[0]?.username] ? (
          <View style={styles.onlineDot} />
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {getChatName(item)}
        </Text>
        <Text style={[styles.lastMessage, { color: theme.subText }]} numberOfLines={1}>
          {item.latest_message?.is_myself ? t('chat.you') : ""}
          {renderLastMessagePreview(item.latest_message)}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={[styles.time, { color: theme.subText }]}>
          {item.latest_message?.created_at
            ? formatMessageTime(item.latest_message.created_at)
            : ""}
        </Text>
        <View style={styles.unreadContainer}>
          {isPublicGroupChat(item) && (
            <Ionicons
              name="notifications-off"
              size={18}
              color={theme.subText}
              style={styles.muteIcon}
            />
          )}
          {item.unread_count > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const headerHeight = 58 + insets.top;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View
        style={[styles.header, { paddingTop: insets.top, height: headerHeight, backgroundColor: "transparent" }]}
        pointerEvents="box-none"
      >
        <Animated.Text
          style={[
            styles.headerTitleText,
            { color: theme.primary, opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] },
          ]}
        >
          {t('chat.title')}
        </Animated.Text>
        <View style={styles.headerActions}>
          <LiquidButton
            providerId="Chat"
            onPress={() => navigation.navigate("CreateGroupScreen")}
            scrollY={scrollY}
            alwaysBorder
            borderColor={theme.primary}
            size={40}
          >
            <Ionicons name="people-outline" size={19} color={theme.text} />
          </LiquidButton>
          <LiquidButton
            providerId="Chat"
            onPress={() => navigation.navigate("NewConversationScreen")}
            scrollY={scrollY}
            alwaysBorder
            borderColor={theme.primary}
            size={40}
          >
            <Ionicons name="add" size={22} color={theme.text} />
          </LiquidButton>
        </View>
      </View>

      {refreshing && (
        <View
          style={{
            position: "absolute",
            top: headerHeight + 15,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <CustomLoading size={44} showBackdrop />
        </View>
      )}
      <AndroidGlassBackdrop providerId="Chat" style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={filteredConversations}
        extraData={{ t, theme, isDarkMode }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={["transparent"]}
            progressBackgroundColor="transparent"
            style={{ backgroundColor: "transparent" }}
            progressViewOffset={-1000}
          />
        }
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingBottom: 110 + insets.bottom,
          flex: filteredConversations.length === 0 ? 1 : undefined,
        }}
        ListHeaderComponent={
          <>
            <View style={[styles.searchContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons
                name="search"
                size={18}
                color={theme.subText}
                style={{ marginLeft: 12 }}
              />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder={t('chat.search')}
                placeholderTextColor={theme.placeholder}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </>
        }
        ItemSeparatorComponent={() => (
          <View
            style={{ height: 1, backgroundColor: theme.border, marginLeft: 80 }}
          />
        )}
        ListEmptyComponent={
          <View style={{ flex: 1, marginTop: 44 }}>
            <View style={styles.emptyContainer}>
              <Image
                source={require("../../../assets/sad_frog.png")}
                style={styles.emptyImage}
              />
              <Text style={[styles.emptyText, { color: theme.subText }]}>
                {search
                  ? t('chat.noConversations')
                  : t('chat.noMessages')}
              </Text>
            </View>
          </View>
        }
      />
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    gap: 8,
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatarWrapper: {
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#16a34a",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
  },
  meta: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 40,
  },
  time: {
    fontSize: 12,
    marginBottom: 4,
  },
  unreadContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  muteIcon: {
    marginRight: 2,
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
