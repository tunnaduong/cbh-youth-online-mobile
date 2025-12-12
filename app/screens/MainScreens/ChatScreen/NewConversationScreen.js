import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  searchChatUsername,
  createConversation,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
import CustomLoading from "../../../components/CustomLoading";

const NewConversationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim().length === 0) {
      setSearchResult(null);
      return;
    }

    setLoading(true);
    try {
      const response = await searchChatUsername(query);
      setSearchResult(response.data);
    } catch (error) {
      //   console.error("Error searching users:", error.response?.data);
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async (selectedUser, existingConversationId) => {
    try {
      // If there's an existing conversation, navigate to it directly
      if (existingConversationId) {
        // Try to get the conversation from cache first
        const cachedConversations = storage.getString("conversations");
        if (cachedConversations) {
          const conversations = JSON.parse(cachedConversations);
          const existingConversation = conversations.find(
            (conv) => conv.id === existingConversationId
          );
          if (existingConversation) {
            navigation.pop();
            setTimeout(() => {
              navigation.navigate("ConversationScreen", {
                conversation: existingConversation,
                conversationId: existingConversationId,
              });
            }, 100);
            return;
          }
        }
      }

      // Navigate to conversation screen with selected user data
      navigation.pop();
      setTimeout(() => {
        navigation.navigate("ConversationScreen", {
          selectedUser: {
            id: selectedUser.id,
            profile_name: selectedUser.profile_name,
            username: selectedUser.username,
            avatar_url: selectedUser.avatar_url,
          },
          isNewConversation: true,
        });
      }, 100);
    } catch (error) {
      console.error("Error navigating to conversation:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể mở cuộc trò chuyện. Vui lòng thử lại sau.",
      });
    }
  };

  const renderUserResult = () => {
    if (!searchResult?.user) return null;

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() =>
          startConversation(
            searchResult.user,
            searchResult.existing_conversation_id
          )
        }
      >
        <Image
          source={{ uri: searchResult.user.avatar_url }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {searchResult.user.profile_name || searchResult.user.username}
          </Text>
          <Text style={styles.userHandle}>@{searchResult.user.username}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, height: 50 + insets.top },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tin nhắn mới</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm người dùng..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Results */}
      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.centerContainer}>
            <CustomLoading />
          </View>
        ) : searchResult?.user ? (
          renderUserResult()
        ) : searchQuery.length > 0 ? (
          <View style={styles.centerContainer}>
            <Image
              source={require("../../../assets/sad_frog.png")}
              style={{ width: 100, height: 100, marginBottom: 5 }}
            />
            <Text style={styles.noResults}>Không tìm thấy người dùng nào</Text>
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <Image
              source={require("../../../assets/search-main.png")}
              style={{ width: 180, height: 160, marginBottom: 20 }}
            />
            <Text style={styles.searchPrompt}>
              Nhập username để bắt đầu tìm kiếm
            </Text>
          </View>
        )}
      </View>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  userHandle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noResults: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  searchPrompt: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});

export default NewConversationScreen;
