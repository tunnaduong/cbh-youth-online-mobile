import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Image,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import FastImage from "../../../components/FastImage";
import { ScrollView } from "react-native";
import { StatusBar } from "expo-status-bar";
import Dropdown from "../../../components/Dropdown";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as Application from 'expo-application';
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../../../i18n";

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
  if (!userInfo) {
    return null;
  }
  const { isDarkMode, theme, setThemeMode, useSystemTheme, hideTabLabels, setHideTabLabels } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const languageCode = i18n.language?.split('-')[0] || 'vi';
  const currentLanguage = languageCode === 'ru' ? 'ru' : languageCode === 'en' ? 'en' : 'vi';
  const currentThemeLabel = useSystemTheme ? t('settings.auto') : (isDarkMode ? t('settings.dark') : t('settings.light'));

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('settings.title')}</Text>
        <View className="w-6 h-6"></View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
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
              <Text style={[styles.viewProfileText, { color: theme.primary }]}>{t('settings.editProfile')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings List */}
        <SettingSection title={t('settings.account')} theme={theme}>
          <SettingItem
            icon="person-outline"
            title={t('settings.editProfile')}
            onPress={() =>
              navigation.navigate("ProfileDetailScreen", {
                username: userInfo.username,
              })
            }
          />
          <SettingItem
            icon="lock-closed-outline"
            title={t('settings.security')}
            onPress={() => navigation.navigate("SecurityScreen")}
          />
          <SettingItem
            icon="notifications-outline"
            title={t('settings.notifications')}
            onPress={() => navigation.navigate("NotificationSettingsScreen")}
          />
        </SettingSection>

        <SettingSection title={t('settings.application')} theme={theme}>
          <View style={{ borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
            <Dropdown
              options={[
                { label: t('settings.auto'), value: "system" },
                { label: t('settings.light'), value: "light" },
                { label: t('settings.dark'), value: "dark" },
              ]}
              selectedValue={{
                label: currentThemeLabel,
                value: useSystemTheme ? "system" : (isDarkMode ? "dark" : "light")
              }}
              onValueChange={(item) => setThemeMode(item.value)}
              style={{ borderWidth: 0, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 0, backgroundColor: 'transparent' }}
              containerStyle={{ marginVertical: 0 }}
              textStyle={{ color: theme.subText, fontSize: 16, textAlign: 'right' }}
              leftIcon={
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
                    <Ionicons name="moon-outline" size={22} color={theme.subText} />
                  </View>
                  <Text style={[styles.settingItemText, { color: theme.text }]}>{t('settings.theme')}</Text>
                </View>
              }
            />
          </View>

          <View style={{ borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
            <Dropdown
              options={[
                { label: `🇻🇳 ${t('settings.vietnamese')}`, value: "vi" },
                { label: `🇬🇧 ${t('settings.english')}`, value: "en" },
                { label: `🇷🇺 ${t('settings.russian')}`, value: "ru" },
              ]}
              selectedValue={{
                label: currentLanguage === "ru" ? `🇷🇺 ${t('settings.russian')}` : currentLanguage === "en" ? `🇬🇧 ${t('settings.english')}` : `🇻🇳 ${t('settings.vietnamese')}`,
                value: currentLanguage
              }}
              onValueChange={(item) => changeLanguage(item.value)}
              style={{ borderWidth: 0, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 0, backgroundColor: 'transparent' }}
              containerStyle={{ marginVertical: 0 }}
              textStyle={{ color: theme.subText, fontSize: 16, textAlign: 'right' }}
              leftIcon={
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingItemIcon, { backgroundColor: theme.iconBackground }]}>
                    <Ionicons name="language-outline" size={22} color={theme.subText} />
                  </View>
                  <Text style={[styles.settingItemText, { color: theme.text }]}>{t('settings.language')}</Text>
                </View>
              }
            />
          </View>
          <SettingItem
            icon="ban-outline"
            title={t('settings.blockedUsers')}
            onPress={() => {
              navigation.navigate("BlockedUsersScreen");
            }}
          />
          <SettingItem
            icon="information-circle-outline"
            title={t('settings.about')}
            onPress={() => navigation.navigate("AboutScreen")}
          />
        </SettingSection>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            const lines = [
              "Diễn đàn hs Chuyên Biên Hòa là sân chơi của chuyên Nga :)))",
              "1 trong 2 người tạo ra là chuyên Nga K60",
              "Quản lý page chính Nga K67",
              "Developer chăm chỉ Nga K67 :))",
              "Phát triển Discord Nga K68",
              "Thank you Dương Tùng Anh",
              "Mãi mãi là chuyên Nga!!",
              "Em yêu chuyên Nga",
              "Cảm ơn bạn đã dùng app",
              "Chúc bạn có trải nghiệm thật tuyệt vời và đáng nhớ"
            ];
            const randomLine = lines[Math.floor(Math.random() * lines.length)];
            Toast.show({
              type: "success",
              text1: "Chuyên Nga CBH 🇷🇺",
              text2: randomLine,
              visibilityTime: 3000,
            });
          }}
        >
          <Text style={[styles.versionText, { color: theme.subText }]}>
            {t('settings.version', {
              appVersion: Application.nativeApplicationVersion,
              buildVersion: Application.nativeBuildVersion,
            })}
          </Text>
        </TouchableOpacity>

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
    flex: 1,
  },
  settingItemText: {
    fontSize: 16,
    marginLeft: 12,
    flexShrink: 1,
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
    marginBottom: 16,
    gap: 20,
  },
  socialButton: {
    padding: 8,
  },
});
