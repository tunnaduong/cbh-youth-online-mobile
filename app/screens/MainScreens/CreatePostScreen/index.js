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
  Keyboard,
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
import { WebView } from "react-native-webview";
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
import { extractYouTubeId, buildYouTubePlayerHtml, autoEmbedYouTubeLinks } from "../../../utils/youtubeShare";
import { autoEmbedSoundCloudLinks } from "../../../utils/soundcloudShare";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import MentionSuggestions, { useMentionInput } from "../../../components/MentionSuggestions";
import { getMentionSuggestions } from "../../../services/api/Api";

// Bolds @mentions live while composing, but they're not clickable here -
// only rendered posts (with backend-resolved mentions) link to a profile.
// Posts don't support "@all" broadcast mentions (that's a comment/chat-only
// feature), so unlike CommentBar's parser this one never special-cases it.
function postMentionParser(input) {
  "worklet";
  try {
    const ranges = [];
    const regex = /@[\p{L}\p{N}\p{M}_.-]+/gu;
    let match;
    while ((match = regex.exec(input)) !== null) {
      ranges.push({ start: match.index, length: match[0].length, type: "mention-user" });
    }
    return ranges;
  } catch (e) {
    return [];
  }
}

// Large video uploads (up to 100MB) need more headroom than the axios
// instance's default 10s timeout.
const VIDEO_UPLOAD_TIMEOUT = 300000;

const CreatePostScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState(route?.params?.initialContent ?? "");
  const [title, setTitle] = useState(route?.params?.initialTitle ?? "");
  const {
    mentionProps: contentMentionProps,
    suggestions: contentSuggestions,
    loading: contentSuggestionsLoading,
    onSelectMention: onSelectContentMention,
    hasSuggestions: hasContentSuggestions,
  } = useMentionInput({
    value: postContent,
    onChange: setPostContent,
    fetchSuggestions: getMentionSuggestions,
  });
  const insets = useSafeAreaInsets();
  // The mention-suggestions overlay is anchored to the bottom of the
  // screen; without tracking the keyboard it stayed pinned to the safe-area
  // bottom, which the on-screen keyboard covers as soon as the content
  // input is focused (exactly when suggestions are shown) - hidden behind it.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
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
  // Header title is visible at rest and hides as the user scrolls down into
  // the compose area, giving a cleaner distraction-free writing view.
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
        // Auto-wraps a bare youtube.com/youtu.be link typed into the post
        // in the same <iframe> PostItem already knows how to render, so
        // users don't have to write the embed markup by hand.
        description: autoEmbedSoundCloudLinks(autoEmbedYouTubeLinks(postContent)),
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
            // Was assuming iOS's presentation:"modal" self-clears the notch
            // as a floating card, so it used a flat 6px regardless of the
            // device's actual safe area - but that doesn't hold up (e.g. an
            // active call/recording banner grows the real top inset and the
            // header rendered full-bleed under it, cramped against the
            // status bar). Use the real inset on both platforms instead.
            // Height must give the 44px back/publish buttons enough room
            // (paddingTop + 44) or they overflow the bar's declared height,
            // stretching it taller than intended - a prior height reduction
            // shrank this below 44px and caused exactly that.
            paddingTop: insets.top + 2,
            height: insets.top + 46,
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
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: headerTitleOpacity,
          }}
        >
          <Text style={[styles.topTitle, { color: theme.text }]}>
            {t("createPost.title")}
          </Text>
        </Animated.View>
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
          paddingTop: insets.top + 46,
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
            <MarkdownTextInput
              style={[styles.contentInput, { color: theme.text }]}
              parser={postMentionParser}
              markdownStyle={{
                // The library's mentionUser default also sets a cyan
                // backgroundColor + borderRadius (a solid highlighted chip) -
                // override both so a mention is just colored/bold text, not
                // dropped in a background box.
                mentionUser: { color: "#22c55e", fontWeight: "600", backgroundColor: "transparent", borderRadius: 0 },
              }}
              placeholder={t("createPost.placeholderContent")}
              placeholderTextColor={theme.subText}
              value={postContent}
              onChangeText={contentMentionProps.onChangeText}
              multiline
              textAlignVertical="top"
            />
            {/* YouTube embed preview — shown when content contains an iframe with a YouTube src */}
            {(() => {
              const ytId = extractYouTubeId(postContent);
              if (!ytId) return null;
              return (
                <View style={{
                  marginTop: 12,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: "#000",
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, backgroundColor: isDarkMode ? "#1a1a1a" : "#f5f5f5" }}>
                    <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                    <Text style={{ marginLeft: 6, fontSize: 12, color: theme.text, fontWeight: "600" }}>
                      YouTube Embed
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPostContent("")}
                      style={{ marginLeft: "auto" }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color={theme.subText} />
                    </TouchableOpacity>
                  </View>
                  <WebView
                    source={{ html: buildYouTubePlayerHtml(ytId), baseUrl: "https://www.youtube-nocookie.com" }}
                    style={{ width: "100%", height: 200 }}
                    allowsFullscreenVideo
                    javaScriptEnabled
                    domStorageEnabled
                  />
                </View>
              );
            })()}
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

      {/* Rendered outside the ScrollView - a FlatList (inside MentionSuggestions)
          nested in a ScrollView of the same orientation doesn't get a usable
          height and never shows anything, only warns. */}
      {hasContentSuggestions && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: (keyboardHeight || insets.bottom) + 16,
            zIndex: 50,
            elevation: 50,
          }}
          pointerEvents="box-none"
        >
          <MentionSuggestions
            suggestions={contentSuggestions}
            loading={contentSuggestionsLoading}
            onSelect={onSelectContentMention}
          />
        </View>
      )}
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
