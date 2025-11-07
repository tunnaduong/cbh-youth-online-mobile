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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FastImage from "react-native-fast-image";
import {
  getConversationMessages,
  sendMessage,
  createConversation,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { storage } from "../../../global/storage";
import { AuthContext } from "../../../contexts/AuthContext";
import * as ImagePicker from "expo-image-picker";
import Api from "../../../services/api/ApiByAxios";

dayjs.locale("vi");

const CONVERSATION_CACHE_KEY = "conversation_";
const CONVERSATION_TIMESTAMP_KEY = "conversation_timestamp_";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const formatMessageTime = (timestamp) => {
  const messageTime = dayjs(timestamp);
  const hours = parseInt(messageTime.format("H"));
  const period = hours < 12 ? "SA" : "CH";
  return `${messageTime.format("hh:mm")} ${period}`;
};

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
  const { conversation, conversationId, selectedUser, isNewConversation } =
    route.params;
  const [sending, setSending] = useState(false);
  const { username, profileName } = useContext(AuthContext);
  const [currentConversation, setCurrentConversation] = useState(conversation);
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);

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
      currentConversation?.name === "Tán gẫu linh tinh"
    ) {
      return "local:chat.jpg";
    }
    return "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg";
  };

  useEffect(() => {
    if (!isNewConversation) {
      loadInitialMessages();
      fetchMessages(true);
    }
  }, []);

  // Auto-refresh messages every 5 seconds
  useEffect(() => {
    if (isNewConversation) return;

    const interval = setInterval(() => {
      fetchMessages(true, true); // Refresh in background
    }, 5000);

    return () => clearInterval(interval);
  }, [isNewConversation, currentConversationId]);

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
        currentConversationId || conversationId,
        isRefresh ? 1 : page
      );

      const newMessages = response.data.data;

      if (isRefresh) {
        // Store in MMKV
        const cacheId = currentConversationId || conversationId;
        storage.set(getCacheKey(cacheId), JSON.stringify(newMessages));
        storage.set(getTimestampKey(cacheId), Date.now());
      }

      const transformed = injectTimeHeaders(newMessages);

      if (!isBackground) {
        setMessages(transformed);
        setHasMore(response.current_page < response.last_page);
        setPage((prev) => (isRefresh ? 2 : prev + 1));
      } else if (
        JSON.stringify(newMessages) !==
        storage.getString(getCacheKey(currentConversationId || conversationId))
      ) {
        // Update UI only if new data is different from cached data
        setMessages(transformed);
        setPage(2);
      }
    } catch (error) {
      console.log("Error fetching messages:", error.response?.data);
    } finally {
      if (!isBackground) {
        setRefreshing(false);
      }
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Quyền truy cập",
          text2: "Cần quyền truy cập thư viện ảnh để gửi ảnh.",
        });
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await sendImageMessage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể chọn ảnh. Vui lòng thử lại.",
      });
    }
  };

  const sendImageMessage = async (imageUri) => {
    const tempId = Date.now().toString();
    try {
      if (sending) return;

      setSending(true);

      const now = new Date().toISOString();
      const fileName = imageUri.split("/").pop() || "image.jpg";
      const fileType = "image/jpeg";

      // Create FormData
      const formData = new FormData();
      formData.append("file", {
        uri: imageUri,
        type: fileType,
        name: fileName,
      });
      formData.append("type", "image");
      formData.append("content", ""); // Empty content for image messages

      // Optimistic message
      const optimisticMessage = {
        id: tempId,
        content: "",
        type: "image",
        file_url: imageUri, // Use local URI temporarily
        created_at: now,
        created_at_human: formatMessageTime(now),
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
            dateText = "Hôm nay";
          } else if (isYesterday) {
            dateText = "Hôm qua";
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
              time: formatMessageTime(now),
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
            },
          ],
          id: newConversationId,
          latest_message: null,
          type: "private",
        });

        // Send image message
        response = await Api.postFormDataRequest(
          `/v1.0/chat/conversations/${newConversationId}/messages`,
          formData
        );

        navigation.setParams({
          conversation: {
            participants: [
              {
                id: selectedUser.id,
                profile_name: selectedUser.profile_name,
                avatar_url: selectedUser.avatar_url,
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
          formData
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
            dateText = "Hôm nay";
          } else if (isYesterday) {
            dateText = "Hôm qua";
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
              time: formatMessageTime(response.data.created_at),
            });
          }
        }

        messagesToAdd.push({ ...response.data, type: "message" });
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
      console.error("Error sending image:", error);

      // Remove optimistic message on error
      setMessages((prev) => {
        return prev.filter((msg) => {
          if (!msg || !msg.id || typeof msg.id !== "string") return true;
          return !msg.id.includes(tempId);
        });
      });

      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể gửi ảnh. Vui lòng thử lại sau.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
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
        created_at_human: formatMessageTime(now),
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
            dateText = "Hôm nay";
          } else if (isYesterday) {
            dateText = "Hôm qua";
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
              time: formatMessageTime(now),
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
          selectedUser?.id
        );
        const createResponse = await createConversation(selectedUser.id);
        console.log(
          "[Debug] Create conversation response:",
          createResponse.data
        );

        const newConversationId = createResponse.data.conversation_id;
        setCurrentConversationId(newConversationId);
        setCurrentConversation({
          participants: [
            {
              id: selectedUser.id,
              profile_name: selectedUser.profile_name,
              avatar_url: selectedUser.avatar_url,
            },
          ],
          id: newConversationId,
          latest_message: null,
          type: "private",
        });

        // Then send message
        console.log(
          "[Debug] Sending first message to new conversation:",
          newConversationId
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
          currentConversationId
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
          prev
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
            dateText = "Hôm nay";
          } else if (isYesterday) {
            dateText = "Hôm qua";
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
              time: formatMessageTime(response.data.created_at),
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
            JSON.stringify(cachedMessages)
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
        {/* Show sender name for group chats when sender changes */}
        {isGroupChat && !item.is_myself && senderChanged && (
          <Text style={styles.senderName}>
            {item.sender?.profile_name || item.sender?.username || "Ẩn danh"}
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
            style={[
              styles.messageBubble,
              item.is_myself
                ? styles.myMessageBubble
                : styles.theirMessageBubble,
              !item.is_myself && !isLastInGroup && { marginLeft: 40 },
              item.type === "image" && styles.imageMessageBubble,
            ]}
          >
            {item.type === "image" && item.file_url ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  // TODO: Open image in full screen viewer
                }}
              >
                <FastImage
                  source={{
                    uri: item.file_url.startsWith("http")
                      ? item.file_url
                      : `https://chuyenbienhoa.com${item.file_url}`,
                  }}
                  style={styles.messageImage}
                  resizeMode={FastImage.resizeMode.cover}
                />
                {sending && item.is_myself && !item.read_at && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.messageText}>{item.content}</Text>
            )}
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
            <Text style={styles.messageTime}>
              {formatMessageTime(item.created_at)}
            </Text>
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
            source={
              getHeaderAvatar() === "local:chat.jpg"
                ? require("../../../assets/chat.jpg")
                : {
                    uri:
                      getHeaderAvatar() ||
                      "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg",
                  }
            }
            style={styles.headerAvatar}
          />
          <Text style={styles.headerName}>
            {isNewConversation
              ? selectedUser.profile_name
              : currentConversation?.type === "group"
              ? currentConversation?.name || "Unnamed Group"
              : currentConversation?.participants[0]?.profile_name}
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
            <TouchableOpacity
              style={styles.attachButton}
              onPress={pickImage}
              disabled={sending}
            >
              <Ionicons name="image-outline" size={24} color="#666" />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Nội dung tin nhắn"
              placeholderTextColor="#999"
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
  imageMessageBubble: {
    padding: 0,
    overflow: "hidden",
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
    color: "#000",
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
  senderName: {
    fontSize: 12,
    color: "#666",
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
});

export default ConversationScreen;
