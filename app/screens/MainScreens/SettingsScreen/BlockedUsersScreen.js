import {
  View,
  Text,
  StyleSheet,
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
  Animated,
} from "react-native";
import React, { useContext, useState, useEffect, useRef } from "react";
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
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";

const SettingItem = ({
  icon,
  title,
  onPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
  color = "#000",
  theme,
}) => (
  <TouchableOpacity
    style={[styles.settingItem, lastItem && styles.lastSettingItem, { borderBottomColor: theme.border }]}
    onPress={onPress}
    disabled={isSwitch}
  >
    <View style={styles.settingItemLeft}>
      <View style={styles.settingItemIcon}>
        <Ionicons name={icon} size={22} color={color === "#FF3B30" ? color : theme.subText} />
      </View>
      <Text style={[styles.settingItemText, { color: color === "#FF3B30" ? color : theme.text }]}>{title}</Text>
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
          })
        )}
      </View>
    </View>
  );
};

export default function BlockedUsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { unblockUserInContext } = useContext(AuthContext);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState([]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 10, 60],
    outputRange: [0, 0, 0],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
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
        text1: t("common.error"),
        text2: t("blockedUsers.loadError"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnblock = (userId, username) => {
    console.log("handleUnblock called with:", userId, username);
    Alert.alert(
      t("blockedUsers.unblockTitle"),
      t("blockedUsers.unblockConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("blockedUsers.unblockAction"), style: "default", onPress: async () => {
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
                text1: t("blockedUsers.unblockSuccess")
              });
            } catch (e) {
              console.error("Unblock error:", e);
              Toast.show({
                type: "error",
                text1: t("common.error"),
                text2: e.message || t("blockedUsers.unblockError")
              });
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Floating header */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.background,
            opacity: headerBgOpacity,
          }}
        />
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 64 + insets.top }}>
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} providerId="BlockedUsersScreen" onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, {
              color: theme.primary,
              flex: 1,
              textAlign: 'center',
              opacity: headerTitleOpacity,
            }]}
            numberOfLines={1}
          >
            {t('blockedUsers.title')}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Ionicons name="people-outline" size={50} color={theme.subText} />
          <Text style={{ marginTop: 10, color: theme.subText }}>{t('blockedUsers.empty')}</Text>
        </View>
      ) : (
        <AndroidGlassBackdrop providerId="BlockedUsersScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 16 }}
        >
          {blockedUsers.map((user) => (
            <View key={user.id} style={[styles.userItem, { borderBottomColor: theme.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={{ uri: user.profile?.avatar_url || `https://api.chuyenbienhoa.com/v1.0/users/${user.username}/avatar` }}
                  style={[styles.avatar, { backgroundColor: isDarkMode ? "#374151" : "#eee" }]}
                />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.userName, { color: theme.text }]}>{user.profile?.profile_name || user.username}</Text>
                  <Text style={[styles.userUsername, { color: theme.subText }]}>@{user.username}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.unblockButton, { borderColor: theme.primary }]}
                onPress={() => handleUnblock(user.id, user.username)}
              >
                <Text style={[styles.unblockText, { color: theme.primary }]}>{t('blockedUsers.unblockAction')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Animated.ScrollView>
        </AndroidGlassBackdrop>
      )}
      <Toast topOffset={60} />
    </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
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
    color: "#FF3B30",
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
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userUsername: {
    fontSize: 14,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
