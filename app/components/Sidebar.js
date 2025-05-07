import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ActionSheetIOS,
} from "react-native";
import React, { useEffect, useState, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { List } from "react-native-paper";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../contexts/AuthContext";

const Sidebar = () => {
  const [username, setUsername] = useState("");
  const [profileName, setProfileName] = useState("");
  const { setIsLoggedIn } = useContext(AuthContext);

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
      <ScrollView style={{ borderRightWidth: 0.8, borderColor: "#B3B3B3" }}>
        <SafeAreaView className="mx-4 mt-4">
          <TouchableOpacity className="gap-y-2">
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
          <List.Subheader>Tài khoản</List.Subheader>
          <List.Item
            title="Trang cá nhân"
            onPress={() => null}
            right={() => (
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                style={{ marginRight: -10, marginTop: 3 }}
              />
            )}
            left={() => (
              <Ionicons
                name="person-circle-outline"
                size={24}
                style={{ marginLeft: 14, marginRight: -5 }}
              />
            )}
          />
          <List.Item
            title="Cài đặt"
            onPress={() => null}
            right={() => (
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                style={{ marginRight: -10, marginTop: 3 }}
              />
            )}
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
            right={() => (
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                style={{ marginRight: -10, marginTop: 3 }}
              />
            )}
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
            right={() => (
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                style={{ marginRight: -10, marginTop: 3 }}
              />
            )}
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
            right={() => (
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                style={{ marginRight: -10, marginTop: 3 }}
              />
            )}
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
            right={() => (
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                style={{ marginRight: -10, marginTop: 3 }}
              />
            )}
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
