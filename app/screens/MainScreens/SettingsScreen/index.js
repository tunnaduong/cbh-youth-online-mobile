import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Image,
  Alert,
  Linking,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import FastImage from "react-native-fast-image";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as Application from 'expo-application';

const SettingItem = ({
  icon,
  title,
  onPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
  theme,
}) => (
  <TouchableOpacity
    style={[
      styles.settingItem,
      lastItem && styles.lastSettingItem,
      { borderBottomColor: theme.border }
    ]}
    onPress={onPress}
    disabled={isSwitch}
  >
    <View style={styles.settingItemLeft}>
      <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
        <Ionicons name={icon} size={22} color={theme.subText} />
      </View>
      <Text style={[styles.settingItemText, { color: theme.text }]}>{title}</Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ true: theme.primary }}
      />
    ) : value ? (
      <View style={styles.settingItemRight}>
        <View style={styles.languageContainer}>
          <Image
            source={require("../../../assets/vietnam.png")}
            style={styles.flagIcon}
          />
          <Text style={[styles.languageText, { color: theme.subText }]}>{value}</Text>
        </View>
        {chevron && (
          <Ionicons name="chevron-forward" size={20} color={theme.subText} />
        )}
      </View>
    ) : (
      chevron && <Ionicons name="chevron-forward" size={20} color={theme.subText} />
    )}
  </TouchableOpacity>
);

const SettingSection = ({ title, children, theme }) => {
  // Convert children to array to check for last item
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={[styles.settingSection, { backgroundColor: theme.sectionBackground }]}>
      <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text>
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

export default function SettingsScreen({ navigation }) {
  const { userInfo } = useContext(AuthContext);
  const { isDarkMode, theme, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>Cài đặt</Text>
        <View className="w-6 h-6"></View>
      </View>

      <ScrollView>
        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: theme.background }]}>
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${userInfo.username}/avatar`,
            }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>{userInfo.profile_name}</Text>
            {/* <Text style={styles.profileClass}>Lớp 12 Toán</Text> */}
            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() =>
                navigation.navigate("ProfileScreen", {
                  username: userInfo.username,
                })
              }
            >
              <Text style={[styles.viewProfileText, { color: theme.primary }]}>Xem trang cá nhân</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings List */}
        <SettingSection title="Tài khoản" theme={theme}>
          <SettingItem
            icon="person-outline"
            title="Thông tin tài khoản"
            onPress={() =>
              navigation.navigate("ProfileDetailScreen", {
                username: userInfo.username,
              })
            }
          />
          <SettingItem
            icon="lock-closed-outline"
            title="Bảo mật"
            onPress={() => navigation.navigate("SecurityScreen")}
          />
          <SettingItem
            icon="notifications-outline"
            title="Thông báo"
            onPress={() => navigation.navigate("NotificationSettingsScreen")}
          />
        </SettingSection>

        <SettingSection title="Ứng dụng" theme={theme}>
          <SettingItem
            icon="moon-outline"
            title="Chế độ tối"
            isSwitch
            value={isDarkMode}
            onPress={(value) => {
              toggleTheme(value);
            }}
          />
          <SettingItem
            icon="language-outline"
            title="Ngôn ngữ"
            value="Tiếng Việt"
            onPress={() => {
              Toast.show({
                type: "info",
                text1: "Tính năng đang được phát triển",
              });
            }}
          />
          <SettingItem
            icon="ban-outline"
            title="Chặn"
            onPress={() => {
              navigation.navigate("BlockedUsersScreen");
            }}
          />
          <SettingItem
            icon="information-circle-outline"
            title="Về ứng dụng"
            onPress={() => navigation.navigate("AboutScreen")}
          />
        </SettingSection>

        <Text style={[styles.versionText, { color: theme.subText }]}>
          CBH Online phiên bản v{Application.nativeApplicationVersion} ({Application.nativeBuildVersion})
        </Text>

        <View style={styles.socialContainer}>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL("https://github.com/tunnaduong/cbh-youth-online-mobile")
            }
            style={styles.socialButton}
          >
            <Ionicons name="logo-github" size={24} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://facebook.com/CBHYouthOnline")}
            style={styles.socialButton}
          >
            <Ionicons name="logo-facebook" size={24} color="#1877F2" />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  profileSection: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  profileClass: {
    fontSize: 14,
    marginBottom: 8,
  },
  viewProfileButton: {
    alignSelf: "flex-start",
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: "500",
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
    marginLeft: 12,
  },
  settingItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  languageContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  flagIcon: {
    width: 20,
    height: 14,
    marginRight: 6,
  },
  languageText: {
    fontSize: 14,
  },
  versionText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    gap: 20,
  },
  socialButton: {
    padding: 8,
  },
});
