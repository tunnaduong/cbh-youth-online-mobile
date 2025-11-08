import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getConversations } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
import FastImage from "react-native-fast-image";
import { useFocusEffect } from "@react-navigation/native";
import { useUnreadCountsContext } from "../../../contexts/UnreadCountsContext";
import dayjs from "dayjs";

const formatMessageTime = (timestamp) => {
  if (!timestamp) return "";
  const messageTime = dayjs(timestamp);
  const now = dayjs();
  const diffInDays = now.diff(messageTime, "day");

  // Within the same day: show time (01:15 SA)
  if (diffInDays === 0) {
    const hours = parseInt(messageTime.format("H"));
    const period = hours < 12 ? "SA" : "CH";
    return `${messageTime.format("hh:mm")} ${period}`;
  }

  // After 1 day but within 1 week: show day of week (Th 5, Th 4, CN)
  if (diffInDays < 7) {
    const dayNames = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
    return dayNames[messageTime.day()];
  }

  // After 1 week: show day and month (29 thg 10)
  const months = [
    "thg 1",
    "thg 2",
    "thg 3",
    "thg 4",
    "thg 5",
    "thg 6",
    "thg 7",
    "thg 8",
    "thg 9",
    "thg 10",
    "thg 11",
    "thg 12",
  ];
  return `${messageTime.date()} ${months[messageTime.month()]}`;
};

export default function ChatScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();
  const { refreshChatCount } = useUnreadCountsContext();

  useFocusEffect(
    React.useCallback(() => {
      // Fetch updated data for the profile when the screen comes into focus
      fetchConversations();
      // Refresh unread count when screen is focused
      refreshChatCount();
    }, [refreshChatCount])
  );

  useEffect(() => {
    const cached = storage.getString("conversations");
    if (cached) {
      setConversations(JSON.parse(cached));
    }

    // Always fetch in background to sync with server
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const response = await getConversations();
      setConversations(response.data);
      storage.set("conversations", JSON.stringify(response.data));
      // Refresh unread count after fetching conversations
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

  // Filter conversations by participant name or last message
  const filteredConversations = conversations.filter((item) => {
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
    // Special case for "Tán gẫu linh tinh" group
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
      style={styles.conversation}
      onPress={() => {
        navigation.navigate("ConversationScreen", {
          conversationId: item.id,
          conversation: item,
        });
      }}
    >
      <FastImage
        source={
          getAvatar(item) === "local:chat.jpg"
            ? require("../../../assets/chat.jpg")
            : {
                uri:
                  getAvatar(item) ||
                  "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg",
              }
        }
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {getChatName(item)}
        </Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.latest_message?.is_myself ? "Bạn: " : ""}
          {item.latest_message?.content || "Chưa có tin nhắn nào"}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.time}>
          {item.latest_message?.created_at
            ? formatMessageTime(item.latest_message.created_at)
            : ""}
        </Text>
        <View style={styles.unreadContainer}>
          {item.type === "group" && item.name === "Tán gẫu linh tinh" && (
            <Ionicons
              name="notifications-off"
              size={18}
              color="#888"
              style={styles.muteIcon}
            />
          )}
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate("NewConversationScreen");
          }}
        >
          <View
            className="flex-row items-center justify-center bg-[#319527] rounded-full px-3 py-2"
            style={{
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
            <Text className="text-white font-semibold">Tin nhắn mới</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#888"
          style={{ marginLeft: 10 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm bạn bè, tin nhắn..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Conversation List */}
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
            style={{ height: 1, backgroundColor: "#f0f0f0", marginLeft: 80 }}
          />
        )}
        ListEmptyComponent={
          <View style={{ flex: 1, marginTop: 44 }}>
            <View style={styles.emptyContainer}>
              <Image
                source={require("../../../assets/sad_frog.png")}
                style={styles.emptyImage}
              />
              <Text style={styles.emptyText}>
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
  container: { flex: 1, backgroundColor: "#fff" },
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
    color: "#319527",
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3FDF1",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    paddingHorizontal: 10,
    backgroundColor: "transparent",
  },
  conversation: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
    backgroundColor: "#eee",
  },
  info: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: "#888",
  },
  meta: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 40,
  },
  time: {
    fontSize: 12,
    color: "#888",
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
    backgroundColor: "#319527",
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
    color: "#888",
    textAlign: "center",
  },
});
