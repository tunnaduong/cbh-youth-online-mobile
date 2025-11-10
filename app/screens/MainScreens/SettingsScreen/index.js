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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import FastImage from "react-native-fast-image";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const SettingItem = ({
  icon,
  title,
  onPress,
  value,
  isSwitch,
  chevron = true,
  lastItem = false,
}) => (
  <TouchableOpacity
    style={[styles.settingItem, lastItem && styles.lastSettingItem]}
    onPress={onPress}
    disabled={isSwitch}
  >
    <View style={styles.settingItemLeft}>
      <View style={styles.settingItemIcon}>
        <Ionicons name={icon} size={22} color="#666" />
      </View>
      <Text style={styles.settingItemText}>{title}</Text>
    </View>
    {isSwitch ? (
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ true: "#319527" }}
      />
    ) : value ? (
      <View style={styles.settingItemRight}>
        <View style={styles.languageContainer}>
          <Image
            source={require("../../../assets/vietnam.png")}
            style={styles.flagIcon}
          />
          <Text style={styles.languageText}>{value}</Text>
        </View>
        {chevron && (
          <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
        )}
      </View>
    ) : (
      chevron && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    )}
  </TouchableOpacity>
);

const SettingSection = ({ title, children }) => {
  // Convert children to array to check for last item
  const childrenArray = React.Children.toArray(children);

  return (
    <View style={styles.settingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
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

export default function SettingsScreen({ navigation }) {
  const { userInfo } = useContext(AuthContext);
  const [darkMode, setDarkMode] = React.useState(false);
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt</Text>
        <View className="w-6 h-6"></View>
      </View>

      <ScrollView>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${userInfo.username}/avatar`,
            }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userInfo.profile_name}</Text>
            {/* <Text style={styles.profileClass}>Lớp 12 Toán</Text> */}
            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() =>
                navigation.navigate("ProfileScreen", {
                  username: userInfo.username,
                })
              }
            >
              <Text style={styles.viewProfileText}>Xem trang cá nhân</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings List */}
        <SettingSection title="Tài khoản">
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
            onPress={() => {
              Toast.show({
                type: "info",
                text1: "Tính năng đang được phát triển",
              });
            }}
          />
          <SettingItem
            icon="notifications-outline"
            title="Thông báo"
            onPress={() => {
              Toast.show({
                type: "info",
                text1: "Tính năng đang được phát triển",
              });
            }}
          />
        </SettingSection>

        <SettingSection title="Ứng dụng">
          <SettingItem
            icon="moon-outline"
            title="Chế độ tối"
            isSwitch
            value={darkMode}
            onPress={(value) => {
              setDarkMode(value);
              Toast.show({
                type: "info",
                text1: "Tính năng đang được phát triển",
              });
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
              Toast.show({
                type: "info",
                text1: "Tính năng đang được phát triển",
              });
            }}
          />
          <SettingItem
            icon="information-circle-outline"
            title="Về ứng dụng"
            onPress={() => navigation.navigate("AboutScreen")}
          />
        </SettingSection>
      </ScrollView>
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
  profileSection: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
    backgroundColor: "#fff",
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
    color: "#000",
    marginBottom: 4,
  },
  profileClass: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  viewProfileButton: {
    alignSelf: "flex-start",
  },
  viewProfileText: {
    color: "#319527",
    fontSize: 14,
    fontWeight: "500",
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
    marginLeft: 12,
    color: "#000",
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
    color: "#666",
  },
});
