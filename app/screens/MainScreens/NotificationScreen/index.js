import React, { useRef, useState } from "react";
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

// Dummy data for notifications
const DUMMY_NOTIFICATIONS = [
  {
    id: "1",
    user: {
      name: "Dương Tùng Anh",
      avatar: "https://randomuser.me/api/portraits/men/1.jpg",
    },
    content: 'thích bài đăng "Cách thi lớp 10 bao đậu" của bạn',
    time: "3 phút trước",
    read: false,
  },
  {
    id: "2",
    user: {
      name: "Dương Tùng Em",
      avatar: "https://randomuser.me/api/portraits/men/2.jpg",
    },
    content: "đã theo dõi bạn",
    time: "3 phút trước",
    read: false,
  },
  {
    id: "3",
    user: {
      name: "Dương Tùng Anh",
      avatar: "https://randomuser.me/api/portraits/men/1.jpg",
    },
    content: "nhắc đến bạn trong một bình luận",
    time: "3 phút trước",
    read: false,
  },
];

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState(DUMMY_NOTIFICATIONS);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  const lottieRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

  const handleScroll = (event) => {
    if (!refreshing) {
      lottieRef.current?.play(); // Play up to the calculated frame
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate fetching new notifications
    setTimeout(() => {
      // Here you would typically fetch new notifications from your API
      // For now, we'll just reset the notifications to their initial state
      setNotifications(
        DUMMY_NOTIFICATIONS.map((notification) => ({
          ...notification,
          read: false,
        }))
      );
      setRefreshing(false);
    }, 1500);
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notification,
        !item.read && { backgroundColor: "#F3FDF1" },
      ]}
      onPress={() => {
        const updatedNotifications = notifications.map((notification) =>
          notification.id === item.id
            ? { ...notification, read: true }
            : notification
        );
        setNotifications(updatedNotifications);
      }}
    >
      <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
      <View style={styles.content}>
        <Text style={styles.message}>
          <Text style={styles.name}>{item.user.name}</Text> {item.content}
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
              if (selectedNotification) {
                const updatedNotifications = notifications.map((notification) =>
                  notification.id === selectedNotification.id
                    ? { ...notification, read: true }
                    : notification
                );
                setNotifications(updatedNotifications);
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
          >
            <Ionicons name="close-outline" size={22} color="#FF3B30" />
            <Text style={[styles.actionText, { color: "#000" }]}>
              Tắt thông báo bài viết này
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity
          style={styles.readAllButton}
          onPress={() => {
            const updatedNotifications = notifications.map((notification) => ({
              ...notification,
              read: true,
            }));
            setNotifications(updatedNotifications);
          }}
        >
          <Text style={styles.readAllText}>Đọc tất cả ({unreadCount})</Text>
        </TouchableOpacity>
      </View>

      <AnimatedLottieView
        source={require("../../../assets/refresh.json")}
        style={{
          width: 40,
          height: 40,
          position: "absolute",
          zIndex: -1,
          alignSelf: "center",
          top: 50 + insets.top + 10,
        }}
        ref={lottieRef}
      />

      <FlatList
        onScroll={handleScroll}
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80, backgroundColor: "#fff" }}
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

      <ActionMenu />
    </SafeAreaView>
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
