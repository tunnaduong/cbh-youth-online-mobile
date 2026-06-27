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
  Switch,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Dropdown from "../../../components/Dropdown";
import { getCategoryName } from "../../../utils/forumUtils";
import {
  updatePost,
  getSubforums,
  uploadFile,
  getPostDetail,
} from "../../../services/api/Api";
import Verified from "../../../assets/Verified";
import Toast from "react-native-toast-message";
import { FeedContext } from "../../../contexts/FeedContext";
import ProgressHUD from "../../../components/ProgressHUD";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import FastImage from "../../../components/FastImage";
import { CommonActions } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";

const PostEditScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
  const insets = useSafeAreaInsets();
  const { username, userInfo, profileName } = useContext(AuthContext);
  if (!userInfo) {
    return null;
  }
  const { theme, isDarkMode } = useTheme();
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const { t } = useTranslation();
  
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [viewSelected, setViewSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [initialPost, setInitialPost] = useState(null);

  const viewOptions = isAnonymous ? [
    { label: t('editPost.public') || t('createPost.privacyPublic') || "Công khai", value: "public", icon: "earth" },
    { label: t('editPost.private') || t('createPost.privacyPrivate') || "Riêng tư", value: "private", icon: "lock-closed" },
  ] : [
    { label: t('editPost.public') || t('createPost.privacyPublic') || "Công khai", value: "public", icon: "earth" },
    { label: t('createPost.privacyFollowers') || "Người theo dõi", value: "followers", icon: "people" },
    { label: t('editPost.private') || t('createPost.privacyPrivate') || "Riêng tư", value: "private", icon: "lock-closed" },
  ];

  useEffect(() => {
    if (isAnonymous && viewSelected?.value === 'followers') {
      setViewSelected(viewOptions[0]);
    }
  }, [isAnonymous]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [subforumsRes, postRes] = await Promise.all([
          getSubforums(),
          getPostDetail(route.params.postId),
        ]);

        const translatedSubforums = subforumsRes.data.map(item => ({
          ...item,
          label: getCategoryName(item.label, t)
        }));
        setSubforums(translatedSubforums);
        const post = postRes.data;
        setInitialPost(post);

        // Set initial values
        setTitle(post.title);
        setPostContent(post.description);
        setIsAnonymous(!!post.anonymous);
        
        // Match the initial view option based on privacy
        const initialPrivacy = post.privacy || (post.visibility === 1 ? "private" : "public");
        const matchingOption = viewOptions.find(v => v.value === initialPrivacy) || viewOptions[0];
        setViewSelected(matchingOption);

        if (post.subforum_id) {
          setSelected(
            translatedSubforums.find((s) => s.value === post.subforum_id)
          );
        }

        if (post.images && post.images.length > 0) {
          setSelectedImages(post.images.map(img => ({ id: img.id, uri: img.url })));
        } else if (post.cdn_image_id) {
          // Fallback if images array is not present
          const imageUrls = post.cdn_image_id
            .split(",")
            .map((id) => ({ id: id, uri: `https://api.chuyenbienhoa.com/v1.0/cdn/${id}` }));
          setSelectedImages(imageUrls);
        }

        if (post.documents && post.documents.length > 0) {
          setSelectedDocuments(post.documents.map(doc => ({ 
            id: doc.id, 
            uri: doc.url, 
            name: doc.name || decodeURIComponent(doc.url.split('/').pop()).replace(/^\\d+_/, '') 
          })));
        }
      } catch (error) {
        console.log("Error fetching post:", error);
        Toast.show({
          type: "error",
          text1: t('editPost.errorLoadTitle'),
          text2: t('editPost.errorLoadDesc'),
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
        mediaTypes: ["images"],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        setSelectedImages((prev) => [
          ...prev,
          ...result.assets.map((asset) => ({ uri: asset.uri })),
        ]);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: t('editPost.errorImageTitle'),
        text2: t('editPost.errorImageDesc'),
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
        text1: t('createPost.pickDocumentError') || "Lỗi chọn tài liệu",
        text2: t('createPost.retry') || "Vui lòng thử lại",
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

  const handleUpdate = async () => {
    if (title.trim() === "" || postContent.trim() === "") {
      Toast.show({
        type: "error",
        text1: t('editPost.errorUpdateTitle'),
        text2: t('editPost.errorUpdateDesc'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      return;
    }

    try {
      setLoading(true);
      let newCdnIds = [];
      let newDocIds = [];

      // Kept IDs
      const keptImageIds = selectedImages.filter(img => img.id).map(img => img.id);
      const keptDocumentIds = selectedDocuments.filter(doc => doc.id).map(doc => doc.id);

      // Handle new images that need to be uploaded
      const newImages = selectedImages.filter(img => !img.id);
      for (const img of newImages) {
        const imageUri = img.uri;
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
        newCdnIds.push(uploadResponse.data.id);
      }

      // Handle new documents
      const newDocs = selectedDocuments.filter(doc => !doc.id);
      for (const dock of newDocs) {
        const formData = new FormData();

        formData.append("uid", userInfo.id);
        formData.append("file", {
          uri: dock.uri,
          name: dock.name,
          type: dock.mimeType || "application/octet-stream",
        });

        const uploadResponse = await uploadFile(formData);
        newDocIds.push(uploadResponse.data.id);
      }

      const response = await updatePost(route.params.postId, {
        title,
        description: postContent,
        cdn_image_id: newCdnIds.length > 0 ? newCdnIds.join(",") : null,
        cdn_document_id: newDocIds.length > 0 ? newDocIds.join(",") : null,
        kept_image_ids: keptImageIds,
        kept_document_ids: keptDocumentIds,
        subforum_id: selected?.value ?? null,
        visibility: viewSelected?.value === "private" ? 1 : 0, // Fallback if needed
        privacy: viewSelected?.value,
        anonymous: isAnonymous,
      });

      if (viewSelected?.value === "public") {
        setFeed((prevPosts) =>
          prevPosts.map((post) =>
            post.id === route.params.postId ? { ...response.data, is_mine: true, is_author: true, author: { ...userInfo, ...response.data?.author }, anonymous: response.data?.anonymous ?? isAnonymous } : post
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
        text1: t('editPost.errorUpdateTitle'),
        text2: error?.response?.data?.message || t('editPost.errorLoadDesc'),
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
      
      <ProgressHUD loadText={t('editPost.updating')} visible={loading} />
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
          {t('editPost.title')}
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
            {t('editPost.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
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
              {isAnonymous ? t('createPost.anonymousUser') : profileName}
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
              options={viewOptions}
              placeholder={viewOptions[0].label}
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
                  name={viewSelected?.icon || "earth"}
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
            placeholder={t('editPost.placeholderTitle')}
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
            placeholder={t('editPost.placeholderContent')}
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
              <Text style={{ fontWeight: 'bold', fontSize: 15, color: theme.text, marginBottom: 5 }}>{t('createPost.anonymous') || "Ẩn danh"}</Text>
              <Text style={{ color: theme.subText, fontSize: 12 }}>{t('createPost.anonymousDesc') || "Đăng bài ẩn danh"}</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor={isAnonymous ? '#f4f3f4' : '#f4f3f4'}
              onValueChange={() => {}}
              value={isAnonymous}
              disabled={true}
            />
          </View>
        </View>
        <View style={{ marginTop: 10, marginHorizontal: 16 }}>
          <Dropdown
            options={subforums}
            placeholder={t('editPost.placeholderCategory')}
            selectedValue={selected}
            onValueChange={setSelected}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => navigateToHelp(213057)}
              style={{ flexDirection: 'row', alignItems: 'center', height: 40, gap: 8, borderWidth: 1.3, borderColor: theme.primary, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12 }}
            >
              <Ionicons name="logo-markdown" size={15} color={theme.text} />
              <Text style={{ color: theme.text }}>{t('editPost.markdown')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateToHelp(213054)}
              style={{ flexDirection: 'row', alignItems: 'center', height: 40, justifyContent: 'center', gap: 4, borderWidth: 1.3, borderColor: theme.primary, borderRadius: 12, paddingHorizontal: 12 }}
            >
              <Ionicons name="warning" size={18} color={theme.text} />
              <Text style={{ color: theme.text }}>{t('editPost.rules')}</Text>
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
                  selectedImages.map((img, index) => {
                    return (
                      <View
                        key={`image-${index}-${img.uri}`}
                        style={{ marginTop: 7, marginRight: 7, position: 'relative' }}
                      >
                        <Image
                          source={{ uri: img.uri }}
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
                  <Text style={{ color: theme.primary }}>{t('editPost.addImage')}</Text>
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
                <Text style={{ color: theme.primary, marginTop: 4 }}>{t('editPost.addImage') || t('createPost.addImage') || "Thêm ảnh"}</Text>
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
                <Text style={{ color: theme.primary, marginTop: 4 }}>{t('createPost.addDocument') || "Thêm tài liệu"}</Text>
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
