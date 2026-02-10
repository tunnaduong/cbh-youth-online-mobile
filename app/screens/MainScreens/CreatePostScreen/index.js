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
  Switch,
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
import * as DocumentPicker from "expo-document-picker";
import FastImage from "react-native-fast-image";
import { CommonActions } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";

const CreatePostScreen = ({ navigation }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
  const insets = useSafeAreaInsets();
  const { username, userInfo, profileName } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const view = [
    { label: "Công khai", value: "public", icon: "earth" },
    { label: "Chỉ người theo dõi", value: "followers", icon: "people" },
    { label: "Riêng tư", value: "private", icon: "lock-closed" },
  ];
  const [viewSelected, setViewSelected] = useState(view[0]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);

  useEffect(() => {
    if (isAnonymous && viewSelected.value === 'followers') {
      setViewSelected(view[0]); // Reset to public
    }
  }, [isAnonymous]);

  const navigateToPost = (postId) => {
    if (navigation) {
      navigation.goBack();
      setTimeout(() => {
        navigation.navigate("PostScreen", { postId });
      }, 0);
    }
  };

  const navigateToHelp = (postId) => {
    if (!navigation) return;

    try {
      navigation.goBack();
      // Use a timeout to ensure goBack completes
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

  useEffect(() => {
    getSubforums().then((res) => {
      setSubforums(res.data);
    });
  }, []);

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

  const pickDocument = async () => {
    try {
      let result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        setSelectedDocuments((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.log("Error picking document:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi chọn tài liệu",
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

  const removeDocument = (indexToRemove) => {
    setSelectedDocuments((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
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
      let cdnIds = [];
      let docIds = [];

      if (selectedImages.length > 0) {
        // Upload all images
        for (const imageUri of selectedImages) {
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
      }

      if (selectedDocuments.length > 0) {
        // Upload all documents
        for (const dock of selectedDocuments) {
          const formData = new FormData();

          formData.append("uid", userInfo.id);
          formData.append("file", {
            uri: dock.uri,
            name: dock.name,
            type: dock.mimeType || "application/octet-stream",
          });

          const uploadResponse = await uploadFile(formData);
          docIds.push(uploadResponse.data.id);
        }
      }

      const response = await createPost({
        title,
        description: postContent,
        cdn_image_id: cdnIds.length > 0 ? cdnIds.join(",") : null,
        cdn_document_id: docIds.length > 0 ? docIds.join(",") : null,
        subforum_id: selected?.value ?? null,
        visibility: 0,
        privacy: viewSelected.value,
        anonymous: isAnonymous,
      });

      if (viewSelected.value === "public") {
        setFeed((prevPosts) => [response.data, ...prevPosts]);
      }

      // Use a more defensive approach to navigation
      if (navigation) {
        try {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "MainScreens" }],
            })
          );
        } catch (navError) {
          // If reset fails, try simple navigation
          navigation.navigate("MainScreens");
        }
      } else {
        // If navigation is not available, at least update the feed
        Toast.show({
          type: "success",
          text1: "Đăng bài viết thành công",
          text2: "Đang tải lại trang...",
          autoHide: true,
          visibilityTime: 2000,
          topOffset: 60,
        });
      }

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
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ProgressHUD loadText="Đang đăng..." visible={loading} />
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
          Tạo bài viết
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
          {isAnonymous ? (<>
            <View style={{ width: 70, height: 70, backgroundColor: isDarkMode ? '#1f2937' : '#e9f1e9', borderRadius: 35, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 36 }}>?</Text>
            </View>
          </>) : (
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
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '500', fontSize: 18, color: theme.text }} numberOfLines={1}>
              {isAnonymous ? "Người dùng ẩn danh" : profileName}
              {userInfo.verified && !isAnonymous && (
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
              options={isAnonymous ? view.filter(v => v.value !== 'followers') : view}
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
          <View
            style={{
              height: 0,
              borderTopWidth: 1,
              borderColor: theme.border,
              marginHorizontal: 12,
            }}
          ></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
            <View>
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: theme.text, marginBottom: 5 }}>Đăng ẩn danh</Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>Người kiểm duyệt vẫn sẽ thấy thông tin của bạn</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor={isAnonymous ? '#f4f3f4' : '#f4f3f4'}
              onValueChange={() => setIsAnonymous(!isAnonymous)}
              value={isAnonymous}
            />
          </View>
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
              onPress={() => navigateToHelp(865586194)}
              style={{ flexDirection: 'row', alignItems: 'center', height: 40, gap: 8, borderWidth: 1.3, borderColor: theme.primary, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 }}
            >
              <Ionicons name="logo-markdown" size={15} color={theme.text} />
              <Text style={{ color: theme.text }}>Hỗ trợ Markdown</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateToHelp(173336279)}
              style={{ flexDirection: 'row', alignItems: 'center', height: 40, justifyContent: 'center', gap: 4, borderWidth: 1.3, borderColor: theme.primary, borderRadius: 12, paddingHorizontal: 12 }}
            >
              <Ionicons name="warning" size={18} color={theme.text} />
              <Text style={{ color: theme.text }}>Quy tắc</Text>
            </TouchableOpacity>
          </View>

          {/* Document list */}
          {selectedDocuments.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {selectedDocuments.map((doc, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDarkMode ? '#374151' : '#F0F2F5', padding: 10, borderRadius: 8, marginBottom: 5 }}>
                  <Ionicons name="document-text-outline" size={24} color={theme.primary} />
                  <Text style={{ flex: 1, marginHorizontal: 10, color: theme.text }} numberOfLines={1}>{doc.name}</Text>
                  <TouchableOpacity onPress={() => removeDocument(index)}>
                    <Ionicons name="close-circle" size={20} color={theme.subText} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

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
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
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
                  flex: 1
                }}
              >
                <Ionicons
                  name="image-outline"
                  size={30}
                  color={theme.primary}
                />
                <Text style={{ color: theme.primary, marginTop: 4 }}>Thêm ảnh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={pickDocument}
                style={{
                  height: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.3,
                  borderColor: theme.border,
                  borderRadius: 12,
                  flex: 1
                }}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={30}
                  color={theme.primary}
                />
                <Text style={{ color: theme.primary, marginTop: 4 }}>Thêm tài liệu</Text>
              </TouchableOpacity>
            </View>
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

export default CreatePostScreen;
