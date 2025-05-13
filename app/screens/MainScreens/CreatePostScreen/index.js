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
  StatusBar,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Dropdown from "../../../components/Dropdown";
import {
  createPost,
  getSubforums,
  uploadFile,
} from "../../../services/api/Api";
import Verified from "../../../assets/Verified";
import Toast from "react-native-toast-message";
import { FeedContext } from "../../../contexts/FeedContext";
import ProgressHUD from "../../../components/ProgressHUD";
import * as ImagePicker from "expo-image-picker";

const CreatePostScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
  const insets = useSafeAreaInsets();
  const { username, userInfo, profileName } = useContext(AuthContext);
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const view = [
    { label: "Công khai", value: 0 },
    { label: "Riêng tư", value: 1 },
  ];
  const [viewSelected, setViewSelected] = useState(view[0]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    getSubforums().then((res) => {
      setSubforums(res.data);
    });
  }, []);

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Use ImagePicker.MediaTypeOptions.Images
      allowsEditing: true,
      quality: 0.7,
    });

    console.log(result);

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    if (title.trim() === "" || postContent.trim() === "") {
      Toast.show({
        type: "error",
        text1: "Chưa thể đăng bài viết",
        text2: "Vui lòng nhập tiêu đề và nội dung bài viết.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      return;
    }

    try {
      setLoading(true);
      var cdnId = null;

      if (selectedImage) {
        // Upload the image using FormData
        const formData = new FormData();

        // Get the file extension from the URI
        const fileExtension = selectedImage.split(".").pop();

        // Determine the MIME type based on the file extension
        let mimeType = "image/jpeg"; // Default to JPEG
        if (fileExtension === "png") {
          mimeType = "image/png";
        } else if (fileExtension === "gif") {
          mimeType = "image/gif";
        }
        formData.append("uid", userInfo.id);
        formData.append("file", {
          uri: selectedImage,
          name: `image.${fileExtension}`, // You can customize the filename
          type: mimeType, // Adjust the MIME type based on the image type
        });

        const uploadResponse = await uploadFile(formData);
        cdnId = uploadResponse.data.id; // Assuming your API returns an object with an 'id' property
      }

      const response = await createPost({
        title,
        description: postContent,
        cdn_image_id: cdnId,
      });

      setFeed((prevPosts) => [
        response.data, // Add the new post at the beginning of the list
        ...prevPosts,
      ]);

      navigation.goBack();

      return response;
    } catch (error) {
      console.log("Error creating post:", error);
      Toast.show({
        type: "error",
        text1: "Chưa thể đăng bài viết",
        text2: error?.response?.data?.message || "Vui lòng thử lại sau.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle={"default"} />
      <ProgressHUD loadText="Đang đăng..." visible={loading} />
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
            paddingTop: 16,
            paddingLeft: 16,
            backgroundColor: "#fff",
          }}
          pointerEvents="box-none"
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
          <View style={{ flex: 1 }}>
            <Text className="font-medium text-lg" numberOfLines={1}>
              {profileName}
              {userInfo.verified && (
                <View>
                  <Verified
                    width={20}
                    height={20}
                    color={"#319527"}
                    style={{ marginBottom: -5 }}
                  />
                </View>
              )}
            </Text>
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
                alignSelf: "flex-start",
              }}
              leftIcon={
                viewSelected.value === 0 ? (
                  <Ionicons name="earth" size={15} color={"#777"} />
                ) : (
                  <Ionicons name="lock-closed" size={15} color={"#777"} />
                )
              }
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

          {selectedImage ? (
            <View className="relative self-start mt-5">
              <Image
                source={{ uri: selectedImage }}
                style={{
                  width: 146,
                  height: 146,
                  borderRadius: 13,
                  borderColor: "#ccc",
                  borderWidth: 1,
                }}
              />
              <TouchableOpacity
                onPress={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 border-[4px] border-white"
                style={{
                  marginTop: -7,
                  marginRight: -7,
                }}
              >
                <Ionicons name="trash" size={20} color={"#fff"} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickImage}
              className="items-center justify-center mt-5 self-start border-[1.3px] border-[#ECECEC] rounded-xl p-10"
            >
              <Ionicons
                name="add-outline"
                size={40}
                color={"#519527"}
                style={{ marginTop: -5 }}
              />
              <Text className="text-[#319527]">Thêm ảnh</Text>
            </TouchableOpacity>
          )}
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
