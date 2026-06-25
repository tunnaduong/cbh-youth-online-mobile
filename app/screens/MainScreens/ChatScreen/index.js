import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { getConversations } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
import { useFocusEffect } from "@react-navigation/native";
import { useUnreadCountsContext } from "../../../contexts/UnreadCountsContext";
import { AuthContext } from "../../../contexts/AuthContext";
import dayjs from "dayjs";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const formatMessageTime = (timestamp) => {
  // ... same formatMessageTime function ...
};

export default function ChatScreen({ navigation, scrollTriggerRef }) {
  const { theme, isDarkMode } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { refreshChatCount } = useUnreadCountsContext();
  const { blockedUsers } = useContext(AuthContext);
  const flatListRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  const lastScrollYRef = useRef(0);

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY);

    const diff = offsetY - lastScrollYRef.current;
    if (offsetY < 50) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
    } else if (diff > 15) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", false);
    } else if (diff < -10) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
    }
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
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await getConversations();
      setConversations(response.data);
      storage.set("conversations", JSON.stringify(response.data));
      refreshChatCount();
    } catch (error) {
      console.error("Error fetching conversations:", error);
      Toast.show({
        type: "error",
        text1: t('profile.errorTitle'),
        text2: t('home.loadingError'),
      });
    }
  };

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
    const nameNorm = conversation.name?.trim().normalize("NFC").toLowerCase();
    if (nameNorm === "tán gẫu linh tinh") {
      return t("chatConversation.casualGroupName");
    }
    return conversation.name || "Unnamed Group";
  };

  const getAvatar = (conversation) => {
    if (conversation.type === "private") {
      return conversation.participants[0]?.avatar_url;
    }
    const nameNorm = conversation.name?.trim().normalize("NFC").toLowerCase();
    if (
      conversation.type === "group" &&
      nameNorm === "tán gẫu linh tinh"
    ) {
      return "local:chat.jpg";
    }
    return null;
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
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {getChatName(item)}
        </Text>
        <Text style={[styles.lastMessage, { color: theme.subText }]} numberOfLines={1}>
          {item.latest_message?.is_myself ? t('chat.you') : ""}
          {item.latest_message?.content || t('chat.noMessages')}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={[styles.time, { color: theme.subText }]}>
          {item.latest_message?.created_at
            ? formatMessageTime(item.latest_message.created_at)
            : ""}
        </Text>
        <View style={styles.unreadContainer}>
          {item.type === "group" && item.name?.trim().normalize("NFC").toLowerCase() === "tán gẫu linh tinh" && (
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('chat.title')}</Text>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate("NewConversationScreen");
          }}
        >
          <View
            className="flex-row items-center justify-center rounded-full px-3 py-2"
            style={{
              backgroundColor: theme.primary,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.22,
              shadowRadius: 2.22,
              elevation: 3,
              height: 35,
            }}
          >
            <Ionicons
              name="add"
              size={20}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={{ color: "#fff", fontWeight: "600" }}>{t('chat.newMessage')}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: isDarkMode ? "#1e2e1c" : "#F3FDF1" }]}>
        <Ionicons
          name="search"
          size={20}
          color={theme.subText}
          style={{ marginLeft: 10 }}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={t('chat.search')}
          placeholderTextColor="#A0A0A0"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredConversations}
        extraData={{ t, theme, isDarkMode }}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: 110,
          flex: filteredConversations.length === 0 ? 1 : undefined,
        }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    height: 50,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
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
