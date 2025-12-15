import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
} from "react-native";
import React, { useContext, useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Toast from "react-native-toast-message";
import {
  deleteAccount,
  updateProfile,
  changePassword,
  getBlockedUsers,
  unblockUser,
} from "../../../services/api/Api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SettingItem = ({
  icon,
  title,
  onPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
  color = "#000",
}) => (
  <TouchableOpacity
    style={[styles.settingItem, lastItem && styles.lastSettingItem]}
    onPress={onPress}
    disabled={isSwitch}
  >
    <View style={styles.settingItemLeft}>
      <View style={styles.settingItemIcon}>
        <Ionicons name={icon} size={22} color={color === "#FF3B30" ? color : "#666"} />
      </View>
      <Text style={[styles.settingItemText, { color }]}>{title}</Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ true: "#319527" }}
      />
    ) : value ? (
      <View style={styles.settingItemRight}>
        <Text style={styles.valueText}>{value}</Text>
        {chevron && (
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        )}
      </View>
    ) : (
      chevron && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    )}
  </TouchableOpacity>
);

const SettingSection = ({ title, children, titleColor }) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={styles.settingSection}>
      <Text style={[styles.sectionTitle, titleColor && { color: titleColor }]}>
        {title}
      </Text>
      <View style={styles.sectionContent}>
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            lastItem: index === childrenArray.length - 1,
          })
        )}
      </View>
    </View>
  );
};

export default function BlockedUsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { unblockUserInContext } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      const response = await getBlockedUsers();
      setBlockedUsers(response.data || []);
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể tải danh sách chặn",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnblock = (userId, username) => {
    console.log("handleUnblock called with:", userId, username);
    Alert.alert(
      "Bỏ chặn người dùng",
      "Bạn có chắc chắn muốn bỏ chặn người dùng này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Bỏ chặn", style: "default", onPress: async () => {
            try {
              await unblockUser(userId);
              // Update context global state
              if (username) {
                console.log("Calling unblockUserInContext with:", username);
                await unblockUserInContext(username);
              } else {
                console.log("No username provided to unblockUserInContext");
              }
              // Update local screen state
              setBlockedUsers(prev => prev.filter(u => u.id !== userId));
              Toast.show({
                type: "success",
                text1: "Đã bỏ chặn người dùng"
              });
            } catch (e) {
              console.error("Unblock error:", e);
              Toast.show({
                type: "error",
                text1: "Lỗi",
                text2: e.message || "Không thể bỏ chặn"
              });
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Người dùng đã chặn</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#319527" />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="people-outline" size={50} color="#ccc" />
          <Text style={{ marginTop: 10, color: "#666" }}>Bạn chưa chặn ai cả</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {blockedUsers.map((user) => (
            <View key={user.id} style={styles.userItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={{ uri: user.profile?.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${user.username}/avatar` }}
                  style={styles.avatar}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.userName}>{user.profile?.profile_name || user.username}</Text>
                  <Text style={styles.userUsername}>@{user.username}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.unblockButton}
                onPress={() => handleUnblock(user.id, user.username)}
              >
                <Text style={styles.unblockText}>Bỏ chặn</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      <Toast topOffset={60} />
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
  },
  content: {
    flex: 1,
  },
  settingSection: {
    marginBottom: 24,
    backgroundColor: "#FAFAFA",
    margin: 15,
    borderRadius: 15,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#319527",
    marginLeft: 16,
    marginBottom: 8,
  },
  sectionContent: {
    // backgroundColor: "#fff",
  },
  settingItemIcon: {
    backgroundColor: "#F1F1F1",
    padding: 7,
    borderRadius: 30,
    marginRight: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5E5",
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingItemText: {
    fontSize: 16,
    color: "#000",
  },
  settingItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  valueText: {
    fontSize: 14,
    color: "#666",
    marginRight: 8,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalView: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FF3B30",
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    height: 44,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
    gap: 10,
  },
  button: {
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    flex: 1,
    alignItems: "center",
  },
  buttonClose: {
    backgroundColor: "#ddd",
  },
  buttonDelete: {
    backgroundColor: "#FF3B30",
  },
  buttonDisabled: {
    backgroundColor: "#ffb3af",
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#eee',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#319527',
  },
  unblockText: {
    color: '#319527',
    fontSize: 14,
    fontWeight: '500',
  },
});
