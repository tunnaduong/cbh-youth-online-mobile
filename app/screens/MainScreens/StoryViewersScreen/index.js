import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStoryViewers } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";
import { useTheme } from "../../../contexts/ThemeContext";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import UserNameRow from "../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";

const StoryViewersScreen = ({ route, navigation }) => {
  const { storyId } = route.params;
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

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
        text1: t('common.error'),
        text2: t('storyViewers.loadError'),
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
        style={[styles.viewerItem, { borderBottomColor: theme.border }]}
        onPress={() => {
          navigation.navigate("ProfileScreen", {
            username: item.username,
          });
        }}
      >
        <AvatarFrameWrap theme={item.profile_theme} size={50} style={{ marginRight: 12 }}>
          <FastImage
            source={{ uri: item.profile_picture }}
            style={[styles.avatar, { marginRight: 0 }]}
          />
        </AvatarFrameWrap>
        <View style={styles.viewerInfo}>
          <UserNameRow
            name={item.profile_name}
            theme={item.profile_theme}
            verified={!!item.verified}
            verifiedColor={theme.primary}
            style={[styles.viewerName, { color: theme.text }]}
          />
          {reactionDisplay ? (
            <View style={styles.reactionsContainer}>
              <Text style={[styles.reactionsText, { color: theme.subText }]}>{reactionDisplay}</Text>
            </View>
          ) : null}
        </View>
        {(item.viewed_at || item.viewed_at_human) && (
          <Text style={[styles.viewedAt, { color: theme.subText }]}>
            {formatTime(item.viewed_at || item.viewed_at_human)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header: glass back button appears once the list scrolls under it */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
          <LiquidButton size={44} scrollY={scrollY} providerId="StoryViewersScreen" onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, flex: 1, textAlign: "center", opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t('storyViewers.title')}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : viewers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="eye-outline" size={64} color={theme.subText} />
          <Text style={[styles.emptyText, { color: theme.subText }]}>{t('storyViewers.empty')}</Text>
        </View>
      ) : (
        <AndroidGlassBackdrop providerId="StoryViewersScreen" style={{ flex: 1 }}>
          <Animated.FlatList
            data={viewers}
            renderItem={renderViewerItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            contentContainerStyle={[styles.listContent, { paddingTop: 64 + insets.top, paddingBottom: (insets?.bottom || 0) + 8 }]}
          />
        </AndroidGlassBackdrop>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
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
    minWidth: 0,
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
