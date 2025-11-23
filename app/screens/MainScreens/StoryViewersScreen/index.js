import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStoryViewers } from "../../../services/api/Api";
import FastImage from "react-native-fast-image";
import Toast from "react-native-toast-message";

const StoryViewersScreen = ({ route, navigation }) => {
  const { storyId } = route.params;
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchViewers();
  }, []);

  const fetchViewers = async () => {
    try {
      setLoading(true);
      const response = await getStoryViewers(storyId);
      if (response?.data?.data) {
        setViewers(response.data.data.viewers || []);
      }
    } catch (error) {
      console.error("Error fetching viewers:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể tải danh sách người xem.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getReactionEmoji = (type) => {
    const emojiMap = {
      like: "👍",
      love: "❤️",
      haha: "😂",
      wow: "😮",
      sad: "😢",
      angry: "😠",
    };
    return emojiMap[type] || "👍";
  };

  const renderViewerItem = ({ item }) => {
    // Group reactions by type and count them
    const reactionGroups = {};
    item.reactions?.forEach((reaction) => {
      if (!reactionGroups[reaction.type]) {
        reactionGroups[reaction.type] = 0;
      }
      reactionGroups[reaction.type]++;
    });

    // Create reaction display text
    const reactionDisplay = Object.entries(reactionGroups)
      .map(([type, count]) => {
        const emoji = getReactionEmoji(type);
        return count > 1 ? `${emoji} ${count}` : emoji;
      })
      .join(" ");

    return (
      <TouchableOpacity
        style={styles.viewerItem}
        onPress={() => {
          navigation.navigate("ProfileScreen", {
            username: item.username,
          });
        }}
      >
        <FastImage
          source={{ uri: item.profile_picture }}
          style={styles.avatar}
        />
        <View style={styles.viewerInfo}>
          <Text style={styles.viewerName}>{item.profile_name}</Text>
          {reactionDisplay ? (
            <View style={styles.reactionsContainer}>
              <Text style={styles.reactionsText}>{reactionDisplay}</Text>
            </View>
          ) : null}
        </View>
        {item.viewed_at_human && (
          <Text style={styles.viewedAt}>{item.viewed_at_human}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Người xem</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#319527" />
        </View>
      ) : viewers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="eye-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Chưa có người xem</Text>
        </View>
      ) : (
        <FlatList
          data={viewers}
          renderItem={renderViewerItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
  },
  listContent: {
    paddingVertical: 8,
  },
  viewerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  viewerInfo: {
    flex: 1,
  },
  reactionsContainer: {
    marginTop: 4,
  },
  reactionsText: {
    fontSize: 14,
    color: "#666",
  },
  viewerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  viewedAt: {
    fontSize: 12,
    color: "#999",
  },
});

export default StoryViewersScreen;
