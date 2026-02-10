import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getConversations } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
import { useFocusEffect } from "@react-navigation/native";
import { useUnreadCountsContext } from "../../../contexts/UnreadCountsContext";
import { AuthContext } from "../../../contexts/AuthContext";
import dayjs from "dayjs";
import { useTheme } from "../../../contexts/ThemeContext";

const formatMessageTime = (timestamp) => {
  // ... same formatMessageTime function ...
};

export default function ChatScreen({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();
  const { refreshChatCount } = useUnreadCountsContext();
  const { blockedUsers } = useContext(AuthContext);

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
        text1: "Lỗi",
        text2: "Không thể tải danh sách tin nhắn. Vui lòng thử lại sau.",
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
    return conversation.name || "Unnamed Group";
  };

  const getAvatar = (conversation) => {
    if (conversation.type === "private") {
      return conversation.participants[0]?.avatar_url;
    }
    if (
      conversation.type === "group" &&
      conversation.name === "Tán gẫu linh tinh"
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
          {item.latest_message?.is_myself ? "Bạn: " : ""}
          {item.latest_message?.content || "Chưa có tin nhắn nào"}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={[styles.time, { color: theme.subText }]}>
          {item.latest_message?.created_at
            ? formatMessageTime(item.latest_message.created_at)
            : ""}
        </Text>
        <View style={styles.unreadContainer}>
          {item.type === "group" && item.name === "Tán gẫu linh tinh" && (
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
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Tin nhắn</Text>
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
              size={24}
              color="#fff"
              style={{ marginTop: -3 }}
            />
            <Text style={{ color: "#fff", fontWeight: "600" }}>Tin nhắn mới</Text>
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
          placeholder="Tìm kiếm bạn bè, tin nhắn..."
          placeholderTextColor={theme.subText}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingBottom: 80,
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
                  ? "Không tìm thấy cuộc trò chuyện nào..."
                  : "Chưa có cuộc trò chuyện nào..."}
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
