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
  updatePost,
  getSubforums,
  uploadFile,
  getPost,
} from "../../../services/api/Api";
import Verified from "../../../assets/Verified";
import Toast from "react-native-toast-message";
import { FeedContext } from "../../../contexts/FeedContext";
import ProgressHUD from "../../../components/ProgressHUD";
import * as ImagePicker from "expo-image-picker";
import FastImage from "react-native-fast-image";
import { CommonActions } from "@react-navigation/native";

const PostEditScreen = ({ navigation, route }) => {
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
  const [selectedImages, setSelectedImages] = useState([]);
  const [initialPost, setInitialPost] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [subforumsRes, postRes] = await Promise.all([
          getSubforums(),
          getPost(route.params.postId),
        ]);

        setSubforums(subforumsRes.data);
        const post = postRes.data;
        setInitialPost(post);

        // Set initial values
        setTitle(post.title);
        setPostContent(post.description);
        setViewSelected(
          view.find((v) => v.value === post.visibility) || view[0]
        );
        if (post.subforum_id) {
          setSelected(
            subforumsRes.data.find((s) => s.value === post.subforum_id)
          );
        }
        if (post.cdn_image_id) {
          // Convert comma-separated CDN IDs to image URLs
          const imageUrls = post.cdn_image_id
            .split(",")
            .map((id) => `https://api.chuyenbienhoa.com/v1.0/cdn/${id}`);
          setSelectedImages(imageUrls);
        }
      } catch (error) {
        console.log("Error fetching post:", error);
        Toast.show({
          type: "error",
          text1: "Không thể tải bài viết",
          text2: "Vui lòng thử lại sau.",
          autoHide: true,
          visibilityTime: 3000,
          topOffset: 60,
        });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    if (route.params?.postId) {
      fetchData();
    } else {
      navigation.goBack();
    }
  }, [route.params?.postId]);

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        setSelectedImages((prev) => [
          ...prev,
          ...result.assets.map((asset) => asset.uri),
        ]);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi chọn ảnh",
        text2: "Vui lòng thử lại.",
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const removeImage = (indexToRemove) => {
    setSelectedImages((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const handleUpdate = async () => {
    if (title.trim() === "" || postContent.trim() === "") {
      Toast.show({
        type: "error",
        text1: "Chưa thể cập nhật bài viết",
        text2: "Vui lòng nhập tiêu đề và nội dung bài viết.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      return;
    }

    try {
      setLoading(true);
      let cdnIds = [];

      // Handle new images that need to be uploaded
      const newImages = selectedImages.filter(
        (uri) => !uri.includes("api.chuyenbienhoa.com")
      );
      for (const imageUri of newImages) {
        const formData = new FormData();
        const fileExtension = imageUri.split(".").pop();
        let mimeType = "image/jpeg";
        if (fileExtension === "png") {
          mimeType = "image/png";
        } else if (fileExtension === "gif") {
          mimeType = "image/gif";
        }

        formData.append("uid", userInfo.id);
        formData.append("file", {
          uri: imageUri,
          name: `image.${fileExtension}`,
          type: mimeType,
        });

        const uploadResponse = await uploadFile(formData);
        cdnIds.push(uploadResponse.data.id);
      }

      // Get existing CDN IDs from URLs
      const existingCdnIds = selectedImages
        .filter((uri) => uri.includes("api.chuyenbienhoa.com"))
        .map((uri) => uri.split("/").pop());

      // Combine existing and new CDN IDs
      const allCdnIds = [...existingCdnIds, ...cdnIds];

      const response = await updatePost(route.params.postId, {
        title,
        description: postContent,
        cdn_image_id: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
        subforum_id: selected?.value ?? null,
        visibility: viewSelected.value,
      });

      if (viewSelected.value === 0) {
        setFeed((prevPosts) =>
          prevPosts.map((post) =>
            post.id === route.params.postId ? response.data : post
          )
        );
      }

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "MainScreens" }],
        })
      );

      return response;
    } catch (error) {
      console.log("Error updating post:", error);
      Toast.show({
        type: "error",
        text1: "Chưa thể cập nhật bài viết",
        text2: error?.response?.data?.message || "Vui lòng thử lại sau.",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateToHelp = (postId) => {
    if (!navigation) return;

    try {
      navigation.goBack();
      setTimeout(() => {
        try {
          navigation.navigate("PostScreen", { postId });
        } catch (error) {
          console.log("Navigation error:", error);
        }
      }, 100);
    } catch (error) {
      console.log("Navigation error:", error);
    }
  };

  if (!initialPost) {
    return (
      <View style={styles.loadingContainer}>
        <ProgressHUD visible={true} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={"default"} />
      <ProgressHUD loadText="Đang cập nhật..." visible={loading} />
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
          Chỉnh sửa bài viết
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
          onPress={handleUpdate}
        >
          <Text
            style={{
              color: "white",
              lineHeight: 20,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Lưu
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
          <FastImage
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
            placeholderTextColor="#999"
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
            placeholderTextColor="#999"
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
              onPress={() => navigateToHelp(213057)}
              className="flex-row items-center h-10 gap-2 border-[1.3px] border-[#319527] rounded-xl py-1.5 px-3 self-start"
            >
              <Ionicons name="logo-markdown" size={15} />
              <Text>Hỗ trợ Markdown</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateToHelp(213054)}
              className="flex-row items-center h-10 justify-center gap-1 border-[1.3px] border-[#319527] rounded-xl px-3 self-start"
            >
              <Ionicons name="warning" size={18} />
              <Text>Quy tắc</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3"
              contentContainerStyle={{
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              <View className="flex-row gap-2">
                {Array.isArray(selectedImages) &&
                  selectedImages.map((uri, index) => {
                    return (
                      <View
                        key={`image-${index}-${uri}`}
                        className="relative"
                        style={{ marginTop: 7, marginRight: 7 }}
                      >
                        <Image
                          source={{ uri }}
                          style={{
                            width: 146,
                            height: 146,
                            borderRadius: 13,
                            borderColor: "#ccc",
                            borderWidth: 1,
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (typeof removeImage === "function") {
                              removeImage(index);
                            }
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 border-[4px] border-white"
                        >
                          <Ionicons name="trash" size={20} color={"#fff"} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                <TouchableOpacity
                  onPress={() => {
                    if (typeof pickImage === "function") {
                      pickImage();
                    }
                  }}
                  className="items-center justify-center border-[1.3px] border-[#ECECEC] rounded-xl"
                  style={{
                    width: 146,
                    height: 146,
                    marginTop: 7,
                  }}
                >
                  <Ionicons
                    name="add-outline"
                    size={40}
                    color={"#519527"}
                    style={{ marginTop: -5 }}
                  />
                  <Text className="text-[#319527]">Thêm ảnh</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <TouchableOpacity
              onPress={() => {
                if (typeof pickImage === "function") {
                  pickImage();
                }
              }}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
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
    color: "#000",
  },
  contentInput: {
    height: 200,
    padding: 12,
    fontSize: 16,
    color: "#000",
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

export default PostEditScreen;
