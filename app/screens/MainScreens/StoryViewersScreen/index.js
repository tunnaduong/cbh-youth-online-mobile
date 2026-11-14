import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getStoryViewers, isRequestCanceled } from "../../../services/api/Api";
import FastImage from "../../../components/FastImage";
import HomeStyleHeader from "../../../components/HomeStyleHeader";
import { LinearGradient } from "expo-linear-gradient";
import { tint } from "../../../components/settings/SettingsUI";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import CustomLoading from "../../../components/CustomLoading";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";
import { useTheme } from "../../../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import UserNameRow from "../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";

const StoryViewersScreen = ({ route, navigation }) => {
  const { storyId } = route.params;
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const controller = new AbortController();
    fetchViewers(controller.signal);
    return () => controller.abort();
  }, [storyId]);

  const fetchViewers = async (signal) => {
    try {
      setLoading(true);
      const response = await getStoryViewers(storyId, { signal });
      if (signal?.aborted) return;
      if (response?.data?.data) {
        setViewers(response.data.data.viewers || []);
      }
    } catch (error) {
      if (isRequestCanceled(error) || signal?.aborted) return;
      console.error("Error fetching viewers:", error);
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('storyViewers.loadError'),
      });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
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
        activeOpacity={0.8}
        style={[styles.viewerItem, { backgroundColor: theme.surface, borderColor: isDarkMode ? "#282B34" : "#E2E8F0" }]}
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

  const header = (
    <View style={{ paddingTop: insets.top + (Platform.OS === "ios" ? 4 : 8) }}>
      <HomeStyleHeader
        title={t("storyViewers.title")}
        subtitle={loading ? undefined : String(viewers.length)}
        onBack={() => navigation.goBack()}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140 }}
        pointerEvents="none"
      />
      {loading ? (
        <View style={{ flex: 1 }}>
          {header}
          <View style={styles.loadingContainer}>
            <CustomLoading size="medium" />
          </View>
        </View>
      ) : (
        <AndroidGlassBackdrop style={{ flex: 1 }}>
          <FlatList
            data={viewers}
            renderItem={renderViewerItem}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIcon, { backgroundColor: tint("#6366F1", isDarkMode) }]}>
                  <Ionicons name="eye" size={40} color="#6366F1" />
                </View>
                <Text style={[styles.emptyText, { color: theme.subText }]}>{t("storyViewers.empty")}</Text>
              </View>
            }
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === "android"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }}
          />
        </AndroidGlassBackdrop>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginTop: 12,
    fontSize: 15,
  },
  listContent: {
    paddingVertical: 8,
  },
  viewerItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" },
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
    fontSize: 13,
  },
  viewerName: {
    fontSize: 15,
    fontWeight: "600",
  },
  viewedAt: {
    fontSize: 12,
  },
});

export default StoryViewersScreen;
