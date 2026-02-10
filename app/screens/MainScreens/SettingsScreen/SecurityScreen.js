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
  StatusBar,
} from "react-native";
import React, { useContext, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Toast from "react-native-toast-message";
import { deleteAccount, updateProfile, changePassword } from "../../../services/api/Api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../contexts/ThemeContext";

const SettingItem = ({
  icon,
  title,
  onPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
  color,
  theme,
  isDarkMode,
}) => (
  <TouchableOpacity
    style={[styles.settingItem, lastItem && styles.lastSettingItem, { borderBottomColor: theme.border }]}
    onPress={onPress}
    disabled={isSwitch}
  >
    <View style={styles.settingItemLeft}>
      <View style={[styles.settingItemIcon, { backgroundColor: isDarkMode ? "#374151" : "#F1F1F1" }]}>
        <Ionicons name={icon} size={22} color={color === "#FF3B30" ? color : theme.subText} />
      </View>
      <Text style={[styles.settingItemText, { color: color || theme.text }]}>{title}</Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ true: theme.primary }}
      />
    ) : value ? (
      <View style={styles.settingItemRight}>
        <Text style={[styles.valueText, { color: theme.subText }]}>{value}</Text>
        {chevron && (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </View>
    ) : (
      chevron && <Ionicons name="chevron-forward" size={20} color={theme.subText} />
    )}
  </TouchableOpacity>
);

const SettingSection = ({ title, children, titleColor, theme, isDarkMode }) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={[styles.settingSection, { backgroundColor: isDarkMode ? "#1f2937" : "#FAFAFA" }]}>
      <Text style={[styles.sectionTitle, { color: titleColor || theme.primary }]}>
        {title}
      </Text>
      <View style={styles.sectionContent}>
        {childrenArray.map((child, index) =>
          React.cloneElement(child, {
            lastItem: index === childrenArray.length - 1,
            theme,
            isDarkMode,
          })
        )}
      </View>
    </View>
  );
};

export default function SecurityScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { signOut, userInfo, setUserInfo, refreshUserInfo } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();

  // Modal states
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // Form states
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [newUsername, setNewUsername] = useState(userInfo?.username || "");
  const [newEmail, setNewEmail] = useState(userInfo?.email || "");

  // Change Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Helper for error message
  const getErrorMessage = (error) => {
    if (error.response?.data?.message) return error.response.data.message;
    if (error.response?.data?.error) return error.response.data.error;
    return error.message || "Đã có lỗi xảy ra";
  };

  // Handlers
  const handleDeleteAccount = () => {
    setDeleteModalVisible(true);
  };

  const onConfirmDelete = async () => {
    if (confirmText !== "XOÁ TÀI KHOẢN") {
      Alert.alert("Lỗi", "Vui lòng nhập đúng nội dung xác nhận 'XOÁ TÀI KHOẢN'");
      return;
    }
    if (!password) {
      Alert.alert("Lỗi", "Vui lòng nhập mật khẩu");
      return;
    }

    try {
      setLoading(true);
      await deleteAccount(password);
      setLoading(false);
      setDeleteModalVisible(false);

      // Show toast after modal closes
      setTimeout(() => {
        Toast.show({
          type: "success",
          text1: "Đã xóa tài khoản thành công",
        });
      }, 500);

      // Delay logout to let user see the toast
      setTimeout(() => signOut(), 2500);
    } catch (error) {
      setLoading(false);
      const msg = getErrorMessage(error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: msg,
      });
    }
  };

  const onUpdateUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên đăng nhập mới");
      return;
    }

    try {
      setLoading(true);
      const response = await updateProfile(userInfo.username, { username: newUsername });

      if (response.data && response.data.token) {
        await AsyncStorage.setItem("auth_token", response.data.token);
        await refreshUserInfo();
      } else {
        // Fallback if no token (shouldn't happen for username/email change)
        setUserInfo({ ...userInfo, username: newUsername });
      }

      setLoading(false);
      setUsernameModalVisible(false);

      // Delay toast to show after modal closes
      setTimeout(() => {
        Toast.show({
          type: "success",
          text1: "Cập nhật thành công",
        });
      }, 500);
    } catch (error) {
      setLoading(false);
      const msg = getErrorMessage(error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: msg,
      });
    }
  };

  const onUpdateEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập email mới");
      return;
    }

    try {
      setLoading(true);
      const response = await updateProfile(userInfo.username, { email: newEmail });

      if (response.data && response.data.token) {
        await AsyncStorage.setItem("auth_token", response.data.token);
        await refreshUserInfo();
      } else {
        setUserInfo({ ...userInfo, email: newEmail });
      }

      setLoading(false);
      setEmailModalVisible(false);
      Alert.alert(
        "Đã gửi email xác nhận",
        "Vui lòng kiểm tra hộp thư và xác nhận địa chỉ email của bạn"
      );
    } catch (error) {
      setLoading(false);
      const msg = getErrorMessage(error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: msg,
      });
    }
  };

  const onChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Lỗi", "Mật khẩu mới không khớp");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    try {
      setLoading(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmNewPassword
      });

      setLoading(false);
      setPasswordModalVisible(false);

      // Clear fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      // Delay toast to show after modal closes
      setTimeout(() => {
        Toast.show({
          type: "success",
          text1: "Đổi mật khẩu thành công",
        });
      }, 500);
    } catch (error) {
      setLoading(false);
      const msg = getErrorMessage(error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: msg,
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Bảo mật</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <SettingSection title="Thông tin cá nhân" theme={theme} isDarkMode={isDarkMode}>
          <SettingItem
            icon="person-outline"
            title="Tên đăng nhập"
            value={userInfo?.username}
            onPress={() => {
              setNewUsername(userInfo?.username || "");
              setUsernameModalVisible(true);
            }}
            theme={theme}
            isDarkMode={isDarkMode}
          />
          <SettingItem
            icon="mail-outline"
            title="Email"
            value={userInfo?.email ? userInfo.email.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "Chưa cập nhật"}
            onPress={() => {
              setNewEmail(userInfo?.email || "");
              setEmailModalVisible(true);
            }}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </SettingSection>

        <SettingSection title="Đăng nhập & Bảo mật" theme={theme} isDarkMode={isDarkMode}>
          <SettingItem
            icon="key-outline"
            title="Đổi mật khẩu"
            onPress={() => setPasswordModalVisible(true)}
            theme={theme}
            isDarkMode={isDarkMode}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Xác thực 2 yếu tố"
            onPress={() => {
              Toast.show({
                type: "info",
                text1: "Tính năng đang được phát triển",
              });
            }}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </SettingSection>

        <SettingSection title="Vùng nguy hiểm" titleColor="#FF3B30" theme={theme} isDarkMode={isDarkMode}>
          <SettingItem
            icon="trash-outline"
            title="Xóa tài khoản"
            color="#FF3B30"
            chevron={false}
            onPress={handleDeleteAccount}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </SettingSection>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.centeredView}
        >
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={styles.modalTitle}>Xóa tài khoản vĩnh viễn</Text>
            <Text style={[styles.modalText, { color: theme.subText }]}>
              Hành động này không thể hoàn tác. Tất cả dữ liệu của bạn sẽ bị xóa
              vĩnh viễn. Nhập mật khẩu và dòng chữ "XOÁ TÀI KHOẢN" để xác nhận.
            </Text>

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Nhập mật khẩu của bạn"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Nhập 'XOÁ TÀI KHOẢN'"
              placeholderTextColor={theme.subText}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="sentences"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonClose, { backgroundColor: isDarkMode ? "#374151" : "#ddd" }]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setPassword("");
                  setConfirmText("");
                }}
                disabled={loading}
              >
                <Text style={[styles.textStyle, { color: theme.text }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonDelete,
                  (confirmText !== "XOÁ TÀI KHOẢN" || !password) && styles.buttonDisabled,
                ]}
                onPress={onConfirmDelete}
                disabled={loading || confirmText !== "XOÁ TÀI KHOẢN" || !password}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.textStyle}>Xóa vĩnh viễn</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        <Toast topOffset={60} />
      </Modal>

      {/* Change Username Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={usernameModalVisible}
        onRequestClose={() => setUsernameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.centeredView}
        >
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Đổi tên đăng nhập</Text>
            <Text style={[styles.modalText, { color: theme.subText }]}>
              Đây là tên hiển thị công khai của bạn. Nó có thể là tên thật hoặc biệt danh của bạn. Bạn chỉ có thể thay đổi tên đăng nhập mỗi 30 ngày một lần.
            </Text>

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Tên đăng nhập mới"
              placeholderTextColor={theme.subText}
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonClose, { backgroundColor: isDarkMode ? "#374151" : "#ddd" }]}
                onPress={() => setUsernameModalVisible(false)}
                disabled={loading}
              >
                <Text style={[styles.textStyle, { color: theme.text }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={onUpdateUsername}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.textStyle}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        <Toast topOffset={60} />
      </Modal>

      {/* Change Email Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={emailModalVisible}
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.centeredView}
        >
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Đổi Email</Text>
            <Text style={[styles.modalText, { color: theme.subText }]}>
              Nhập địa chỉ email mới của bạn.
            </Text>

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Email mới"
              placeholderTextColor={theme.subText}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonClose, { backgroundColor: isDarkMode ? "#374151" : "#ddd" }]}
                onPress={() => setEmailModalVisible(false)}
                disabled={loading}
              >
                <Text style={[styles.textStyle, { color: theme.text }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={onUpdateEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.textStyle}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        <Toast topOffset={60} />

      </Modal>

      {/* Change Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.centeredView}
        >
          <View style={[styles.modalView, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Đổi mật khẩu</Text>

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Mật khẩu hiện tại"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Mật khẩu mới"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: isDarkMode ? "#374151" : "#fff" }]}
              placeholder="Xác nhận mật khẩu mới"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonClose, { backgroundColor: isDarkMode ? "#374151" : "#ddd" }]}
                onPress={() => {
                  setPasswordModalVisible(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                disabled={loading}
              >
                <Text style={[styles.textStyle, { color: theme.text }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.primary }]}
                onPress={onChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.textStyle}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        <Toast topOffset={60} />
      </Modal>

      <Toast topOffset={60} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  settingSection: {
    marginBottom: 24,
    margin: 15,
    borderRadius: 15,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 16,
    marginBottom: 8,
  },
  sectionContent: {
    // backgroundColor: "#fff",
  },
  settingItemIcon: {
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
  },
  settingItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  valueText: {
    fontSize: 14,
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
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    width: "100%",
    height: 44,
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
  },
  buttonDelete: {
    backgroundColor: "#FF3B30",
  },
  buttonDisabled: {
    backgroundColor: "#ffb3af",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 16,
  },
});
