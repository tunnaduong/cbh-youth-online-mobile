import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Dropdown from "../../../components/Dropdown";
import { getSubforums } from "../../../services/api/Api";

const CreatePostScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
  const insets = useSafeAreaInsets();
  const { username, userInfo, profileName } = useContext(AuthContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const view = [
    { label: "Công khai", value: 0 },
    { label: "Riêng tư", value: 1 },
  ];
  const [viewSelected, setViewSelected] = useState(view[0]);

  const subforum = {};

  useEffect(() => {
    getSubforums().then((res) => {
      setSubforums(res.data);
    });
  }, []);

  const handlePost = () => {
    // TODO: Implement post creation logic
    console.log("Creating post:", { title, postContent });
  };

  return (
    <>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 50,
            borderBottomColor: "#ccc",
            borderBottomWidth: 0.8,
          },
          Platform.OS === "android"
            ? { marginTop: insets.top }
            : { height: "auto", paddingVertical: 12 },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back-circle" size={25} color={"#A7A7A7"} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            marginLeft: 16,
            color: "#309627",
          }}
        >
          Tạo bài viết
        </Text>
        <TouchableOpacity
          style={[
            {
              marginLeft: "auto",
              paddingHorizontal: 25,
              paddingVertical: 10,
              backgroundColor: "#309627",
              borderRadius: 20,
            },
            Platform.OS === "android" && { paddingVertical: 8 },
          ]}
          onPress={handlePost}
        >
          <Text
            style={{
              color: "white",
              lineHeight: 20,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Đăng
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.container}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            marginLeft: 16,
          }}
        >
          <Image
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
            }}
            style={{
              width: 70,
              height: 70,
              borderRadius: 35,

              borderColor: "#ccc",
              borderWidth: 1,
            }}
          />
          <View>
            <Text className="font-medium text-lg">{profileName}</Text>
            <Dropdown
              options={view}
              placeholder={"Công khai"}
              selectedValue={viewSelected}
              onValueChange={setViewSelected}
              style={{
                borderWidth: 0,
                backgroundColor: "#f3f4f6",
                padding: 6,
                borderRadius: 8,
                gap: 3,
              }}
              leftIcon={<Ionicons name="earth" size={15} color={"#777"} />}
              textStyle={{
                fontSize: 12,
                color: "#777",
              }}
              arrowSize={15}
            />
          </View>
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="Chủ đề bạn muốn chia sẻ là gì?"
            value={title}
            onChangeText={setTitle}
          />
          <View
            style={{
              height: 0,
              borderTopWidth: 1,
              borderColor: "#ddd",
              marginHorizontal: 12,
            }}
          ></View>
          <TextInput
            style={styles.contentInput}
            placeholder="Bạn đang nghĩ gì?"
            value={postContent}
            onChangeText={setPostContent}
            multiline
            textAlignVertical="top"
          />
        </View>
        <View style={{ marginTop: 10, marginHorizontal: 16 }}>
          <Dropdown
            options={subforums}
            placeholder={"Chọn chuyên mục cho bài viết này"}
            selectedValue={selected}
            onValueChange={setSelected}
          />
          <View className="flex-row items-center gap-2 mt-1">
            <TouchableOpacity
              onPress={() => {
                navigation.goBack();
                setTimeout(() => {
                  navigation.navigate("PostScreen", { postId: 213057 });
                }, 0);
              }}
              className="flex-row items-center h-10 gap-2 border-[1.3px] border-[#319527] rounded-xl py-1.5 px-3 self-start"
            >
              <Ionicons name="logo-markdown" size={15} />
              <Text>Hỗ trợ Markdown</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                navigation.goBack();
                setTimeout(() => {
                  navigation.navigate("PostScreen", { postId: 213054 });
                }, 0);
              }}
              className="flex-row items-center h-10 justify-center gap-1 border-[1.3px] border-[#319527] rounded-xl px-3 self-start"
            >
              <Ionicons name="warning" size={18} />
              <Text>Quy tắc</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  inputContainer: {
    padding: 5,
    backgroundColor: "#fafafa",
    borderRadius: 15,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  titleInput: {
    height: 40,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  contentInput: {
    height: 200,
    padding: 12,
    fontSize: 16,
  },
  postButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  postButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default CreatePostScreen;
