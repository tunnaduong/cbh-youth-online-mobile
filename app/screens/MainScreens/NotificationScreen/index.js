import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
  Animated,
  DeviceEventEmitter,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomLoading from "../../../components/CustomLoading";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../../../services/api/Api";
import { useUnreadCountsContext } from "../../../contexts/UnreadCountsContext";
import { useFocusEffect } from "@react-navigation/native";
import formatTime from "../../../utils/formatTime";
import { useTheme } from "../../../contexts/ThemeContext";
import { storage } from "../../../global/storage";
import { useTranslation } from "react-i18next";

// Helper function to format notification message based on type and data
const formatNotificationMessage = (notification, t) => {
  const { type, data, actor } = notification;

  // System messages don't have an actor
  if (type === "system_message") {
    return data?.message || t('notifications.newNotification');
  }

  if (!actor) {
    // Handle other notifications without actor
    switch (type) {
      case "topic_pinned":
        return `${t('notifications.pinnedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
      case "topic_moved":
        return `${t('notifications.movedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
      case "topic_closed":
        return `${t('notifications.closedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
      default:
        return t('notifications.newNotification');
    }
  }

  const actorName = actor.profile_name || actor.username;

  switch (type) {
    case "topic_liked":
      return `${t('notifications.likedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "topic_commented":
      return `${t('notifications.commentedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "comment_liked":
      return t('notifications.likedComment');
    case "comment_replied":
      return t('notifications.repliedComment');
    case "mentioned":
      return t('notifications.mentionedComment');
    case "story_reacted":
      return `${t('notifications.reactedStory')} ${data?.reaction_emoji || "👍"} ${t('notifications.toYourStory')}`;
    case "story_replied":
      return t('notifications.repliedStory');
    // Legacy types (if still in use)
    case "App\\Notifications\\PostLiked":
      return `${t('notifications.likedPost')} "${data?.post_title || data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "App\\Notifications\\PostCommented":
      return `${t('notifications.commentedPost')} "${data?.post_title || data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "App\\Notifications\\UserFollowed":
      return t('notifications.followedYou');
    case "App\\Notifications\\UserMentioned":
      return t('notifications.mentionedComment');
    case "App\\Notifications\\CommentReplied":
      return t('notifications.repliedComment');
    default:
      return t('notifications.interactedWithYou');
  }
};

export default function NotificationScreen({ navigation, scrollTriggerRef }) {
  const { theme, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const insets = useSafeAreaInsets();
  const lottieRef = useRef(null);
  const { t } = useTranslation();

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

  const { refreshNotificationCount, setNotificationUnreadCount } =
    useUnreadCountsContext();

  const fetchNotifications = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (pageNum === 1 && !append) {
          const cachedStr = storage.getString("cached_notifications");
          if (cachedStr) {
            try {
              const parsed = JSON.parse(cachedStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setNotifications(parsed);
                setLoading(false);
              }
            } catch(e) {}
          }
          setRefreshing(true);
        }

        const response = await getNotifications(pageNum, 20);

        // Check if response has data property (some APIs wrap in data)
        const notificationsData =
          response.data?.notifications || response.notifications || [];
        const fetchedNotifications = Array.isArray(notificationsData)
          ? notificationsData
          : [];

        // Transform API response to match UI format
        const formattedNotifications = fetchedNotifications.map((notif) => {
          // Handle system messages and notifications without actors
          const isSystemMessage =
            notif.type === "system_message" || !notif.actor;

          return {
            id: notif.id,
            type: notif.type,
            data: notif.data,
            is_read: notif.is_read,
            read_at: notif.read_at,
            created_at: notif.created_at,
            created_at_human: notif.created_at_human,
            actor: notif.actor,
            user: {
              name: isSystemMessage
                ? t('notifications.system')
                : notif.actor?.profile_name ||
                notif.actor?.username ||
                t('notifications.user'),
              avatar: isSystemMessage
                ? "https://api.chuyenbienhoa.com/v1.0/users/system/avatar" // Default system avatar
                : notif.actor?.avatar_url ||
                `https://api.chuyenbienhoa.com/v1.0/users/${notif.actor?.username}/avatar`,
            },
            content: formatNotificationMessage(notif, t),
            time: formatTime(notif.created_at),
            read: notif.is_read,
            raw: notif,
          };
        });

        if (append) {
          setNotifications((prev) => {
            const newNotifications = [...prev, ...formattedNotifications];
            const localUnreadCount = newNotifications.filter(
              (n) => !n.is_read
            ).length;
            setNotificationUnreadCount(localUnreadCount);
            return newNotifications;
          });
        } else {
          setNotifications(formattedNotifications);
          if (formattedNotifications.length > 0) {
            storage.set("cached_notifications", JSON.stringify(formattedNotifications));
          }
        }

        // Check if there are more pages
        const paginationData = response.data?.pagination || response.pagination;
        if (paginationData) {
          setHasMore(paginationData.current_page < paginationData.last_page);
        } else {
          setHasMore(fetchedNotifications.length === 20);
        }

        // Refresh unread count after fetching notifications (especially after pull to refresh)
        // Only refresh if it's the first page (not when loading more)
        if (pageNum === 1 && !append) {
          // Calculate unread count from local state and sync to context
          const localUnreadCount = formattedNotifications.filter(
            (n) => !n.is_read
          ).length;
          // Update context with local count immediately for instant UI update
          setNotificationUnreadCount(localUnreadCount);
          // Also fetch from API to ensure accuracy
          refreshNotificationCount();
        }
      } catch (error) {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshNotificationCount, setNotificationUnreadCount]
  );

  useEffect(() => {
    fetchNotifications(1, false);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh unread count when screen is focused
      refreshNotificationCount();
    }, [refreshNotificationCount])
  );

  const lastScrollYRef = useRef(0);
  const scrollPositionRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);
  const flatListRef = useRef(null);

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY);

    // Auto hide bottom tab bar
    const diff = offsetY - lastScrollYRef.current;
    if (offsetY < 50) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
    } else if (diff > 15) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", false);
    } else if (diff < -10) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
    }
    lastScrollYRef.current = offsetY;

    if (!refreshing) {
      lottieRef.current?.play();
    }
  };

  const scrollToTopOrReload = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) return;
    lastTriggerTimeRef.current = now;

    if (isProcessingRef.current) return;

    const isAtTop = scrollPositionRef.current <= 10;

    if (isAtTop) {
      isProcessingRef.current = true;
      setRefreshing(true);
      setPage(1);
      fetchNotifications(1, false);
      refreshNotificationCount();
      setTimeout(() => {
        setRefreshing(false);
        isProcessingRef.current = false;
        scrollPositionRef.current = 0;
      }, 1000);
    } else {
      isProcessingRef.current = true;
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
      setTimeout(() => {
        scrollPositionRef.current = 0;
        isProcessingRef.current = false;
      }, 600);
    }
  }, [fetchNotifications, refreshNotificationCount]);

  React.useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchNotifications(1, false);
    // Also explicitly refresh unread count on pull to refresh
    refreshNotificationCount();
  }, [fetchNotifications, refreshNotificationCount]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !refreshing) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNotifications(nextPage, true);
    }
  }, [loading, hasMore, refreshing, page, fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) => {
        const updated = prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, is_read: true, read: true }
            : notif
        );
        // Update unread count from local state immediately
        const localUnreadCount = updated.filter((n) => !n.is_read).length;
        setNotificationUnreadCount(localUnreadCount);
        return updated;
      });
      // Also refresh from API to ensure accuracy
      refreshNotificationCount();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => {
        const updated = prev.map((notif) => ({
          ...notif,
          is_read: true,
          read: true,
        }));
        // Update unread count to 0 immediately
        setNotificationUnreadCount(0);
        return updated;
      });
      // Also refresh from API to ensure accuracy
      refreshNotificationCount();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const renderItem = ({ item }) => {
    const isSystemMessage = item.type === "system_message" || !item.actor;
    const userName = isSystemMessage
      ? t('notifications.system')
      : item.actor?.profile_name || item.actor?.username || t('notifications.user');
    const displayContent = formatNotificationMessage(item.raw || item, t);
    const displayTime = item.created_at ? formatTime(item.created_at) : item.time;

    return (
      <TouchableOpacity
        style={[
          styles.notification,
          !item.read && { backgroundColor: isDarkMode ? "#1e2e1c" : "#F3FDF1" },
        ]}
        onPress={() => {
          if (!item.read) {
            handleMarkAsRead(item.id);
          }
          // Navigate to relevant screen based on notification type
          // Check if it's a welcome notification
          if (
            item.type === "system_message" &&
            item.data?.message?.includes("Chào mừng")
          ) {
            navigation.navigate("PostScreen", { postId: 173336279 });
          } else if (item.type === "story_reacted") {
            // Navigate to home screen to show stories (story will be highlighted)
            navigation.navigate("HomeScreen", {
              highlightStoryId: item.data?.story_id,
            });
          } else if (item.type === "story_replied") {
            // Navigate to conversation screen
            if (item.data?.conversation_id) {
              navigation.navigate("ConversationScreen", {
                conversationId: item.data.conversation_id,
              });
            } else {
              // Fallback to chat screen if conversation_id is missing
              navigation.navigate("Chat");
            }
          } else if (item.data?.topic_id) {
            navigation.navigate("PostScreen", { postId: item.data.topic_id });
          } else if (item.data?.post_id) {
            navigation.navigate("PostScreen", { postId: item.data.post_id });
          } else if (item.actor?.username) {
            navigation.navigate("ProfileScreen", {
              username: item.actor.username,
            });
          }
        }}
      >
        <Image
          source={
            !isSystemMessage
              ? {
                uri: item.user.avatar,
              }
              : require("../../../assets/logo.png")
          }
          style={[styles.avatar, { alignSelf: "flex-start", borderColor: theme.border }]}
        />
        <View style={styles.content}>
          <Text style={[styles.message, { color: theme.text }]}>
            {isSystemMessage ? (
              displayContent
            ) : (
              <>
                <Text style={[styles.name, { color: theme.text }]}>{userName}</Text> {displayContent}
              </>
            )}
          </Text>
          {item.type === "story_replied" && item.data?.message_excerpt && (
            <Text style={[styles.excerpt, { color: theme.subText }]} numberOfLines={2}>
              {item.data.message_excerpt}
            </Text>
          )}
          <Text style={[styles.time, { color: theme.subText }]}>{displayTime}</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            setSelectedNotification(item);
            setShowActionMenu(true);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={theme.subText} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const ActionMenu = () => (
    <Modal
      visible={showActionMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowActionMenu(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowActionMenu(false)}
      >
        <View style={[styles.actionMenu, { backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity
            style={[
              styles.actionItem,
              { borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: theme.cardBackground, borderBottomColor: theme.border },
            ]}
            onPress={() => {
              if (selectedNotification && !selectedNotification.read) {
                handleMarkAsRead(selectedNotification.id);
              }
              setShowActionMenu(false);
            }}
          >
            <Ionicons name="checkmark-outline" size={22} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.text }]}>
              {t('notifications.markAsRead')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
            <Ionicons
              name="notifications-off-outline"
              size={22}
              color="#FF3B30"
            />
            <Text style={[styles.actionText, { color: theme.text }]}>
              {t('notifications.muteUser')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionItem,
              {
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                borderBottomWidth: 0,
                backgroundColor: theme.cardBackground,
              },
            ]}
            onPress={() => {
              if (selectedNotification) {
                handleDeleteNotification(selectedNotification.id);
              }
              setShowActionMenu(false);
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            <Text style={[styles.actionText, { color: "#FF3B30" }]}>
              {t('notifications.delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      <View style={[styles.header, { marginTop: insets.top, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('navigation.notifications')}</Text>
        <TouchableOpacity
          style={[
            styles.readAllButton,
            { backgroundColor: theme.primary },
            unreadCount === 0 && (isDarkMode ? { backgroundColor: "#2e2e2e", elevation: 0, shadowOpacity: 0 } : styles.readAllButtonDisabled),
          ]}
          onPress={handleMarkAllAsRead}
          disabled={unreadCount === 0}
        >
          <Text
            style={[
              styles.readAllText,
              { color: "#fff" },
              unreadCount === 0 && (isDarkMode ? { color: "#666" } : styles.readAllTextDisabled),
            ]}
          >
            {t('notifications.readAll')} ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {refreshing && (
        <View style={{ position: "absolute", top: insets.top + 50, left: 0, right: 0, alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <LottieView
            source={require("../../../assets/refresh.json")}
            style={{ width: 40, height: 40 }}
            ref={lottieRef}
            loop
            autoPlay
          />
        </View>
      )}

      {loading && notifications.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}
        >
          <CustomLoading />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          onScroll={handleScroll}
          data={notifications}
          extraData={{ t, theme, isDarkMode }}
          keyExtractor={(item) => item.id.toString()}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: 110 + insets.bottom,
            backgroundColor: theme.background,
            flex: notifications.length === 0 ? 1 : undefined,
          }}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              tintColor="transparent"
              colors={["transparent"]}
              progressBackgroundColor="transparent"
              style={{ backgroundColor: "transparent" }}
              progressViewOffset={-1000}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image
                source={require("../../../assets/sad_frog.png")}
                style={styles.emptyImage}
              />
              <Text style={[styles.emptyText, { color: theme.subText }]}>{t('notifications.empty')}</Text>
            </View>
          }
        />
      )}

      <ActionMenu />
    </View>
  );
}

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
    height: 50,
    marginTop: 0.3,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#319527",
  },
  readAllButton: {
    backgroundColor: "#319527",
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 35,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  readAllButtonDisabled: {
    backgroundColor: "#d0d0d0",
    opacity: 0.6,
    shadowOpacity: 0.1,
    elevation: 1,
  },
  readAllText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  readAllTextDisabled: {
    color: "#888",
  },
  notification: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontWeight: "600",
    color: "#000",
  },
  message: {
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  excerpt: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
    fontStyle: "italic",
  },
  moreButton: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionMenu: {
    position: "absolute",
    top: "40%",
    left: "50%",
    width: "75%",
    transform: [{ translateX: -140 }, { translateY: -70 }],
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5E5",
  },
  actionText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "400",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyImage: {
    height: 90,
    width: 90,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
  },
});
