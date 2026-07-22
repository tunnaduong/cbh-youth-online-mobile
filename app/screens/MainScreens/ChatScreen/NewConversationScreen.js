import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import {
  searchChatUsername,
  createConversation,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
import CustomLoading from "../../../components/CustomLoading";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const NewConversationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isHeaderElevated, setIsHeaderElevated] = useState(false);
  const { t } = useTranslation();

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
        text1: t('common.error'),
        text2: t('chatConversation.cannotOpen'),
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
          <Text style={[styles.userName, { color: theme.text }]}>
            {searchResult.user.profile_name || searchResult.user.username}
          </Text>
          <Text style={[styles.userHandle, { color: theme.subText }]}>@{searchResult.user.username}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            height: 50 + insets.top,
            backgroundColor: theme.background,
            borderBottomColor: theme.border,
            borderBottomWidth: isHeaderElevated ? 1 : 0,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('chat.newMessage')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: isDarkMode ? "#1f2937" : "#F3FDF1", borderColor: theme.border }]}>
        <Ionicons
          name="search"
          size={20}
          color={theme.subText}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={t('chat.searchUserPlaceholder')}
          placeholderTextColor={theme.subText}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={styles.resultsContentContainer}
        onScroll={(event) => setIsHeaderElevated(event.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={16}
      >
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
            <Text style={[styles.noResults, { color: theme.subText }]}>{t('chat.noUserFound')}</Text>
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <Image
              source={require("../../../assets/search-main.png")}
              style={{ width: 180, height: 160, marginBottom: 20 }}
            />
            <Text style={[styles.searchPrompt, { color: theme.subText }]}>
              {t('chat.searchUserHint')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
  },
  userHandle: {
    fontSize: 14,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 260,
  },
  noResults: {
    fontSize: 16,
    textAlign: "center",
  },
  searchPrompt: {
    fontSize: 16,
    textAlign: "center",
  },
});

export default NewConversationScreen;
