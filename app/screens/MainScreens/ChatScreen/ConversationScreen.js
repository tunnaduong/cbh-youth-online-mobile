import React, { useState, useRef, useEffect } from "react";
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
import { getConversationMessages } from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import dayjs from "dayjs";

const injectTimeHeaders = (messages) => {
  const result = [];

  messages.forEach((msg, index) => {
    const prev = messages[index - 1];
    const currTime = dayjs(msg.created_at);

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

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setPage(1);
        setHasMore(true);
      }

      if (!hasMore && !isRefresh) return;

      const response = await getConversationMessages(
        conversationId,
        isRefresh ? 1 : page
      );
      const newMessages = response.data.data;
      const transformed = injectTimeHeaders(newMessages);
      setMessages(transformed);
      setHasMore(response.current_page < response.last_page);
      setPage((prev) => (isRefresh ? 2 : prev + 1));
    } catch (error) {
      console.error("Error fetching messages:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể tải tin nhắn. Vui lòng thử lại sau.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages(true);
  };

  const renderMessage = ({ item, index }) => {
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
              source={{ uri: item.sender.avatar_url }}
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
          <Text
            style={[
              styles.messageTime,
              item.is_myself ? styles.myMessageTime : styles.theirMessageTime,
              !item.is_myself && { marginLeft: 40 },
            ]}
          >
            {item.created_at_human}
          </Text>
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
        inverted={false}
        onEndReached={() => !refreshing && fetchMessages()}
        onEndReachedThreshold={0.3}
        refreshing={refreshing}
        onRefresh={handleRefresh}
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
              disabled={!message.trim()}
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
    marginTop: 4,
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
});

export default ConversationScreen;
