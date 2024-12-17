import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";

export default function MenuScreen() {
  const [profileName, setProfileName] = useState("");
  const [username, setUsername] = useState("");

  const getData = async (key) => {
    const result = await AsyncStorage.getItem(key);
    return result;
  };

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
    <ScrollView>
      <Image
        source={{
          uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
        }}
        style={{ width: 100, height: 100 }}
      />
      <Text>{profileName}</Text>
      <Text>@{username}</Text>
    </ScrollView>
  );
}
