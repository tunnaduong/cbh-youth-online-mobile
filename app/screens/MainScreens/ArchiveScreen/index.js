import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStoryArchive } from "../../../services/api/Api";
import FastImage from "react-native-fast-image";
import Toast from "react-native-toast-message";
import InstagramStories from "@birdwingo/react-native-instagram-stories";
import { AuthContext } from "../../../contexts/AuthContext";

const { width } = Dimensions.get("window");
const STORY_SIZE = (width - 48) / 3; // 3 columns with padding

const ArchiveScreen = ({ route, navigation }) => {
  const { username: currentUsername } = useContext(AuthContext);
  const [archiveData, setArchiveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStories, setSelectedStories] = useState(null);
  const storyRef = React.useRef(null);
  const username = route.params?.username || currentUsername;

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const response = await getStoryArchive();
      if (response?.data?.data) {
        setArchiveData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching archive:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể tải kho lưu trữ.",
      });
    } finally {
      setLoading(false);
    }
  };

  const transformStoriesForViewer = (stories) => {
    return {
      uid: "archive",
      id: "archive",
      name: "Kho lưu trữ",
      avatarSource: {
        uri: `https://api.chuyenbienhoa.com/users/${username}/avatar`,
      },
      stories: stories.map((story) => ({
        id: story.id,
        storyId: story.id,
        source: {
          uri: `https://api.chuyenbienhoa.com${story.media_url}`,
        },
        duration: 10,
        date: story.created_at_human,
        renderFooter: () => (
          <View
            style={{
              position: "absolute",
              bottom: 20,
              left: 0,
              right: 0,
              paddingHorizontal: 16,
              zIndex: 9999,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => {
                storyRef.current?.hide();
                setTimeout(() => {
                  navigation.navigate("StoryViewersScreen", {
                    storyId: story.id,
                  });
                }, 100);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.5)",
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 20,
              }}
            >
              <Ionicons name="eye" size={20} color="#fff" />
              <Text style={{ color: "white", marginLeft: 8, fontWeight: 'bold' }}>
                {story.viewers_count} người xem
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ padding: 10 }}>
              <Ionicons name="heart" size={24} color={story.user_has_liked ? "#ff3b30" : "#fff"} />
            </TouchableOpacity>
          </View>
        ),
      })),
    };
  };

  const handleStoryPress = (stories, startIndex) => {
    const transformedStories = transformStoriesForViewer(stories);
    setSelectedStories(transformedStories);
    setTimeout(() => {
      storyRef.current?.show("archive", startIndex);
    }, 100);
  };

  const renderStoryItem = ({ item: story, index }) => {
    const isExpired = story.is_expired;

    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => handleStoryPress([story], 0)}
      >
        {story.media_url ? (
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com${story.media_url}`,
            }}
            style={styles.storyImage}
          />
        ) : (
          <View style={[styles.storyImage, styles.storyPlaceholder]}>
            <Ionicons name="text" size={32} color="#999" />
          </View>
        )}
        {isExpired && (
          <View style={styles.expiredOverlay}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.storyInfo}>
          <View style={styles.storyStats}>
            <Ionicons name="eye-outline" size={12} color="#666" />
            <Text style={styles.storyStatText}>{story.viewers_count}</Text>
          </View>
          <View style={styles.storyStats}>
            <Ionicons name="heart-outline" size={12} color="#666" />
            <Text style={styles.storyStatText}>{story.reactions_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDateSection = ({ item: dateGroup }) => {
    const stories = dateGroup.stories || [];

    return (
      <View style={styles.dateSection}>
        <Text style={styles.dateTitle}>{dateGroup.date_human}</Text>
        <FlatList
          data={stories}
          renderItem={renderStoryItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={3}
          scrollEnabled={false}
          contentContainerStyle={styles.storiesGrid}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kho lưu trữ</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Privacy notice */}
      <View style={styles.privacyNotice}>
        <Ionicons name="lock-closed-outline" size={16} color="#666" />
        <Text style={styles.privacyText}>
          Tin đã lưu trữ sẽ chỉ hiển thị với mình bạn.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#319527" />
        </View>
      ) : archiveData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Chưa có story nào</Text>
        </View>
      ) : (
        <FlatList
          data={archiveData}
          renderItem={renderDateSection}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
        />
      )}

      {selectedStories && (
        <InstagramStories
          ref={storyRef}
          stories={[selectedStories]}
          hideAvatarList={true}
          showName={false}
          textStyle={{
            color: "#fff",
            textShadowColor: "rgba(0, 0, 0, 0.8)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 1.5,
            fontWeight: "600",
          }}
          progressColor="#a4a4a4"
          closeIconColor="#c4c4c4"
          modalAnimationDuration={300}
          storyAnimationDuration={300}
          onHide={() => setSelectedStories(null)}
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
  privacyNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    gap: 6,
  },
  privacyText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
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
    paddingVertical: 16,
  },
  dateSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  storiesGrid: {
    gap: 8,
  },
  storyItem: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  storyImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  storyPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  expiredOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  storyInfo: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    gap: 8,
  },
  storyStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  storyStatText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
  },
});

export default ArchiveScreen;
