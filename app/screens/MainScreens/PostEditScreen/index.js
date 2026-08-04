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
import VideoThumbnail from "../../../components/VideoThumbnail";
import { CommonActions } from "@react-navigation/native";
import { autoEmbedYouTubeLinks, extractYouTubeId, buildYouTubePlayerHtml } from "../../../utils/youtubeShare";
import { WebView } from "react-native-webview";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import MentionSuggestions, { useMentionInput } from "../../../components/MentionSuggestions";
import { getMentionSuggestions } from "../../../services/api/Api";

// Bolds @mentions live while composing, but they're not clickable here -
// only rendered posts (with backend-resolved mentions) link to a profile.
// Posts don't support "@all" broadcast mentions (that's a comment/chat-only
// feature), so unlike CommentBar's parser this one never special-cases it.
function postMentionParser(input) {
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
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import LiquidButton from "../../../components/LiquidButton";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import {
  getVideoExtension,
  getVideoMimeType,
  validateVideoAsset,
} from "../../../utils/videoUpload";

// Large video uploads (up to 100MB) need more headroom than the axios
// instance's default 10s timeout.
const VIDEO_UPLOAD_TIMEOUT = 300000;

const PostEditScreen = ({ navigation, route }) => {
  const [postContent, setPostContent] = useState("");
  const [title, setTitle] = useState("");
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
  const { username, userInfo, profileName } = useContext(AuthContext);
  if (!userInfo) {
    return null;
  }
  const { theme, isDarkMode } = useTheme();
  useStatusBarStyle(
    isDarkMode ? "light-content" : "dark-content",
    Platform.OS === "android" ? "transparent" : theme.background,
  );
  const { setFeed } = useContext(FeedContext);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const { t } = useTranslation();
  const scrollY = useRef(new Animated.Value(0)).current;
  // iOS: presentation:"modal" renders as a floating card (not full-bleed
  // like Android), which already clears the notch/status bar on its own —
  // adding the full device insets.top double-counts the offset.
  const headerHeight = Platform.OS === "ios" ? 68 : insets.top + 52;
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

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [viewSelected, setViewSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState(null);
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

        if (post.videos && post.videos.length > 0) {
          setSelectedVideos(post.videos.map(video => ({ id: video.id, uri: video.url })));
        } else if (post.video_urls && post.video_urls.length > 0) {
          setSelectedVideos(post.video_urls.map((url) => ({ uri: url })));
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
          text1: t('editPost.errorVideoTitle') || t('createPost.pickVideoError'),
          text2: t('editPost.videoTypeUnsupported') || t('createPost.videoTypeUnsupported'),
          autoHide: true,
          visibilityTime: 4000,
          topOffset: 60,
        });
      }
      if (hadSizeRejection) {
        Toast.show({
          type: "error",
          text1: t('editPost.errorVideoTitle') || t('createPost.pickVideoError'),
          text2: t('editPost.videoTooLarge') || t('createPost.videoTooLarge'),
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
        text1: t('editPost.errorVideoTitle') || t('createPost.pickVideoError'),
        text2: t('editPost.errorVideoDesc') || t('createPost.retry'),
        autoHide: true,
        visibilityTime: 3000,
        topOffset: 60,
      });
    }
  };

  const removeVideo = (indexToRemove) => {
    setSelectedVideos((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
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
      const newImages = selectedImages.filter((img) => !img.id && img.uri);
      for (const img of newImages) {
        const imageUri = img.uri;
        const formData = new FormData();
        const fileExtension = imageUri?.split(".").pop() || "jpg";
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
      const newDocs = selectedDocuments.filter((doc) => !doc.id && doc.uri);
      for (const dock of newDocs) {
        const formData = new FormData();

        formData.append("uid", userInfo.id);
        formData.append("file", {
          uri: dock.uri,
          name: dock.name || `document.${dock.uri?.split(".").pop() || "bin"}`,
          type: dock.mimeType || "application/octet-stream",
        });

        const uploadResponse = await uploadFile(formData);
        newDocIds.push(uploadResponse.data.id);
      }

      // Handle new videos - same upload/kept-id pattern as images/documents
      // above, just with a longer timeout and progress tracking given
      // videos can be up to 100MB.
      let newVideoIds = [];
      const keptVideoIds = selectedVideos.filter((video) => video.id).map((video) => video.id);
      const newVideos = selectedVideos.filter((video) => !video.id && video.uri);
      for (let i = 0; i < newVideos.length; i++) {
        const video = newVideos[i];
        const formData = new FormData();
        const extension = getVideoExtension(video.fileName || video.uri) || "mp4";

        formData.append("uid", userInfo.id);
        formData.append("file", {
          uri: video.uri,
          name: video.fileName || `video.${extension}`,
          type: video.mimeType || getVideoMimeType(extension),
        });

        setUploadProgressText(
          t('editPost.uploadingVideo', { current: i + 1, total: newVideos.length }) ||
            t('createPost.uploadingVideo', { current: i + 1, total: newVideos.length }),
        );
        setUploadProgress(0);

        const uploadResponse = await uploadFile(formData, {
          timeout: VIDEO_UPLOAD_TIMEOUT,
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            const fileProgress = progressEvent.loaded / progressEvent.total;
            setUploadProgress(((i + fileProgress) / newVideos.length) * 100);
          },
        });
        newVideoIds.push(uploadResponse.data.id);
      }

      setUploadProgress(null);
      setUploadProgressText(null);

      // Get existing CDN IDs from kept IDs or fallback to parsing from URLs
      const urlImageIds = selectedImages
        .filter((img) => !img.id && img.uri && img.uri.includes("api.chuyenbienhoa.com"))
        .map((img) => img.uri.split("/").pop());
      const allCdnIds = [...new Set([...keptImageIds, ...urlImageIds, ...newCdnIds])];

      const urlDocIds = selectedDocuments
        .filter((doc) => !doc.id && doc.uri && doc.uri.includes("api.chuyenbienhoa.com"))
        .map((doc) => doc.uri.split("/").pop());
      const allDocIds = [...new Set([...keptDocumentIds, ...urlDocIds, ...newDocIds])];

      const urlVideoIds = selectedVideos
        .filter((video) => !video.id && video.uri && video.uri.includes("api.chuyenbienhoa.com"))
        .map((video) => video.uri.split("/").pop());
      const allVideoIds = [...new Set([...keptVideoIds, ...urlVideoIds, ...newVideoIds])];

      const response = await updatePost(route.params.postId, {
        title,
        // Auto-wraps a bare youtube.com/youtu.be link typed into the post
        // in the same <iframe> PostItem already knows how to render.
        description: autoEmbedYouTubeLinks(postContent),
        kept_image_ids: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
        cdn_image_id: allCdnIds.length > 0 ? allCdnIds.join(",") : null,
        kept_document_ids: allDocIds.length > 0 ? allDocIds.join(",") : null,
        cdn_document_id: allDocIds.length > 0 ? allDocIds.join(",") : null,
        kept_video_ids: allVideoIds.length > 0 ? allVideoIds.join(",") : null,
        cdn_video_id: allVideoIds.length > 0 ? allVideoIds.join(",") : null,
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
      setUploadProgress(null);
      setUploadProgressText(null);
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ProgressHUD
        loadText={uploadProgressText || t('editPost.updating')}
        visible={loading}
        progress={uploadProgress}
      />

      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: Platform.OS === "ios" ? 12 : insets.top + 8,
            height: headerHeight,
            backgroundColor: 'transparent',
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
            renders its own real glass pill (providerId="PostEditScreen"),
            and stacking a second bar-wide glass sample behind them produced
            a visible double-refraction artifact (a blotchy discolored patch
            reaching up toward the status bar). One glass layer per element. */}
        <Animated.View style={{ opacity: headerButtonOpacity }}>
          <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()} roundedOnScroll providerId="PostEditScreen" style={Platform.OS === "android" ? { borderRadius: 22 } : undefined}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
        </Animated.View>
        <Animated.Text style={[styles.topTitle, { flex: 1, textAlign: 'center', opacity: headerTitleOpacity, color: theme.text }]}>{t('editPost.title')}</Animated.Text>
        <Animated.View style={{ opacity: headerButtonOpacity }}>
          <LiquidButton size={44} scrollY={scrollY} onPress={handleUpdate} roundedOnScroll providerId="PostEditScreen" style={styles.publishButton}>
            <Text style={[styles.publishButtonText, { color: theme.primary }]}>{t('editPost.save')}</Text>
          </LiquidButton>
        </Animated.View>
      </Animated.View>

      <AndroidGlassBackdrop providerId="PostEditScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: insets.bottom + 24 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <LinearGradient
          colors={isDarkMode ? ['#173C2B', '#0F261D'] : ['#2BAA5C', '#1A874A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroIcon}><Ionicons name="create-outline" size={24} color="#FFFFFF" /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{t('editPost.title')}</Text>
            <Text style={styles.heroSubtitle}>{t('editPost.placeholderContent')}</Text>
          </View>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: isDarkMode ? theme.cardBackground : 'rgba(255,255,255,0.96)', borderColor: isDarkMode ? theme.border : 'rgba(15,23,42,0.08)', shadowColor: '#0F172A', shadowOpacity: isDarkMode ? 0.24 : 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 6 }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
          <View style={styles.profileRow}>
            {isAnonymous ? (
              <View style={[styles.avatar, { backgroundColor: isDarkMode ? '#1f2937' : '#e9f1e9' }]}> 
                <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 32 }}>?</Text>
              </View>
            ) : (
              <FastImage source={{ uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar` }} style={[styles.avatarImage, { borderColor: isDarkMode ? theme.border : '#D1D5DB' }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>
                {isAnonymous ? t('createPost.anonymousUser') : profileName}
                {userInfo.verified && !isAnonymous && <Verified width={18} height={18} color={theme.primary} style={{ marginBottom: -4, marginLeft: 4 }} />}
              </Text>
              <Dropdown
                options={viewOptions}
                placeholder={viewOptions[0]?.label || t('createPost.privacyPublic')}
                selectedValue={viewSelected}
                onValueChange={setViewSelected}
                style={[styles.dropdown, { backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.72)' }]}
                leftIcon={<Ionicons name={viewSelected?.icon || 'earth'} size={15} color={theme.subText} />}
                textStyle={{ fontSize: 12, color: theme.subText }}
                arrowSize={15}
              />
            </View>
          </View>

          <View style={[styles.inputGroup, { backgroundColor: isDarkMode ? theme.surface : 'rgba(248,250,252,0.98)', borderWidth: 1, borderColor: isDarkMode ? theme.border : 'rgba(15,23,42,0.05)' }]}> 
            <TextInput
              style={[styles.titleInput, { color: theme.text }]}
              placeholder={t('editPost.placeholderTitle')}
              placeholderTextColor={theme.subText}
              value={title}
              onChangeText={setTitle}
            />
            <View style={[styles.divider, { borderColor: theme.border }]} />
            <MarkdownTextInput
              style={[styles.contentInput, { color: theme.text }]}
              parser={postMentionParser}
              markdownStyle={{
                mentionUser: { color: "#22c55e", fontWeight: "600", backgroundColor: "transparent", borderRadius: 0 },
              }}
              placeholder={t('editPost.placeholderContent')}
              placeholderTextColor={theme.subText}
              value={postContent}
              onChangeText={contentMentionProps.onChangeText}
              multiline
              textAlignVertical="top"
            />
            {hasContentSuggestions && (
              <MentionSuggestions
                suggestions={contentSuggestions}
                loading={contentSuggestionsLoading}
                onSelect={onSelectContentMention}
              />
            )}
            {/* YouTube embed preview — shown when content contains an iframe with a YouTube src */}
            {(() => {
              const ytId = extractYouTubeId(postContent);
              if (!ytId) return null;
              return (
                <View style={{
                  marginTop: 12,
                  borderRadius: 12,
                  overflow: "hidden",
                  aspectRatio: 16 / 9,
                  backgroundColor: "#000",
                }}>
                  <WebView
                    source={{ html: buildYouTubePlayerHtml(ytId) }}
                    style={{ flex: 1, backgroundColor: "#000" }}
                    javaScriptEnabled
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                  />
                </View>
              );
            })()}
          </View>

          <View style={[styles.toggleCard, { backgroundColor: isDarkMode ? theme.surface : 'rgba(248,250,252,0.92)', borderWidth: 1, borderColor: isDarkMode ? theme.border : 'rgba(15,23,42,0.08)', opacity: 0.7 }]}> 
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: theme.text, opacity: 0.75 }]}>{t('createPost.anonymous')}</Text>
              <Text style={[styles.toggleText, { color: theme.subText, opacity: 0.75 }]}>{t('createPost.anonymousDesc')}</Text>
            </View>
            <Switch
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor="#f4f3f4"
              value={isAnonymous}
              disabled
              style={{ opacity: 0.6 }}
            />
          </View>

          <View style={styles.inlineButtons}>
            <TouchableOpacity onPress={() => navigateToHelp(213057)} style={[styles.inlineButton, { borderColor: isDarkMode ? theme.border : 'rgba(15,23,42,0.07)', backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.98)' }]}> 
              <Ionicons name="logo-markdown" size={15} color={theme.primary} />
              <Text style={[styles.inlineButtonText, { color: theme.text }]}>{t('editPost.markdown')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigateToHelp(213054)} style={[styles.inlineButton, { borderColor: theme.border, backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.96)' }]}> 
              <Ionicons name="warning" size={16} color={theme.primary} />
              <Text style={[styles.inlineButtonText, { color: theme.text }]}>{t('editPost.rules')}</Text>
            </TouchableOpacity>
          </View>

          {selectedDocuments.length > 0 && (
            <View style={styles.fileList}>
              {selectedDocuments.map((doc, index) => (
                <View key={index} style={[styles.fileItem, { backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.86)' }]}> 
                  <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                  <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>{doc.name}</Text>
                  <TouchableOpacity onPress={() => removeDocument(index)}>
                    <Ionicons name="close-circle" size={20} color={theme.subText} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {selectedImages.length > 0 || selectedVideos.length > 0 ? (
            // Photos and videos share one media row/section (rather than a
            // separate video section) so attaching either feels like the
            // same action.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
              {selectedImages.map((img, index) => (
                <View key={`image-${index}-${img.uri}`} style={styles.mediaThumb}>
                  <FastImage source={{ uri: img.uri }} style={[styles.mediaImage, { borderColor: isDarkMode ? theme.border : '#E5E7EB' }]} />
                  <TouchableOpacity onPress={() => removeImage(index)} style={styles.removeButton}>
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
                <Text style={[styles.mediaAddText, { color: theme.primary }]}>{t('editPost.addImage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickVideo} style={styles.mediaAddTile}>
                <Ionicons name="videocam-outline" size={30} color={theme.primary} />
                <Text style={[styles.mediaAddText, { color: theme.primary }]}>{t('editPost.addVideo') || t('createPost.addVideo')}</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.mediaPickerRow}>
              <TouchableOpacity onPress={pickImage} style={[styles.mediaPickerTile, { backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.98)', borderWidth: 1, borderColor: isDarkMode ? theme.border : '#D1D5DB' }]}>
                <Ionicons name="image-outline" size={28} color={theme.primary} />
                <Text style={[styles.mediaPickerText, { color: theme.primary }]}>{t('editPost.addImage') || t('createPost.addImage') || 'Thêm ảnh'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickVideo} style={[styles.mediaPickerTile, { backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.98)', borderWidth: 1, borderColor: isDarkMode ? theme.border : '#D1D5DB' }]}>
                <Ionicons name="videocam-outline" size={28} color={theme.primary} />
                <Text style={[styles.mediaPickerText, { color: theme.primary }]}>{t('editPost.addVideo') || t('createPost.addVideo') || 'Thêm video'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickDocument} style={[styles.mediaPickerTile, { backgroundColor: isDarkMode ? theme.surface : 'rgba(255,255,255,0.98)', borderWidth: 1, borderColor: isDarkMode ? theme.border : '#D1D5DB' }]}>
                <Ionicons name="document-attach-outline" size={28} color={theme.primary} />
                <Text style={[styles.mediaPickerText, { color: theme.primary }]}>{t('createPost.addDocument') || 'Thêm tài liệu'}</Text>
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
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(148,163,184,0.16)' },
  topTitle: { fontSize: 16, fontWeight: '700' },
  publishButton: { paddingHorizontal: 14, minWidth: 84, borderRadius: 22 },
  publishButtonText: { fontWeight: '700', fontSize: 14 },
  heroCard: { marginHorizontal: 16, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.84)', fontSize: 13, marginTop: 4 },
  card: { marginHorizontal: 16, borderRadius: 24, padding: 16, borderWidth: 1, gap: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: '#D1D5DB' },
  profileName: { fontWeight: '700', fontSize: 16, marginBottom: 6 },
  dropdown: { borderWidth: 0, backgroundColor: 'rgba(255,255,255,0.72)', padding: 6, borderRadius: 10, gap: 3, alignSelf: 'flex-start' },
  inputGroup: { borderRadius: 18, padding: 8 },
  titleInput: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, fontSize: 16, fontWeight: '700' },
  divider: { height: 1, marginHorizontal: 8, marginVertical: 6 },
  contentInput: { minHeight: 180, paddingHorizontal: 8, paddingVertical: 6, fontSize: 15, lineHeight: 22 },
  toggleCard: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
  toggleText: { fontSize: 12, lineHeight: 17 },
  inlineButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  inlineButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  inlineButtonText: { fontSize: 13, fontWeight: '600' },
  fileList: { gap: 8 },
  fileItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  fileName: { flex: 1, fontSize: 13 },
  mediaRow: { paddingTop: 8, paddingBottom: 4, gap: 8 },
  mediaThumb: { position: 'relative', marginRight: 8 },
  mediaImage: { width: 130, height: 130, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  removeButton: { position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', borderRadius: 999, padding: 6 },
  mediaAddTile: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2, borderColor: '#D1D5DB', borderRadius: 16, borderStyle: 'dashed' },
  mediaAddText: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  mediaPickerRow: { flexDirection: 'row', gap: 10 },
  mediaPickerTile: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 12 },
  mediaPickerText: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default PostEditScreen;
