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
} from "react-native";
import React, { useEffect, useState, useContext, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { List } from "react-native-paper";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../contexts/AuthContext";
import Collapsible from "react-native-collapsible";
import { useNavigation } from "@react-navigation/native";

const Sidebar = () => {
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const { setIsLoggedIn } = useContext(AuthContext);
  const [collapsedSections, setCollapsedSections] = useState({
    community: true,
    reports: true,
    search: true,
    explore: true,
  });
  const navigation = useNavigation();

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
    clearAll();
    setIsLoggedIn(false);
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
      <ScrollView
        style={{ borderRightWidth: 0.8, borderColor: "#B3B3B3" }}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView className="mx-4 mt-11">
          <TouchableOpacity
            className="gap-y-2"
            onPress={() => navigation.navigate("ProfileScreen", { username })}
          >
            <Image
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
        </SafeAreaView>
        <List.Section>
          <List.Subheader>Tiện ích</List.Subheader>
          <List.Item
            title="Cộng đồng"
            right={() => (
              <Animated.View
                style={{
                  transform: [
                    { translateX: 5 }, // Move the origin point left by 10px
                    { rotate: getChevronRotation("community") }, // Apply rotation
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
                name="people-outline"
                size={24}
                style={{ marginLeft: 14, marginRight: -5 }}
              />
            )}
            onPress={() => toggleSection("community")}
          />
          <Collapsible collapsed={collapsedSections.community}>
            <View style={{ paddingLeft: 40, paddingVertical: 10 }}>
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </View>
          </Collapsible>
          <List.Item
            title="Báo cáo"
            onPress={() => toggleSection("reports")}
            right={() => (
              <Animated.View
                style={{
                  transform: [
                    { translateX: 5 }, // Move the origin point left by 10px
                    { rotate: getChevronRotation("reports") }, // Apply rotation
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
                name="alert-circle-outline"
                size={24}
                style={{ marginLeft: 14, marginRight: -5 }}
              />
            )}
          />
          <Collapsible collapsed={collapsedSections.reports}>
            <View style={{ paddingLeft: 40, paddingVertical: 10 }}>
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </View>
          </Collapsible>
          <List.Item
            title="Tra cứu"
            onPress={() => toggleSection("search")}
            right={() => (
              <Animated.View
                style={{
                  transform: [
                    { translateX: 5 }, // Move the origin point left by 10px
                    { rotate: getChevronRotation("search") }, // Apply rotation
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
                name="search-outline"
                size={24}
                style={{ marginLeft: 14, marginRight: -5 }}
              />
            )}
          />
          <Collapsible collapsed={collapsedSections.search}>
            <View style={{ paddingLeft: 40, paddingVertical: 10 }}>
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </View>
          </Collapsible>
          <List.Item
            title="Khám phá"
            onPress={() => toggleSection("explore")}
            right={() => (
              <Animated.View
                style={{
                  transform: [
                    { translateX: 5 }, // Move the origin point left by 10px
                    { rotate: getChevronRotation("explore") }, // Apply rotation
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
                name="telescope-outline"
                size={24}
                style={{ marginLeft: 14, marginRight: -5 }}
              />
            )}
          />
          <Collapsible collapsed={collapsedSections.explore}>
            <View style={{ paddingLeft: 40, paddingVertical: 10 }}>
              <Text>- Sub-item 1</Text>
              <Text>- Sub-item 2</Text>
            </View>
          </Collapsible>
        </List.Section>
        <List.Section>
          <List.Subheader>Thiết lập</List.Subheader>
          <List.Item
            title="Cài đặt"
            onPress={() => null}
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
            onPress={() => null}
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
    </>
  );
};

export default Sidebar;
