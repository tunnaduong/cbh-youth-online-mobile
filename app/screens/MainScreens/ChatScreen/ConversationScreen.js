import React, { useState, useRef, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FastImage from "react-native-fast-image";
import {
  getConversationMessages,
  sendMessage,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import dayjs from "dayjs";
import { storage } from "../../../global/storage";
import { AuthContext } from "../../../contexts/AuthContext";

const CONVERSATION_CACHE_KEY = "conversation_";
const CONVERSATION_TIMESTAMP_KEY = "conversation_timestamp_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const injectTimeHeaders = (messages) => {
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
        dateText = "Hôm nay";
      } else if (isYesterday) {
        dateText = "Hôm qua";
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

    result.push({ ...msg, type: "message" });
  });

  return result;
};

const ConversationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const inputRef = useRef(null);
  const { conversation, conversationId } = route.params;
  const [sending, setSending] = useState(false);
  const { username, profileName } = useContext(AuthContext);

  useEffect(() => {
    loadInitialMessages();
    fetchMessages(true);
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
        const transformed = injectTimeHeaders(parsedData);
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
        conversationId,
        isRefresh ? 1 : page
      );

      const newMessages = response.data.data;

      if (isRefresh) {
        // Store in MMKV
        storage.set(getCacheKey(conversationId), JSON.stringify(newMessages));
        storage.set(getTimestampKey(conversationId), Date.now());
      }

      const transformed = injectTimeHeaders(newMessages);

      if (!isBackground) {
        setMessages(transformed);
        setHasMore(response.current_page < response.last_page);
        setPage((prev) => (isRefresh ? 2 : prev + 1));
      } else if (
        JSON.stringify(newMessages) !==
        storage.getString(getCacheKey(conversationId))
      ) {
        // Update UI only if new data is different from cached data
        setMessages(transformed);
        setPage(2);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      if (!isBackground) {
        Toast.show({
          type: "error",
          text1: "Lỗi",
          text2: "Không thể tải tin nhắn. Vui lòng thử lại sau.",
        });
      }
    } finally {
      if (!isBackground) {
        setRefreshing(false);
      }
    }
  };

  const handleSendMessage = async () => {
    try {
      if (!message.trim() || sending) return;

      const trimmedMessage = message.trim();
      const tempId = Date.now().toString();
      const optimisticMessage = {
        id: tempId,
        content: trimmedMessage,
        created_at: new Date().toISOString(),
        created_at_human: "1 giây trước",
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
      // Add optimistic message
      setMessages((prev) => [...prev, optimisticMessage]);

      setSending(true);
      const response = await sendMessage(conversationId, {
        content: trimmedMessage,
        type: "text",
      });

      // Replace optimistic message with real one
      setMessages((prev) => {
        const newMessages = prev.filter((msg) =>
          msg.type === "message" ? msg.id !== tempId : true
        );
        return [...newMessages, response.data];
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages((prev) =>
        prev.filter((msg) =>
          msg.type === "message" ? msg.id !== tempId : true
        )
      );
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể gửi tin nhắn. Vui lòng thử lại sau.",
      });
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    if (item.type === "date") {
      return (
        <View style={styles.dateHeaderContainer}>
          <Text style={styles.dateHeaderText}>{item.date}</Text>
        </View>
      );
    }

    if (item.type === "time") {
      return (
        <View style={styles.timeHeaderContainer}>
          <Text style={styles.timeHeaderText}>{item.time}</Text>
        </View>
      );
    }

    const isFirstInGroup =
      index === 0 || messages[index - 1]?.is_myself !== item.is_myself;

    const isLastInGroup =
      index === messages.length - 1 ||
      messages[index + 1]?.is_myself !== item.is_myself;

    return (
      <View>
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
              source={{ uri: item.sender?.avatar_url }}
              style={styles.messageAvatar}
            />
          )}
          <View
            style={[
              styles.messageBubble,
              item.is_myself
                ? styles.myMessageBubble
                : styles.theirMessageBubble,
              !item.is_myself && !isLastInGroup && { marginLeft: 40 },
            ]}
          >
            <Text style={styles.messageText}>{item.content}</Text>
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
            <Text style={styles.messageTime}>{item.created_at_human}</Text>
            {item.is_myself && (
              <View style={styles.readStatus}>
                {item.read_at ? (
                  <View style={styles.doubleCheck}>
                    <Ionicons
                      name="checkmark"
                      size={12}
                      color="#319527"
                      style={styles.checkOverlap}
                    />
                    <Ionicons name="checkmark" size={12} color="#319527" />
                  </View>
                ) : (
                  <Ionicons name="checkmark" size={12} color="#888" />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: 60 + insets.top },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerProfile}>
          <FastImage
            source={{ uri: conversation?.participants[0]?.avatar_url }}
            style={styles.headerAvatar}
          />
          <Text style={styles.headerName}>
            {conversation?.participants[0]?.profile_name}
          </Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) =>
          item.is_myself ? "my" + item.id : "their" + item.id
        }
        contentContainerStyle={styles.messagesList}
        inverted={true}
        onEndReached={() => !refreshing && fetchMessages()}
        onEndReachedThreshold={0.3}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView behavior={"padding"}>
        <SafeAreaView>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton}>
              <Ionicons name="image-outline" size={24} color="#666" />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Nội dung tin nhắn"
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: message.trim() ? "#319527" : "#ccc" },
              ]}
              disabled={!message.trim() || sending}
              onPress={handleSendMessage}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  messagesList: {
    padding: 16,
    flexDirection: "column-reverse",
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
    backgroundColor: "#E8F5E9",
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: "#F5F5F5",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: "#000",
  },
  messageTime: {
    fontSize: 12,
    color: "#888",
  },
  myMessageTime: {
    textAlign: "right",
    marginRight: 4,
  },
  theirMessageTime: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    padding: 8,
    backgroundColor: "#f5f5f5",
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
    color: "#666",
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
    color: "#666",
    backgroundColor: "#f0f0f0",
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
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    fontWeight: "600",
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
});

export default ConversationScreen;
