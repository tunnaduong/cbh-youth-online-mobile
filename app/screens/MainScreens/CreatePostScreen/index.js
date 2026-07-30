import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Dropdown from "../../../components/Dropdown";
import { getCategoryName } from "../../../utils/forumUtils";
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
import FastImage from "../../../components/FastImage";
import VideoThumbnail from "../../../components/VideoThumbnail";
import { CommonActions } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import { LinearGradient } from "expo-linear-gradient";
import LiquidButton from "../../../components/LiquidButton";
import {
  getVideoExtension,
  getVideoMimeType,
  validateVideoAsset,
} from "../../../utils/videoUpload";

// Large video uploads (up to 100MB) need more headroom than the axios
// instance's default 10s timeout.
const VIDEO_UPLOAD_TIMEOUT = 300000;

const CreatePostScreen = ({ navigation }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
  const insets = useSafeAreaInsets();
  const { username, userInfo, profileName } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 140],
    outputRange: [0, -12],
    extrapolate: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 120, 180],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 24, 48],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });
  const headerButtonOpacity = Platform.OS === "android" ? 1 : headerOpacity;

  useStatusBarStyle(
    isDarkMode ? "light-content" : "dark-content",
    Platform.OS === "android" ? "transparent" : theme.background,
  );
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const view = [
    { label: t("createPost.privacyPublic"), value: "public", icon: "earth" },
    {
      label: t("createPost.privacyFollowers"),
      value: "followers",
      icon: "people",
    },
    {
      label: t("createPost.privacyPrivate"),
      value: "private",
      icon: "lock-closed",
    },
  ];
  const [viewSelected, setViewSelected] = useState(view[0]);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState(null);

  useEffect(() => {
    if (isAnonymous && viewSelected.value === "followers") {
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
    const loadSubforums = async () => {
      try {
        const res = await getSubforums();
        const d = res.data;
        const rawSubforums = Array.isArray(d)
          ? d
          : Array.isArray(d?.data)
            ? d.data
            : [];
        const translated = rawSubforums.map((item) => {
          const id = item.value ?? item.id;
          const name = item.label || item.name || item.title || "";
          return { ...item, value: id, label: getCategoryName(name, t) };
        });
        setSubforums(translated);
      } catch (error) {
        console.log("Error loading subforums:", error);
      }
    };
    loadSubforums();
  }, [t]);

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
          ...result.assets.map((asset) => asset.uri),
        ]);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Toast.show({
        type: "error",
        text1: t("createPost.pickImageError"),
        text2: t("createPost.retry"),
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
        text1: t("createPost.pickDocumentError"),
        text2: t("createPost.retry"),
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const pickVideo = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: true,
      });

      if (result.canceled || !result.assets) return;

      const accepted = [];
      let hadTypeRejection = false;
      let hadSizeRejection = false;

      for (const asset of result.assets) {
        const validation = await validateVideoAsset(asset);
        if (!validation.ok) {
          if (validation.reason === "type") hadTypeRejection = true;
          if (validation.reason === "size") hadSizeRejection = true;
          continue;
        }
        accepted.push({
          uri: asset.uri,
          fileName: asset.fileName || `video_${Date.now()}.${validation.extension}`,
          mimeType: asset.mimeType || getVideoMimeType(validation.extension),
          fileSize: validation.size,
        });
      }

      if (hadTypeRejection) {
        Toast.show({
          type: "error",
          text1: t("createPost.pickVideoError"),
          text2: t("createPost.videoTypeUnsupported"),
          autoHide: true,
          visibilityTime: 4000,
          topOffset: 60,
        });
      }
      if (hadSizeRejection) {
        Toast.show({
          type: "error",
          text1: t("createPost.pickVideoError"),
          text2: t("createPost.videoTooLarge"),
          autoHide: true,
          visibilityTime: 4000,
          topOffset: 60,
        });
      }

      if (accepted.length > 0) {
        setSelectedVideos((prev) => [...prev, ...accepted]);
      }
    } catch (error) {
      console.log("Error picking video:", error);
      Toast.show({
        type: "error",
        text1: t("createPost.pickVideoError"),
        text2: t("createPost.retry"),
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const removeVideo = (indexToRemove) => {
    setSelectedVideos((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const removeImage = (indexToRemove) => {
    setSelectedImages((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const removeDocument = (indexToRemove) => {
    setSelectedDocuments((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const handlePost = async () => {
    if (title.trim() === "" || postContent.trim() === "") {
      Toast.show({
        type: "error",
        text1: t("createPost.cannotPost"),
        text2: t("createPost.missingFields"),
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

      let videoIds = [];
      if (selectedVideos.length > 0) {
        // Upload all videos - same two-step (upload -> cdn id) pattern as
        // images/documents above, just with a longer timeout and progress
        // tracking given videos can be up to 100MB.
        for (let i = 0; i < selectedVideos.length; i++) {
          const video = selectedVideos[i];
          const formData = new FormData();
          const extension = getVideoExtension(video.fileName || video.uri) || "mp4";

          formData.append("uid", userInfo.id);
          formData.append("file", {
            uri: video.uri,
            name: video.fileName || `video.${extension}`,
            type: video.mimeType || getVideoMimeType(extension),
          });

          setUploadProgressText(
            t("createPost.uploadingVideo", {
              current: i + 1,
              total: selectedVideos.length,
            }),
          );
          setUploadProgress(0);

          const uploadResponse = await uploadFile(formData, {
            timeout: VIDEO_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              const fileProgress = progressEvent.loaded / progressEvent.total;
              setUploadProgress(
                ((i + fileProgress) / selectedVideos.length) * 100,
              );
            },
          });
          videoIds.push(uploadResponse.data.id);
        }
      }

      setUploadProgress(null);
      setUploadProgressText(null);

      const response = await createPost({
        title,
        description: postContent,
        cdn_image_id: cdnIds.length > 0 ? cdnIds.join(",") : null,
        cdn_document_id: docIds.length > 0 ? docIds.join(",") : null,
        cdn_video_id: videoIds.length > 0 ? videoIds.join(",") : null,
        subforum_id: selected?.value ?? null,
        visibility: 0,
        privacy: viewSelected.value,
        anonymous: isAnonymous,
      });

      if (viewSelected.value === "public") {
        setFeed((prevPosts) => [
          {
            ...response.data,
            is_mine: true,
            is_author: true,
            author: { ...userInfo, ...response.data?.author },
            anonymous: response.data?.anonymous ?? isAnonymous,
          },
          ...prevPosts,
        ]);
      }

      // Use a more defensive approach to navigation
      if (navigation) {
        try {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "MainScreens" }],
            }),
          );
        } catch (navError) {
          // If reset fails, try simple navigation
          navigation.navigate("MainScreens");
        }
      } else {
        // If navigation is not available, at least update the feed
        Toast.show({
          type: "success",
          text1: t("createPost.postedSuccess"),
          text2: t("createPost.reloading"),
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
        text1: t("createPost.cannotPost"),
        text2: error?.response?.data?.message || t("createPost.tryAgainLater"),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setLoading(false);
      setUploadProgress(null);
      setUploadProgressText(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ProgressHUD
        loadText={uploadProgressText || t("createPost.posting")}
        visible={loading}
        progress={uploadProgress}
      />

      <Animated.View
        style={[
          styles.topBar,
          {
            // iOS: this screen is presented via presentation:"modal", which
            // renders as a floating card (not full-bleed like Android), so
            // it already clears the notch/status bar on its own — adding
            // the full device insets.top on top of that double-counts the
            // offset and pushes content too far down.
            paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8,
            height: Platform.OS === "ios" ? 68 : insets.top + 52,
            backgroundColor: "transparent",
            opacity: Platform.OS === "android" ? 1 : headerOpacity,
            transform: Platform.OS === "android" ? undefined : [{ translateY: headerTranslateY }],
            shadowOpacity: 0,
            elevation: 0,
            borderBottomWidth: 0,
            position: "absolute",
          },
        ]}
        pointerEvents="box-none"
      >
        {/* No full-bar glass panel here: each LiquidButton below already
            renders its own real glass pill (providerId="CreatePostScreen"),
            and stacking a second bar-wide glass sample behind them produced
            a visible double-refraction artifact (a blotchy discolored patch
            reaching up toward the status bar). One glass layer per element. */}
        <Animated.View style={{ opacity: headerButtonOpacity }}>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            onPress={() => navigation.goBack()}
            roundedOnScroll
            providerId="CreatePostScreen"
            style={Platform.OS === "android" ? { borderRadius: 22 } : undefined}
          >
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
        </Animated.View>
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.topTitle,
            {
              flex: 1,
              opacity: headerTitleOpacity,
              color: theme.text,
              textAlign: "center",
            },
          ]}
        >
          {t("createPost.title")}
        </Animated.Text>
        <Animated.View style={{ opacity: headerButtonOpacity }}>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            onPress={handlePost}
            roundedOnScroll
            providerId="CreatePostScreen"
            style={styles.publishButton}
          >
            <Text style={[styles.publishButtonText, { color: theme.primary }]}>
              {t("createPost.publish")}
            </Text>
          </LiquidButton>
        </Animated.View>
      </Animated.View>

      <AndroidGlassBackdrop providerId="CreatePostScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{
          paddingTop: Platform.OS === "ios" ? 68 : insets.top + 52,
          paddingBottom: insets.bottom + 24,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={isDarkMode ? ["#173C2B", "#0F261D"] : ["#2BAA5C", "#1A874A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t("createPost.title")}</Text>
            <Text style={styles.heroSubtitle}>
              {t("createPost.placeholderContent")}
            </Text>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.card,
            {
              backgroundColor: isDarkMode
                ? theme.cardBackground
                : "rgba(255,255,255,0.96)",
              borderColor: isDarkMode ? theme.border : "rgba(15,23,42,0.08)",
              shadowColor: "#0F172A",
              shadowOpacity: isDarkMode ? 0.24 : 0.16,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 12 },
              elevation: 6,
            },
            isDarkMode && { elevation: 0, shadowOpacity: 0 },
          ]}
        >
          <View style={styles.profileRow}>
            {isAnonymous ? (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: isDarkMode ? "#1f2937" : "#e9f1e9" },
                ]}
              >
                <Text
                  style={{
                    color: theme.text,
                    fontWeight: "bold",
                    fontSize: 32,
                  }}
                >
                  ?
                </Text>
              </View>
            ) : (
              <FastImage
                source={{
                  uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
                }}
                style={[
                  styles.avatarImage,
                  { borderColor: isDarkMode ? theme.border : "#D1D5DB" },
                ]}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.profileName, { color: theme.text }]}
                numberOfLines={1}
              >
                {isAnonymous ? t("createPost.anonymousUser") : profileName}
                {userInfo.verified && !isAnonymous && (
                  <Verified
                    width={18}
                    height={18}
                    color={theme.primary}
                    style={{ marginBottom: -4, marginLeft: 4 }}
                  />
                )}
              </Text>
              <Dropdown
                options={
                  isAnonymous
                    ? view.filter((item) => item.value !== "followers")
                    : view
                }
                placeholder={t("createPost.privacyPublic")}
                selectedValue={viewSelected}
                onValueChange={setViewSelected}
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: isDarkMode
                      ? theme.surface
                      : "rgba(255,255,255,0.72)",
                  },
                ]}
                leftIcon={
                  <Ionicons
                    name={viewSelected?.icon || "earth"}
                    size={15}
                    color={theme.subText}
                  />
                }
                textStyle={{ fontSize: 12, color: theme.subText }}
                arrowSize={15}
              />
            </View>
          </View>

          <View
            style={[
              styles.inputGroup,
              {
                backgroundColor: isDarkMode
                  ? theme.surface
                  : "rgba(248,250,252,0.98)",
                borderWidth: 1,
                borderColor: isDarkMode ? theme.border : "rgba(15,23,42,0.05)",
              },
            ]}
          >
            <TextInput
              style={[styles.titleInput, { color: theme.text }]}
              placeholder={t("createPost.placeholderTitle")}
              placeholderTextColor={theme.subText}
              value={title}
              onChangeText={setTitle}
            />
            <View style={[styles.divider, { borderColor: theme.border }]} />
            <TextInput
              style={[styles.contentInput, { color: theme.text }]}
              placeholder={t("createPost.placeholderContent")}
              placeholderTextColor={theme.subText}
              value={postContent}
              onChangeText={setPostContent}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View
            style={[
              styles.toggleCard,
              {
                backgroundColor: isDarkMode
                  ? theme.surface
                  : "rgba(248,250,252,0.98)",
                borderWidth: 1,
                borderColor: isDarkMode ? theme.border : "rgba(15,23,42,0.05)",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>
                {t("createPost.anonymous")}
              </Text>
              <Text style={[styles.toggleText, { color: theme.subText }]}>
                {t("createPost.anonymousDesc")}
              </Text>
            </View>
            <Switch
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              onValueChange={() => setIsAnonymous(!isAnonymous)}
              value={isAnonymous}
            />
          </View>

          <Dropdown
            options={subforums}
            placeholder={t("createPost.placeholderCategory")}
            selectedValue={selected}
            onValueChange={setSelected}
            style={[
              styles.categoryDropdown,
              {
                backgroundColor: isDarkMode ? theme.surface : "#FFFFFF",
                borderColor: isDarkMode ? theme.border : "#E5E7EB",
              },
            ]}
          />

          <View style={styles.inlineButtons}>
            <TouchableOpacity
              onPress={() => navigateToHelp(865586194)}
              style={[
                styles.inlineButton,
                {
                  borderColor: theme.border,
                  backgroundColor: isDarkMode
                    ? theme.surface
                    : "rgba(255,255,255,0.86)",
                },
              ]}
            >
              <Ionicons name="logo-markdown" size={15} color={theme.primary} />
              <Text style={[styles.inlineButtonText, { color: theme.text }]}>
                {t("createPost.markdown")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateToHelp(173336279)}
              style={[
                styles.inlineButton,
                {
                  borderColor: theme.border,
                  backgroundColor: isDarkMode
                    ? theme.surface
                    : "rgba(255,255,255,0.96)",
                },
              ]}
            >
              <Ionicons name="warning" size={16} color={theme.primary} />
              <Text style={[styles.inlineButtonText, { color: theme.text }]}>
                {t("createPost.rules")}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedDocuments.length > 0 && (
            <View style={styles.fileList}>
              {selectedDocuments.map((doc, index) => (
                <View
                  key={index}
                  style={[
                    styles.fileItem,
                    {
                      backgroundColor: isDarkMode
                        ? theme.surface
                        : "rgba(255,255,255,0.86)",
                    },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={theme.primary}
                  />
                  <Text
                    style={[styles.fileName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {doc.name}
                  </Text>
                  <TouchableOpacity onPress={() => removeDocument(index)}>
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={theme.subText}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {selectedImages.length > 0 || selectedVideos.length > 0 ? (
            // Photos and videos share one media row/section (rather than a
            // separate video section) so attaching either feels like the
            // same action.
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaRow}
            >
              {selectedImages.map((uri, index) => (
                <View key={`image-${index}-${uri}`} style={styles.mediaThumb}>
                  <FastImage
                    source={{ uri }}
                    style={[
                      styles.mediaImage,
                      { borderColor: isDarkMode ? theme.border : "#E5E7EB" },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {selectedVideos.map((video, index) => (
                <VideoThumbnail
                  key={`video-${index}-${video.uri}`}
                  uri={video.uri}
                  width={130}
                  height={130}
                  style={styles.mediaThumb}
                  onRemove={() => removeVideo(index)}
                />
              ))}
              <TouchableOpacity onPress={pickImage} style={styles.mediaAddTile}>
                <Ionicons name="image-outline" size={30} color={theme.primary} />
                <Text style={[styles.mediaAddText, { color: theme.primary }]}>
                  {t("createPost.addImage")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickVideo} style={styles.mediaAddTile}>
                <Ionicons name="videocam-outline" size={30} color={theme.primary} />
                <Text style={[styles.mediaAddText, { color: theme.primary }]}>
                  {t("createPost.addVideo")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.mediaPickerRow}>
              <TouchableOpacity
                onPress={pickImage}
                style={[
                  styles.mediaPickerTile,
                  {
                    backgroundColor: isDarkMode
                      ? theme.surface
                      : "rgba(255,255,255,0.98)",
                    borderWidth: 1,
                    borderColor: isDarkMode ? theme.border : "#D1D5DB",
                  },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={28}
                  color={theme.primary}
                />
                <Text
                  style={[styles.mediaPickerText, { color: theme.primary }]}
                >
                  {t("createPost.addImage")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickVideo}
                style={[
                  styles.mediaPickerTile,
                  {
                    backgroundColor: isDarkMode
                      ? theme.surface
                      : "rgba(255,255,255,0.98)",
                    borderWidth: 1,
                    borderColor: isDarkMode ? theme.border : "#D1D5DB",
                  },
                ]}
              >
                <Ionicons
                  name="videocam-outline"
                  size={28}
                  color={theme.primary}
                />
                <Text
                  style={[styles.mediaPickerText, { color: theme.primary }]}
                >
                  {t("createPost.addVideo")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickDocument}
                style={[
                  styles.mediaPickerTile,
                  {
                    backgroundColor: isDarkMode
                      ? theme.surface
                      : "rgba(255,255,255,0.98)",
                    borderWidth: 1,
                    borderColor: isDarkMode ? theme.border : "#D1D5DB",
                  },
                ]}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={28}
                  color={theme.primary}
                />
                <Text
                  style={[styles.mediaPickerText, { color: theme.primary }]}
                >
                  {t("createPost.addDocument")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
  },
  topTitle: { fontSize: 16, fontWeight: "700" },
  publishButton: { paddingHorizontal: 14, minWidth: 84, borderRadius: 22 },
  publishButtonText: { fontWeight: "700", fontSize: 14 },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  heroSubtitle: { color: "rgba(255,255,255,0.84)", fontSize: 13, marginTop: 4 },
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  profileName: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  dropdown: {
    borderWidth: 0,
    backgroundColor: "rgba(255,255,255,0.72)",
    padding: 6,
    borderRadius: 10,
    gap: 3,
    alignSelf: "flex-start",
  },
  inputGroup: { borderRadius: 18, padding: 8 },
  titleInput: {
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "700",
  },
  divider: { height: 1, marginHorizontal: 8, marginVertical: 6 },
  contentInput: {
    minHeight: 180,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 15,
    lineHeight: 22,
  },
  toggleCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleTitle: { fontWeight: "700", fontSize: 14, marginBottom: 2 },
  toggleText: { fontSize: 12, lineHeight: 17 },
  categoryDropdown: {
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inlineButtons: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  inlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineButtonText: { fontSize: 13, fontWeight: "600" },
  fileList: { gap: 8 },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  fileName: { flex: 1, fontSize: 13 },
  mediaRow: { paddingTop: 8, paddingBottom: 4, gap: 8 },
  mediaThumb: { position: "relative", marginRight: 8 },
  mediaImage: {
    width: 130,
    height: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    padding: 6,
  },
  mediaAddTile: {
    width: 130,
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    borderStyle: "dashed",
  },
  mediaAddText: { marginTop: 4, fontSize: 12, fontWeight: "700" },
  mediaPickerRow: { flexDirection: "row", gap: 10 },
  mediaPickerTile: {
    flex: 1,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 12,
  },
  mediaPickerText: { marginTop: 6, fontSize: 13, fontWeight: "700" },
});

export default CreatePostScreen;
