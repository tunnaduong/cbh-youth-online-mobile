import React, { useEffect, useRef, useState } from "react";
import FastImage from "../../../components/FastImage";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  searchChatUsername,
  createConversation,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { storage } from "../../../global/storage";
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

  // Each keystroke used to fire its own request, so a fast typist could get
  // an older response landing after a newer one. Debounce, and ignore any
  // reply that isn't for the query currently in the box.
  const latestQueryRef = useRef("");

  useEffect(() => {
    const query = searchQuery.trim();
    latestQueryRef.current = query;

    if (!query) {
      setSearchResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await searchChatUsername(query);
        if (latestQueryRef.current !== query) return;
        setSearchResult(response.data);
      } catch (error) {
        if (latestQueryRef.current !== query) return;
        setSearchResult(null);
      } finally {
        if (latestQueryRef.current === query) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        text1: t("common.error"),
        text2: t("chatConversation.cannotOpen"),
      });
    }
  };

  const renderUserResult = () => {
    const user = searchResult?.user;
    if (!user) return null;

    const hasExisting = !!searchResult.existing_conversation_id;

    return (
      <>
        <Text style={[styles.sectionLabel, { color: theme.subText }]}>
          {t("chat.resultsLabel", "KẾT QUẢ")}
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity
            style={styles.userItem}
            activeOpacity={0.6}
            onPress={() =>
              startConversation(user, searchResult.existing_conversation_id)
            }
          >
            <FastImage source={{ uri: user.avatar_url }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text
                style={[styles.userName, { color: theme.text }]}
                numberOfLines={1}
              >
                {user.profile_name || user.username}
              </Text>
              <Text
                style={[styles.userHandle, { color: theme.subText }]}
                numberOfLines={1}
              >
                @{user.username}
              </Text>
              <Text style={[styles.userAction, { color: theme.primary }]}>
                {hasExisting
                  ? t("chat.continueConversation", "Tiếp tục cuộc trò chuyện")
                  : t("chat.startConversation", "Bắt đầu cuộc trò chuyện mới")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </TouchableOpacity>
        </View>
      </>
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
            borderBottomWidth: isHeaderElevated ? StyleSheet.hairlineWidth : 0,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("chat.newMessage")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: isDarkMode ? "#1f2937" : "#F3FDF1",
            borderColor: theme.border,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={19}
          color={theme.subText}
          style={styles.searchIcon}
        />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder={t("chat.searchUserPlaceholder")}
          placeholderTextColor={theme.subText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={theme.subText} />
        ) : searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={theme.subText} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Results */}
      <ScrollView
        style={styles.resultsContainer}
        contentContainerStyle={styles.resultsContentContainer}
        onScroll={(event) =>
          setIsHeaderElevated(event.nativeEvent.contentOffset.y > 4)
        }
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {searchResult?.user ? (
          // Results sit directly under the search bar; only the placeholder
          // states below are centred in the empty space.
          renderUserResult()
        ) : loading ? null : searchQuery.trim().length > 0 ? (
          <View style={styles.centerContainer}>
            <Image
              source={require("../../../assets/sad_frog.png")}
              style={{ width: 100, height: 100, marginBottom: 12 }}
            />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t("chat.noUserFound")}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.subText }]}>
              {t("chat.noUserFoundHint", "Hãy kiểm tra lại username và thử lần nữa.")}
            </Text>
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <Image
              source={require("../../../assets/search-main.png")}
              style={{ width: 180, height: 160, marginBottom: 16 }}
            />
            <Text style={[styles.emptyBody, { color: theme.subText }]}>
              {t("chat.searchUserHint")}
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
    fontSize: 17,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchIcon: {
    marginRight: 0,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
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
    fontWeight: "600",
  },
  userHandle: {
    fontSize: 13,
    marginTop: 1,
  },
  userAction: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 260,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});

export default NewConversationScreen;
