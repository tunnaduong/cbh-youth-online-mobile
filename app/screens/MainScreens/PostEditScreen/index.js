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
import { useTheme } from "../../../contexts/ThemeContext";

const PostEditScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
  const insets = useSafeAreaInsets();
  const { username, userInfo, profileName } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const view = [
    { label: "Công khai", value: 0, icon: "earth" },
    { label: "Riêng tư", value: 1, icon: "lock-closed" },
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ProgressHUD visible={true} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ProgressHUD loadText="Đang cập nhật..." visible={loading} />
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 50,
            borderBottomColor: theme.border,
            borderBottomWidth: 0.8,
            backgroundColor: theme.background,
          },
          Platform.OS === "android"
            ? { marginTop: insets.top }
            : { height: "auto", paddingVertical: 12 },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back-circle" size={25} color={theme.subText} />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "bold",
            marginLeft: 16,
            color: theme.primary,
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
              backgroundColor: theme.primary,
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

      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingTop: 16,
            paddingLeft: 16,
            backgroundColor: theme.background,
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
              borderColor: theme.border,
              borderWidth: 1,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '500', fontSize: 18, color: theme.text }} numberOfLines={1}>
              {profileName}
              {userInfo.verified && (
                <View>
                  <Verified
                    width={20}
                    height={20}
                    color={theme.primary}
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
                backgroundColor: isDarkMode ? "#374151" : "#f3f4f6",
                padding: 6,
                borderRadius: 8,
                gap: 3,
                alignSelf: "flex-start",
              }}
              leftIcon={
                <Ionicons
                  name={viewSelected.icon}
                  size={15}
                  color={theme.subText}
                />
              }
              textStyle={{
                fontSize: 12,
                color: theme.subText,
              }}
              arrowSize={15}
            />
          </View>
        </View>
        <View style={[styles.inputContainer, { backgroundColor: isDarkMode ? "#1f2937" : "#fafafa", borderColor: theme.border }]}>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            placeholder="Chủ đề bạn muốn chia sẻ là gì?"
            placeholderTextColor={theme.subText}
            value={title}
            onChangeText={setTitle}
          />
          <View
            style={{
              height: 0,
              borderTopWidth: 1,
              borderColor: theme.border,
              marginHorizontal: 12,
            }}
          ></View>
          <TextInput
            style={[styles.contentInput, { color: theme.text }]}
            placeholder="Bạn đang nghĩ gì?"
            placeholderTextColor={theme.subText}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => navigateToHelp(213057)}
              style={{ flexDirection: 'row', alignItems: 'center', height: 40, gap: 8, borderWidth: 1.3, borderColor: theme.primary, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 }}
            >
              <Ionicons name="logo-markdown" size={15} color={theme.text} />
              <Text style={{ color: theme.text }}>Hỗ trợ Markdown</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateToHelp(213054)}
              style={{ flexDirection: 'row', alignItems: 'center', height: 40, justifyContent: 'center', gap: 4, borderWidth: 1.3, borderColor: theme.primary, borderRadius: 12, paddingHorizontal: 12 }}
            >
              <Ionicons name="warning" size={18} color={theme.text} />
              <Text style={{ color: theme.text }}>Quy tắc</Text>
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
                        style={{ marginTop: 7, marginRight: 7, position: 'relative' }}
                      >
                        <Image
                          source={{ uri }}
                          style={{
                            width: 146,
                            height: 146,
                            borderRadius: 13,
                            borderColor: theme.border,
                            borderWidth: 1,
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (typeof removeImage === "function") {
                              removeImage(index);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            backgroundColor: '#ef4444',
                            borderRadius: 999,
                            padding: 6,
                            borderWidth: 4,
                            borderColor: theme.background
                          }}
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
                  style={{
                    width: 146,
                    height: 146,
                    marginTop: 7,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.3,
                    borderColor: theme.border,
                    borderRadius: 12
                  }}
                >
                  <Ionicons
                    name="add-outline"
                    size={40}
                    color={theme.primary}
                    style={{ marginTop: -5 }}
                  />
                  <Text style={{ color: theme.primary }}>Thêm ảnh</Text>
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
              style={{
                height: 100,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.3,
                borderColor: theme.border,
                borderRadius: 12,
                marginTop: 20,
                padding: 40,
                alignSelf: 'flex-start'
              }}
            >
              <Ionicons
                name="add-outline"
                size={40}
                color={theme.primary}
                style={{ marginTop: -5 }}
              />
              <Text style={{ color: theme.primary }}>Thêm ảnh</Text>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    padding: 5,
    borderRadius: 15,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
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
