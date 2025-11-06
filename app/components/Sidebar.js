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
} from "react-native";
import React, { useEffect, useState, useContext, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { List } from "react-native-paper";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../contexts/AuthContext";
import Collapsible from "react-native-collapsible";
import { useNavigation } from "@react-navigation/native";
import FastImage from "react-native-fast-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Reusable component for collapsible menu items
const CollapsibleMenuItem = ({
  title,
  iconName,
  sectionKey,
  isCollapsed,
  getChevronRotation,
  toggleSection,
  children,
}) => {
  return (
    <>
      <List.Item
        title={title}
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
              style={{ marginRight: -10, marginTop: 3 }}
            />
          </Animated.View>
        )}
        left={() => (
          <Ionicons
            name={iconName}
            size={24}
            style={{ marginLeft: 14, marginRight: -5 }}
          />
        )}
      />
      <Collapsible collapsed={isCollapsed}>
        <View style={{ paddingLeft: 40, paddingVertical: 10 }}>{children}</View>
      </Collapsible>
    </>
  );
};

const Sidebar = () => {
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const { signOut } = useContext(AuthContext);
  const [collapsedSections, setCollapsedSections] = useState({
    community: true,
    reports: true,
    search: true,
    explore: true,
  });
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Animated values for each section
  const rotationValues = useRef({
    community: new Animated.Value(0),
    reports: new Animated.Value(0),
    search: new Animated.Value(0),
    explore: new Animated.Value(0),
  }).current;

  const toggleSection = (section) => {
    const isCollapsed = collapsedSections[section];

    // Animate the chevron rotation
    Animated.timing(rotationValues[section], {
      toValue: isCollapsed ? 1 : 0, // 1 for 180 degrees, 0 for 0 degrees
      duration: 300,
      useNativeDriver: true,
    }).start();

    setCollapsedSections((prevState) => ({
      ...prevState,
      [section]: !prevState[section],
    }));
  };

  const getChevronRotation = (section) => {
    return rotationValues[section].interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"], // Rotate from 0 to 180 degrees
    });
  };

  const getData = async (key) => {
    const result = await AsyncStorage.getItem(key);
    return result;
  };

  const goToScreen = () => {
    signOut();
  };

  const clearAll = async () => {
    try {
      await AsyncStorage.clear();
    } catch (e) {
      // clear error
    }
  };

  const onPressIOS = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Bạn có chắc chắn muốn đăng xuất không?",
        options: ["Hủy", "Đăng xuất"],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 0,
        userInterfaceStyle: "dark",
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
      "Thông báo",
      "Bạn có chắc chắn muốn đăng xuất không?",
      [
        {
          text: "Có",
          onPress: () => {
            goToScreen();
          },
        },
        {
          text: "Không",
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
    <>
      <SafeAreaView className="mt-11">
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            className="gap-y-2 mx-4"
            onPress={() => navigation.navigate("ProfileScreen", { username })}
          >
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={{ width: 60, height: 60, borderRadius: 30 }}
            />
            <View>
              <Text className="text-lg font-bold">{profileName}</Text>
              <Text className="text-gray-500">@{username}</Text>
            </View>
          </TouchableOpacity>
          <List.Section>
            <List.Subheader>Tiện ích</List.Subheader>
            <CollapsibleMenuItem
              title="Cộng đồng"
              iconName="people-outline"
              sectionKey="community"
              isCollapsed={collapsedSections.community}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
            >
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </CollapsibleMenuItem>
            <CollapsibleMenuItem
              title="Báo cáo"
              iconName="alert-circle-outline"
              sectionKey="reports"
              isCollapsed={collapsedSections.reports}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
            >
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </CollapsibleMenuItem>
            <CollapsibleMenuItem
              title="Tra cứu"
              iconName="search-outline"
              sectionKey="search"
              isCollapsed={collapsedSections.search}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
            >
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </CollapsibleMenuItem>
            <CollapsibleMenuItem
              title="Khám phá"
              iconName="telescope-outline"
              sectionKey="explore"
              isCollapsed={collapsedSections.explore}
              getChevronRotation={getChevronRotation}
              toggleSection={toggleSection}
            >
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </CollapsibleMenuItem>
          </List.Section>
          <List.Section>
            <List.Subheader>Thiết lập</List.Subheader>
            <List.Item
              title="Cài đặt"
              onPress={() => navigation.navigate("Settings")}
              left={() => (
                <Ionicons
                  name="settings-outline"
                  size={24}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title="Đăng xuất"
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
            <List.Subheader>Hỗ trợ</List.Subheader>
            <List.Item
              title="Giới thiệu"
              onPress={() => navigation.navigate("AboutScreen")}
              left={() => (
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title="Trợ giúp"
              onPress={() => null}
              left={() => (
                <Ionicons
                  name="help-circle-outline"
                  size={24}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title="Quyền riêng tư"
              onPress={() => null}
              left={() => (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
            <List.Item
              title="Điều khoản sử dụng"
              onPress={() => null}
              left={() => (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  style={{ marginLeft: 14, marginRight: -5 }}
                />
              )}
            />
          </List.Section>
        </ScrollView>
      </SafeAreaView>
    </>
  );
};

export default Sidebar;
