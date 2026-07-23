import React, { useContext, useEffect, useRef, useState } from "react";
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
  Animated,
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
import LiquidButton from "../../../components/LiquidButton";

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
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = 64 + insets.top;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

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

        const [postRes, subforumsRes] = await Promise.all([
          getPostDetail(route.params.postId),
          getSubforums(),
        ]);

        // Handle both array-direct and data-wrapped responses
        const d = subforumsRes.data;
        const rawSubforums = Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);

        const translatedSubforums = rawSubforums.map(item => {
          const id = item.value ?? item.id;
          const name = item.label || item.name || item.title || "";
          return {
            ...item,
            value: id,
            label: getCategoryName(name, t),
          };
        });
        setSubforums(translatedSubforums);

        // ── Post data ─────────────────────────────────────────────────────────
        const post = postRes.data?.post ?? postRes.data;
        setInitialPost(post);

        setTitle(post.title || "");
        setPostContent(post.description || post.content || "");
        setIsAnonymous(!!post.anonymous);

        const initialPrivacy = post.privacy || (post.visibility === 1 ? "private" : "public");
        const matchingOption = viewOptions.find(v => v.value === initialPrivacy) || viewOptions[0];
        setViewSelected(matchingOption);

        // ── Category pre-selection ────────────────────────────────────────────
        const subforumId =
          post.subforum_id ??
          post.subforum?.id ??
          post.category_id ??
          post.category?.id ??
          null;

        if (subforumId !== null && subforumId !== undefined) {
          let matched = translatedSubforums.find(
            (s) => String(s.value) === String(subforumId)
          );

          // The v1.0 subforum list is role-filtered, so the post's current subforum
          // might not be in the list. If missing, synthesize an entry from post.subforum
          // so the dropdown always shows the correct pre-selected category.
          if (!matched && (post.subforum || post.category)) {
            const sf = post.subforum || post.category;
            const syntheticLabel = getCategoryName(
              sf.name || sf.title || String(subforumId),
              t
            );
            matched = {
              value: subforumId,
              label: syntheticLabel,
              category: sf.category?.name || sf.parent?.name || '',
            };
            // Prepend so it's visible at the top of the dropdown
            setSubforums(prev => {
              const alreadyIn = prev.some(s => String(s.value) === String(subforumId));
              return alreadyIn ? prev : [matched, ...prev];
            });
          }

          if (matched) setSelected(matched);
        }

        if (post.images && post.images.length > 0) {
          setSelectedImages(post.images.map(img => ({ id: img.id, uri: img.url })));
        } else if (post.cdn_image_id) {
          const imageUrls = post.cdn_image_id
            .split(",")
            .map((id) => ({ id: id, uri: `https://api.chuyenbienhoa.com/v1.0/cdn/${id}` }));
          setSelectedImages(imageUrls);
        }

        if (post.documents && post.documents.length > 0) {
          setSelectedDocuments(post.documents.map(doc => ({
            id: doc.id,
            uri: doc.url,
            name: doc.name || decodeURIComponent(doc.url.split('/').pop()).replace(/^\d+_/, '')
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

      // Get existing CDN IDs from kept IDs or fallback to parsing from URLs
      const urlImageIds = selectedImages
        .filter((img) => !img.id && img.uri && img.uri.includes("api.chuyenbienhoa.com"))
        .map((img) => img.uri.split("/").pop());
      const allCdnIds = [...new Set([...keptImageIds, ...urlImageIds, ...newCdnIds])];

      const urlDocIds = selectedDocuments
        .filter((doc) => !doc.id && doc.uri && doc.uri.includes("api.chuyenbienhoa.com"))
        .map((doc) => doc.uri.split("/").pop());
      const allDocIds = [...new Set([...keptDocumentIds, ...urlDocIds, ...newDocIds])];

      const response = await updatePost(route.params.postId, {
        title,
        description: postContent,
        kept_image_ids: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
        cdn_image_id: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
        kept_document_ids: allDocIds.length > 0 ? allDocIds.join(",") : null,
        cdn_document_id: allDocIds.length > 0 ? allDocIds.join(",") : null,
        subforum_id: selected?.value ?? null,
        visibility: viewSelected?.value === "private" ? 1 : 0, // Fallback if needed
        privacy: viewSelected?.value,
        anonymous: isAnonymous,
      });

      const updatedPostData = response.data?.post || response.data;
      setFeed((prevPosts) =>
        prevPosts.map((post) =>
          post.id === route.params.postId ? { ...post, ...updatedPostData, is_mine: true, is_author: true, author: { ...post.author, ...userInfo, ...updatedPostData?.author }, anonymous: updatedPostData?.anonymous ?? isAnonymous } : post
        )
      );

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

      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.floatingHeader}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: headerHeight }}>
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: theme.primary,
              flex: 1,
              textAlign: "center",
              opacity: headerTitleOpacity,
            }}
            numberOfLines={1}
          >
            {t('editPost.title')}
          </Animated.Text>
          <LiquidButton
            scrollY={scrollY}
            alwaysBorder
            size={44}
            style={{ width: "auto", paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: theme.primary, backgroundColor: "transparent" }}
            borderRadius={22}
            onPress={handleUpdate}
          >
            <Text style={{ color: theme.text, fontWeight: "600" }} numberOfLines={1}>
              {t('editPost.save')}
            </Text>
          </LiquidButton>
        </View>
      </View>

      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 16 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
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
          {isAnonymous ? (
            <View style={{ width: 70, height: 70, backgroundColor: theme.iconBackground, borderRadius: 35, alignItems: 'center', justifyContent: 'center', borderColor: theme.border, borderWidth: 1 }}>
              <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 36 }}>?</Text>
            </View>
          ) : (
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
                backgroundColor: theme.iconBackground,
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
        <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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

        </View>
        <View style={{ marginTop: 10, marginHorizontal: 16 }}>
          {/* Category selector hidden — re-enable when backend supports subforum pre-selection
          <Dropdown
            options={subforums}
            placeholder={t('editPost.placeholderCategory')}
            selectedValue={selected}
            onValueChange={setSelected}
          />
          */}
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
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
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
