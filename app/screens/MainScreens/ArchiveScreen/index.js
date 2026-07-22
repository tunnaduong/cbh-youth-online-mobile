import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getStoryArchive } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import { DeviceEventEmitter } from "react-native";
import StoryViewersSheet from "../../../components/StoryViewersSheet";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import InstagramStories from "@birdwingo/react-native-instagram-stories";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import formatTime from "../../../utils/formatTime";
import { useTheme } from "../../../contexts/ThemeContext";

const { width } = Dimensions.get("window");
const STORY_SIZE = (width - 48) / 3; // 3 columns with padding

const ArchiveScreen = ({ route, navigation }) => {
  const { username: currentUsername } = useContext(AuthContext);
  const [archiveData, setArchiveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStories, setSelectedStories] = useState(null);
  const storyRef = React.useRef(null);
  const username = route.params?.username || currentUsername;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const formatDateHeader = (dateStr) => {
    if (!dateStr) return "";
    const d = dayjs(dateStr);
    if (!d.isValid()) return dateStr;

    const today = dayjs().startOf("day");
    const yesterday = dayjs().subtract(1, "day").startOf("day");
    const itemDate = d.startOf("day");

    if (itemDate.isSame(today)) {
      return t("chatConversation.today");
    } else if (itemDate.isSame(yesterday)) {
      return t("chatConversation.yesterday");
    } else {
      return d.format("DD/MM/YYYY");
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const resolveStoryMediaUrl = (story) => {
    const candidates = [
      story?.media_url,
      story?.thumbnail_url,
      story?.thumbnail,
      story?.thumb_url,
      story?.preview_url,
      story?.file_url,
      story?.image_url,
      story?.media?.url,
      story?.media?.thumbnail,
      story?.image?.url,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        const normalized = candidate.trim();
        if (/^https?:\/\//i.test(normalized)) {
          return normalized;
        }
        if (normalized.startsWith("/")) {
          return `https://api.chuyenbienhoa.com${normalized}`;
        }
        return `https://api.chuyenbienhoa.com/${normalized.replace(/^\/+/, "")}`;
      }
    }

    return null;
  };

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
        text1: t('common.error'),
        text2: t('archive.loadError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const getStoryPlaceholderUri = () => {
    return "https://placehold.co/1080x1920/111827/ffffff.png?text=Story";
  };

  const shadeHex = (hex, percent) => {
    try {
      let h = hex.replace('#', '').trim();
      if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
      }
      const num = parseInt(h, 16);
      let r = (num >> 16) + Math.round(255 * (percent / 100));
      let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
      let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) {
      return hex;
    }
  };

  const normalizeGradientColors = (story) => {
    if (!story) return ['#0f172a'];
    if (Array.isArray(story.gradient_colors) && story.gradient_colors.length > 0) {
      return story.gradient_colors.map((c) => String(c));
    }
    if (story.background_color) {
      try {
        const parsed = JSON.parse(story.background_color);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((c) => String(c));
        if (typeof parsed === 'string') return [String(parsed)];
      } catch {
        if (typeof story.background_color === 'string' && story.background_color.trim()) {
          return [story.background_color.trim()];
        }
      }
    }
    return ['#0f172a'];
  };

  const transformStoriesForViewer = (stories) => {
    return {
      uid: "archive",
      id: "archive",
      name: t('archive.title'),
      avatarSource: {
        uri: `https://api.chuyenbienhoa.com/users/${username}/avatar`,
      },
      stories: stories.map((story) => {
        const mediaUrl = resolveStoryMediaUrl(story);
        const storyType = String(story?.type || story?.media_type || "").toLowerCase();
        const isVideoStory = Boolean(mediaUrl) && (
          storyType === "video" ||
          /\.(mp4|mov|m4v|avi)$/i.test(mediaUrl)
        );

        return {
        id: story.id,
        storyId: story.id,
        source: {
          uri: mediaUrl || getStoryPlaceholderUri(),
        },
        duration: 10,
        mediaType: isVideoStory ? "video" : undefined,
        media_type: isVideoStory ? "video" : storyType || "image",
        is_muted: story.is_muted || false,
        date: formatTime(story.created_at || story.created_at_human),
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
                // Only show viewers for stories that belong to the current user
                if (username === currentUsername) {
                  setTimeout(() => {
                    DeviceEventEmitter.emit("SHOW_STORY_VIEWERS", { storyId: story.id, isOwn: true });
                  }, 100);
                }
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
                {t('archive.viewersCount', { count: story.viewers_count })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ padding: 10 }}>
              <Ionicons name="heart" size={24} color={story.user_has_liked ? "#ff3b30" : "#fff"} />
            </TouchableOpacity>
          </View>
        ),
        };
      }),
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
        {(() => {
          const mediaUri = resolveStoryMediaUrl(story);
          if (mediaUri) {
            return (
              <FastImage
                source={{ uri: mediaUri }}
                style={[styles.storyImage, { backgroundColor: theme.surface }]}
              />
            );
          }

          // Render a styled thumbnail for text-only web stories
          const gradientColorsRaw = normalizeGradientColors(story);
          const finalColors = gradientColorsRaw.length > 1 ? gradientColorsRaw : [gradientColorsRaw[0], shadeHex(gradientColorsRaw[0], -12)];

          const previewText = (story.text_content || story.content || '').trim();

          return (
            <LinearGradient
              colors={finalColors}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.storyImage, { justifyContent: 'center', alignItems: 'center' }]}
            >
              <Text numberOfLines={3} style={{ color: '#fff', fontWeight: '700', textAlign: 'center', paddingHorizontal: 8 }}>
                {previewText || 'Story'}
              </Text>
            </LinearGradient>
          );
        })()}
        {isExpired && (
          <View style={styles.expiredOverlay}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
          </View>
        )}
        <View style={styles.storyInfo}>
          <View style={styles.storyStats}>
            <Ionicons name="eye-outline" size={12} color={theme.subText} />
            <Text style={styles.storyStatText}>{story.viewers_count}</Text>
          </View>
          <View style={styles.storyStats}>
            <Ionicons name="heart-outline" size={12} color={theme.subText} />
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
        <Text style={[styles.dateTitle, { color: theme.text }]}>{formatDateHeader(dateGroup.date)}</Text>
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBackground, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('archive.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Privacy notice */}
      <View style={[styles.privacyNotice, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Ionicons name="lock-closed-outline" size={16} color={theme.subText} />
        <Text style={[styles.privacyText, { color: theme.subText }]}>
          {t('archive.privacyNotice')}
        </Text>
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color="#319527" />
        </View>
      ) : archiveData.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
          <Ionicons name="archive-outline" size={64} color={theme.placeholder} />
          <Text style={[styles.emptyText, { color: theme.subText }]}>{t('archive.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={archiveData}
          renderItem={renderDateSection}
          keyExtractor={(item) => item.date}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        />
      )}

      {selectedStories && (
        <InstagramStories
          ref={storyRef}
          stories={[selectedStories]}
          hideAvatarList={true}
          showName={false}
          statusBarTranslucent={Platform.OS === "android"}
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

      <StoryViewersSheet />
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
