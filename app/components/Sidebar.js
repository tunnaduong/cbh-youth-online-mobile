import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActionSheetIOS,
  Animated,
  Alert,
  Linking,
} from "react-native";
import React, { useEffect, useState, useContext, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { List } from "react-native-paper";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import Collapsible from "react-native-collapsible";
import { useNavigation } from "@react-navigation/native";
import FastImage from "react-native-fast-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";

// Reusable component for collapsible menu items
const CollapsibleMenuItem = ({
  title,
  iconName,
  sectionKey,
  isCollapsed,
  getChevronRotation,
  toggleSection,
  children,
  theme,
}) => {
  return (
    <>
      <List.Item
        title={title}
        titleStyle={{ color: theme.text }}
        onPress={() => toggleSection(sectionKey)}
        right={() => (
          <Animated.View
            style={{
              transform: [
                { translateX: 5 },
                { rotate: getChevronRotation(sectionKey) },
                { translateX: -5 },
              ],
            }}
          >
            <Ionicons
              name="chevron-down-outline"
              size={20}
              color={theme.subText}
              style={{ marginRight: -10, marginTop: 3 }}
            />
          </Animated.View>
        )}
        left={() => (
          <Ionicons
            name={iconName}
            size={24}
            color={theme.text}
            style={{ marginLeft: 14, marginRight: -5 }}
          />
        )}
      />
      <Collapsible collapsed={isCollapsed}>
        <View style={{ paddingLeft: 40, backgroundColor: theme.background }}>{children}</View>
      </Collapsible>
    </>
  );
};

const Sidebar = () => {
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const { signOut } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const [collapsedSections, setCollapsedSections] = useState({
    community: true,
    reports: true,
    search: true,
  });
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Animated values for each section
  const rotationValues = useRef({
    community: new Animated.Value(0),
    reports: new Animated.Value(0),
    search: new Animated.Value(0),
  }).current;

  const toggleSection = (section) => {
    const isCollapsed = collapsedSections[section];

    // If opening a section, close all other sections first
    if (isCollapsed) {
      // Animate all other open sections to close
      Object.keys(collapsedSections).forEach((key) => {
        if (key !== section && !collapsedSections[key]) {
          Animated.timing(rotationValues[key], {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      });
    }

    // Animate the chevron rotation for the clicked section
    Animated.timing(rotationValues[section], {
      toValue: isCollapsed ? 1 : 0, // 1 for 180 degrees, 0 for 0 degrees
      duration: 300,
      useNativeDriver: true,
    }).start();

    setCollapsedSections((prevState) => {
      const newState = { ...prevState };

      // If opening a section, close all others
      if (isCollapsed) {
        Object.keys(newState).forEach((key) => {
          if (key !== section) {
            newState[key] = true; // Collapse all other sections
          }
        });
      }

      // Toggle the clicked section
      newState[section] = !prevState[section];

      return newState;
    });
  };

  const getChevronRotation = (section) => {
    return rotationValues[section].interpolate({
      inputRange: [0, 1],
      outputRange: ["-90deg", "0deg"], // Rotate from 0 to 180 degrees
    });
  };

  const getData = async (key) => {
    const result = await AsyncStorage.getItem(key);
    return result;
  };

  const goToScreen = () => {
    signOut();
  };

  const onPressIOS = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t('settings.logoutConfirm'),
        options: [t('settings.cancel'), t('settings.logout')],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 0,
        userInterfaceStyle: isDarkMode ? "dark" : "light",
      },
      (buttonIndex) => {
        if (buttonIndex === 0) {
          // cancel action
        } else if (buttonIndex === 1) {
          goToScreen();
        }
      }
    );
  };
  const onPressAndroid = () =>
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm'),
      [
        {
          text: t('settings.yes'),
          onPress: () => {
            goToScreen();
          },
        },
        {
          text: t('settings.no'),
          style: "cancel",
        },
      ],
      { cancelable: true }
    );

  useEffect(() => {
    const fetchData = async () => {
      const userInfo = await getData("user_info");
      if (userInfo) {
        const parsedUserInfo = JSON.parse(userInfo);
        setProfileName(parsedUserInfo.profile_name);
        setUsername(parsedUserInfo.username);
      }
    };

    fetchData();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
          <TouchableOpacity
            style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 16, gap: 8 }}
            onPress={() => navigation.navigate("ProfileScreen", { username })}
          >
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={{ width: 60, height: 60, borderRadius: 30 }}
            />
            <View>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: theme.text }}>{profileName}</Text>
              <Text style={{ color: theme.subText }}>@{username}</Text>
            </View>
          </TouchableOpacity>
          <List.Section>
            <List.Subheader style={{ color: theme.primary, fontWeight: "bold" }}>{t('sidebar.utilities')}</List.Subheader>
            <CollapsibleMenuItem
              title={t('sidebar.community')}
              iconName="people-outline"
              sectionKey="community"
              isCollapsed={collapsedSections.community}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
              theme={theme}
            >
              <List.Item
                title={t('sidebar.feed')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  navigation.navigate("MainScreens", { screen: "Home" })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('navigation.forum')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  navigation.navigate("MainScreens", { screen: "Forum" })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('sidebar.loudspeaker')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  Toast.show({
                    type: "info",
                    text1: t('sidebar.featureInDevelopment'),
                  })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('sidebar.youthUnionNews')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  navigation.navigate("CategoryScreen", { categoryId: 32 })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('sidebar.saved')}
                titleStyle={{ color: theme.text }}
                onPress={() => navigation.navigate("SavedPostsScreen")}
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
            </CollapsibleMenuItem>
            <CollapsibleMenuItem
              title={t('sidebar.reports')}
              iconName="alert-circle-outline"
              sectionKey="reports"
              isCollapsed={collapsedSections.reports}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
              theme={theme}
            >
              <List.Item
                title={t('sidebar.studentViolation')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  navigation.navigate("ReportScreen", { type: "student" })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('sidebar.classViolation')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  navigation.navigate("ReportScreen", { type: "class" })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
            </CollapsibleMenuItem>
            <CollapsibleMenuItem
              title={t('sidebar.lookup')}
              iconName="search-outline"
              sectionKey="search"
              isCollapsed={collapsedSections.search}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
              theme={theme}
            >
              <List.Item
                title={t('sidebar.timetable')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  Toast.show({
                    type: "info",
                    text1: t('sidebar.featureInDevelopment'),
                  })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('sidebar.classRanking')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  Toast.show({
                    type: "info",
                    text1: t('sidebar.featureInDevelopment'),
                  })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
              <List.Item
                title={t('sidebar.memberRanking')}
                titleStyle={{ color: theme.text }}
                onPress={() =>
                  Toast.show({
                    type: "info",
                    text1: t('sidebar.featureInDevelopment'),
                  })
                }
                style={{ paddingLeft: 0, marginLeft: 0 }}
              />
            </CollapsibleMenuItem>
            <List.Item
              title={t('sidebar.explore')}
              titleStyle={{ color: theme.text }}
              onPress={() => navigation.navigate("ExploreScreen")}
              left={() => (
                <Ionicons
                  name="telescope-outline"
                  size={24}
                  color={theme.text}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
              right={() => (
                <Ionicons
                  name="chevron-down-outline"
                  size={20}
                  color={theme.subText}
                  style={{
                    marginRight: -10,
                    marginTop: 3,
                    transform: [{ rotate: "-90deg" }],
                  }}
                />
              )}
            />
          </List.Section>
          <List.Section>
            <List.Subheader style={{ color: theme.primary, fontWeight: "bold" }}>{t('sidebar.settingsGroup')}</List.Subheader>
            <List.Item
              title={t('settings.title')}
              titleStyle={{ color: theme.text }}
              onPress={() => navigation.navigate("Settings")}
              left={() => (
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={theme.text}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title={t('settings.logout')}
              onPress={() => {
                Platform.OS === "ios" ? onPressIOS() : onPressAndroid();
              }}
              left={() => (
                <Ionicons
                  name="log-out-outline"
                  size={24}
                  style={{ marginLeft: 14, marginRight: -5 }}
                  color={"#F66566"}
                />
              )}
              titleStyle={{ color: "#F66566" }}
            />
          </List.Section>
          <List.Section>
            <List.Subheader style={{ color: theme.primary, fontWeight: "bold" }}>{t('sidebar.support')}</List.Subheader>
            <List.Item
              title={t('sidebar.about')}
              titleStyle={{ color: theme.text }}
              onPress={() => navigation.navigate("AboutScreen")}
              left={() => (
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color={theme.text}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title={t('sidebar.help')}
              titleStyle={{ color: theme.text }}
              onPress={() =>
                Linking.openURL("https://www.chuyenbienhoa.com/help")
              }
              left={() => (
                <Ionicons
                  name="help-circle-outline"
                  size={24}
                  color={theme.text}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title={t('sidebar.privacy')}
              titleStyle={{ color: theme.text }}
              onPress={() => navigation.navigate("PrivacyPolicyScreen")}
              left={() => (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={theme.text}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title={t('sidebar.terms')}
              titleStyle={{ color: theme.text }}
              onPress={() => navigation.navigate("TermsOfServiceScreen")}
              left={() => (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={theme.text}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
          </List.Section>
        </ScrollView>
    </View>
  );
};

export default Sidebar;
