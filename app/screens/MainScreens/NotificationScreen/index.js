import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  StatusBar,
  RefreshControl,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomLoading from "../../../components/CustomLoading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../../../services/api/Api";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);
dayjs.locale("vi");

// Helper function to format notification message based on type and data
const formatNotificationMessage = (notification) => {
  const { type, data, actor } = notification;

  // System messages don't have an actor
  if (type === "system_message") {
    return data?.message || "Thông báo mới";
  }

  if (!actor) {
    // Handle other notifications without actor
    switch (type) {
      case "topic_pinned":
        return `đã ghim bài đăng "${data?.topic_title || ""}" của bạn`;
      case "topic_moved":
        return `đã chuyển bài đăng "${data?.topic_title || ""}" của bạn`;
      case "topic_closed":
        return `đã đóng bài đăng "${data?.topic_title || ""}" của bạn`;
      default:
        return "Thông báo mới";
    }
  }

  const actorName = actor.profile_name || actor.username;

  switch (type) {
    case "topic_liked":
      return `thích bài đăng "${data?.topic_title || ""}" của bạn`;
    case "topic_commented":
      return `đã bình luận trong bài đăng "${data?.topic_title || ""}" của bạn`;
    case "comment_liked":
      return `đã thích bình luận của bạn`;
    case "comment_replied":
      return `đã trả lời bình luận của bạn`;
    case "mentioned":
      return `nhắc đến bạn trong một bình luận`;
    // Legacy types (if still in use)
    case "App\\Notifications\\PostLiked":
      return `thích bài đăng "${
        data?.post_title || data?.topic_title || ""
      }" của bạn`;
    case "App\\Notifications\\PostCommented":
      return `đã bình luận trong bài đăng "${
        data?.post_title || data?.topic_title || ""
      }" của bạn`;
    case "App\\Notifications\\UserFollowed":
      return "đã theo dõi bạn";
    case "App\\Notifications\\UserMentioned":
      return `nhắc đến bạn trong một bình luận`;
    case "App\\Notifications\\CommentReplied":
      return `đã trả lời bình luận của bạn`;
    default:
      return "đã tương tác với bạn";
  }
};

// Helper function to format time
const formatTime = (dateString) => {
  if (!dateString) return "Vừa xong";

  const date = dayjs(dateString);
  const now = dayjs();
  const diffInSeconds = now.diff(date, "second");

  if (diffInSeconds < 60) {
    return "Vừa xong";
  }

  const diffInMinutes = now.diff(date, "minute");
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  const diffInHours = now.diff(date, "hour");
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = now.diff(date, "day");
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  const diffInWeeks = now.diff(date, "week");
  if (diffInWeeks < 4) {
    return `${diffInWeeks} tuần trước`;
  }

  const diffInMonths = now.diff(date, "month");
  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }

  const diffInYears = now.diff(date, "year");
  return `${diffInYears} năm trước`;
};

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const insets = useSafeAreaInsets();
  const lottieRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

  const fetchNotifications = useCallback(
    async (pageNum = 1, append = false) => {
      try {
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
                ? "Hệ thống"
                : notif.actor?.profile_name ||
                  notif.actor?.username ||
                  "Người dùng",
              avatar: isSystemMessage
                ? "https://api.chuyenbienhoa.com/v1.0/users/system/avatar" // Default system avatar
                : notif.actor?.avatar_url ||
                  `https://api.chuyenbienhoa.com/v1.0/users/${notif.actor?.username}/avatar`,
            },
            content: formatNotificationMessage(notif),
            time: formatTime(notif.created_at),
            read: notif.is_read,
          };
        });

        if (append) {
          setNotifications((prev) => {
            const newNotifications = [...prev, ...formattedNotifications];
            return newNotifications;
          });
        } else {
          setNotifications(formattedNotifications);
        }

        // Check if there are more pages
        const paginationData = response.data?.pagination || response.pagination;
        if (paginationData) {
          setHasMore(paginationData.current_page < paginationData.last_page);
        } else {
          setHasMore(fetchedNotifications.length === 20);
        }
      } catch (error) {
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchNotifications(1, false);
  }, []);

  const handleScroll = (event) => {
    if (!refreshing) {
      lottieRef.current?.play();
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchNotifications(1, false);
  }, [fetchNotifications]);

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
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, is_read: true, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: true, read: true }))
      );
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

    return (
      <TouchableOpacity
        style={[
          styles.notification,
          !item.read && { backgroundColor: "#F3FDF1" },
        ]}
        onPress={() => {
          if (!item.read) {
            handleMarkAsRead(item.id);
          }
          // Navigate to relevant screen based on notification type
          if (item.data?.topic_id) {
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
        <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
        <View style={styles.content}>
          <Text style={styles.message}>
            {isSystemMessage ? (
              item.content
            ) : (
              <>
                <Text style={styles.name}>{item.user.name}</Text> {item.content}
              </>
            )}
          </Text>
          <Text style={styles.time}>{item.time}</Text>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            setSelectedNotification(item);
            setShowActionMenu(true);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#666" />
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
        <View style={styles.actionMenu}>
          <TouchableOpacity
            style={[
              styles.actionItem,
              { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
            ]}
            onPress={() => {
              if (selectedNotification && !selectedNotification.read) {
                handleMarkAsRead(selectedNotification.id);
              }
              setShowActionMenu(false);
            }}
          >
            <Ionicons name="checkmark-outline" size={22} color="#319527" />
            <Text style={[styles.actionText, { color: "#000" }]}>
              Đánh dấu là đã đọc
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <Ionicons
              name="notifications-off-outline"
              size={22}
              color="#FF3B30"
            />
            <Text style={[styles.actionText, { color: "#000" }]}>
              Tắt thông báo từ người này
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionItem,
              {
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                borderBottomWidth: 0,
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
              Xóa thông báo
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity
          style={styles.readAllButton}
          onPress={handleMarkAllAsRead}
          disabled={unreadCount === 0}
        >
          <Text style={styles.readAllText}>Đọc tất cả ({unreadCount})</Text>
        </TouchableOpacity>
      </View>

      {loading && notifications.length === 0 ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <CustomLoading />
        </View>
      ) : (
        <FlatList
          onScroll={handleScroll}
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingBottom: 80,
            backgroundColor: "#fff",
            flex: notifications.length === 0 ? 1 : undefined,
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={["transparent"]}
              style={{ backgroundColor: "transparent" }}
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
              <Text style={styles.emptyText}>Chưa có thông báo nào...</Text>
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
  readAllText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
