import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Dropdown from "../../../components/Dropdown";
import { getCategoryName } from "../../../utils/forumUtils";
import {
  createPost,
  getSubforums,
  uploadFile,
} from "../../../services/api/Api";
import Toast from "react-native-toast-message";
import { FeedContext } from "../../../contexts/FeedContext";
import ProgressHUD from "../../../components/ProgressHUD";
import { compressImageForUpload, compressVideoForUpload } from "../../../utils/mediaCompression";
import { startUpload } from "../../../services/uploadQueue";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import FastImage from "../../../components/FastImage";
import VideoThumbnail from "../../../components/VideoThumbnail";
import { CommonActions } from "@react-navigation/native";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import {
  getVideoExtension,
  getVideoMimeType,
  validateVideoAsset,
} from "../../../utils/videoUpload";
import { autoEmbedYouTubeLinks } from "../../../utils/youtubeShare";
import { autoEmbedSoundCloudLinks } from "../../../utils/soundcloudShare";
import { CustomAlert } from "../../../components/CustomAlert";
import { TOOLBAR_HEIGHT } from "../../../components/PostEditor/MarkdownToolbar";
import usePostEditor from "../../../components/PostEditor/usePostEditor";
import {
  PostEditorField,
  PostEditorMentions,
  PostEditorTabs,
  PostEditorToolbar,
} from "../../../components/PostEditor/PostEditorParts";
import { hasPendingUploads } from "../../../utils/markdownEdit";
import { clearPostDraft, isDraftEmpty, loadPostDraft, savePostDraft } from "../../../utils/postDraft";

// Large video/image/document uploads (up to 100MB) need more headroom than
// the default upload timeout.
const VIDEO_UPLOAD_TIMEOUT = 300000;
const HEAVY_UPLOAD_TIMEOUT = 300000;


// What "has the author changed anything?" is measured against.
const makeSnapshot = ({ title, content, subforum, privacy, anonymous }) =>
  JSON.stringify({ title, content, subforum, privacy, anonymous });

const CreatePostScreen = ({ navigation, route }) => {
  const { userInfo } = useContext(AuthContext);
  const userId = userInfo?.id;
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { setFeed } = useContext(FeedContext);

  useStatusBarStyle(
    isDarkMode ? "light-content" : "dark-content",
    Platform.OS === "android" ? "transparent" : theme.background,
  );

  // --- initial values: pre-fill (shared link/text) wins, else the saved draft
  const prefillTitle = route?.params?.initialTitle ?? "";
  const prefillContent = route?.params?.initialContent ?? "";
  const isPrefilled = prefillTitle !== "" || prefillContent !== "";
  // Opening pre-filled leaves the saved draft alone for next time.
  const [restoredDraft] = useState(() => {
    if (isPrefilled) return null;
    const draft = loadPostDraft(userId);
    return isDraftEmpty(draft) ? null : draft;
  });
  const [showDraftBanner, setShowDraftBanner] = useState(!!restoredDraft);
  // The draft stores the category by id; the option objects (with translated
  // labels) only exist once the subforum list has loaded.
  const pendingSubforumRef = useRef(restoredDraft?.subforum ?? null);

  const [title, setTitle] = useState(restoredDraft?.title ?? prefillTitle);
  const [selected, setSelected] = useState(null);
  const [subforums, setSubforums] = useState([]);
  const view = [
    { label: t("createPost.privacyPublic"), value: "public", icon: "earth" },
    { label: t("createPost.privacyFollowers"), value: "followers", icon: "people" },
    { label: t("createPost.privacyPrivate"), value: "private", icon: "lock-closed" },
  ];
  const [viewSelected, setViewSelected] = useState(
    view.find((v) => v.value === restoredDraft?.privacy) ?? view[0],
  );
  const [isAnonymous, setIsAnonymous] = useState(!!restoredDraft?.anonymous);
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadProgressText, setUploadProgressText] = useState(null);

  // --- editor: text, caret, toolbar, undo, mentions, inline images ------
  const editor = usePostEditor({
    initialContent: restoredDraft?.content ?? prefillContent,
    userId,
  });
  const { postContent, mode, setMode, inputRef, contentRef } = editor;

  // --- leaving: unsaved-changes guard + draft ----------------------------
  const attachmentCount = selectedImages.length + selectedVideos.length + selectedDocuments.length;
  const snapshot = makeSnapshot({
    title,
    content: postContent,
    subforum: selected?.value ?? pendingSubforumRef.current ?? null,
    privacy: viewSelected.value,
    anonymous: isAnonymous,
  });
  // Whatever the composer opened with (empty, a restored draft, or a
  // pre-fill) is the baseline: only changes on top of it count.
  const baselineRef = useRef(snapshot);
  const hasContent = title.trim() !== "" || postContent.trim() !== "" || attachmentCount > 0;
  const isDirty = hasContent && (snapshot !== baselineRef.current || attachmentCount > 0);

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const guardOffRef = useRef(false);
  // Latest values for the alert callbacks below (the guard's listener is
  // registered once, so it can't close over per-render values).
  const latestRef = useRef({});
  latestRef.current = { title, postContent, selected, viewSelected, isAnonymous, attachmentCount, userId };

  const saveDraftNow = () => {
    const { title: ti, postContent: body, selected: cat, viewSelected: vis, isAnonymous: anon, userId: uid } =
      latestRef.current;
    const draft = {
      title: ti,
      content: body,
      subforum: cat?.value ?? pendingSubforumRef.current ?? null,
      privacy: vis.value,
      anonymous: anon,
    };
    if (isDraftEmpty(draft)) {
      clearPostDraft(uid);
      return;
    }
    if (savePostDraft(uid, draft)) {
      Toast.show({
        type: "success",
        text1: t("createPost.draftSaved"),
        autoHide: true,
        visibilityTime: 2000,
        topOffset: 60,
      });
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (guardOffRef.current || !isDirtyRef.current) return;
      event.preventDefault();

      const leave = () => {
        guardOffRef.current = true;
        navigation.dispatch(event.data.action);
      };
      const note = latestRef.current.attachmentCount > 0 ? `\n\n${t("createPost.exitAttachmentsNote")}` : "";

      CustomAlert.alert(
        t("createPost.exitTitle"),
        `${t("createPost.exitMessage")}${note}`,
        [
          {
            text: t("createPost.saveDraft"),
            onPress: () => {
              saveDraftNow();
              leave();
            },
          },
          {
            text: t("createPost.discardPost"),
            style: "destructive",
            onPress: () => {
              clearPostDraft(latestRef.current.userId);
              leave();
            },
          },
          { text: t("createPost.keepEditing"), style: "cancel" },
        ],
        { cancelable: true, stacked: true },
      );
    });
    return unsubscribe;
  }, [navigation, t]);

  // A swipe-down on the iOS modal would dismiss it before the guard could ask.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isDirty });
  }, [navigation, isDirty]);

  const restartFromScratch = () => {
    clearPostDraft(userId);
    pendingSubforumRef.current = null;
    setTitle("");
    editor.reset("");
    setSelected(null);
    setViewSelected(view[0]);
    setIsAnonymous(false);
    baselineRef.current = makeSnapshot({
      title: "",
      content: "",
      subforum: null,
      privacy: view[0].value,
      anonymous: false,
    });
    setShowDraftBanner(false);
  };

  // --- misc existing behaviour ------------------------------------------
  useEffect(() => {
    if (isAnonymous && viewSelected.value === "followers") {
      setViewSelected(view[0]); // Reset to public
    }
  }, [isAnonymous]);

  // Opens a help post on top of the composer rather than closing it first:
  // what the author has typed stays put underneath, and going back returns
  // to it (closing first would have thrown the half-written post away).
  const navigateToHelp = (postId) => {
    try {
      navigation?.navigate("PostScreen", { postId });
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
          return {
            ...item,
            value: id,
            label: getCategoryName(name, t),
            category: item.category ? getCategoryName(item.category, t) : item.category,
          };
        });
        setSubforums(translated);
        if (pendingSubforumRef.current != null) {
          const match = translated.find((s) => String(s.value) === String(pendingSubforumRef.current));
          // A category that no longer exists stays "pending" - clearing it
          // would make the draft look edited without the author touching it.
          if (match) {
            setSelected(match);
            pendingSubforumRef.current = null;
          }
        }
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
        // iOS exports the pick as 720p H.264 (ignored on Android).
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
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

  const canSubmit = title.trim() !== "" && postContent.trim() !== "";

  const handlePost = () => {
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

    // A placeholder still in the text would be published as literal text.
    if (hasPendingUploads(contentRef.current)) {
      Toast.show({
        type: "info",
        text1: t("createPost.cannotPost"),
        text2: t("createPost.uploadsPending"),
        autoHide: true,
        visibilityTime: 4000,
        topOffset: 60,
      });
      return;
    }

    // Posting runs in the background (services/uploadQueue): the composer
    // closes right away, and the upload bar / notification say what is
    // happening - compressing, uploading, posting. Everything the task needs
    // is read here, once, so it doesn't depend on this screen staying open
    // (and gives the same result if the user taps "retry").
    const images = [...selectedImages];
    const documents = [...selectedDocuments];
    const videos = [...selectedVideos];
    const author = userInfo;
    const draftOwner = userId;
    const privacy = viewSelected.value;
    const draft = {
      title,
      // Auto-wraps a bare youtube.com/youtu.be link typed into the post
      // in the same <iframe> PostItem already knows how to render, so
      // users don't have to write the embed markup by hand.
      description: autoEmbedSoundCloudLinks(autoEmbedYouTubeLinks(postContent)),
      subforum_id: selected?.value ?? null,
      visibility: 0,
      privacy,
      anonymous: isAnonymous,
    };

    startUpload({
      kind: "post",
      task: async (report) => {
        // One bar for the whole post: each file is an equal share of it.
        const totalFiles = images.length + documents.length + videos.length;
        let filesDone = 0;
        const overall = (ratio) => (filesDone + ratio) / totalFiles;

        const cdnIds = [];
        for (const originalUri of images) {
          // Compressed on the device (the API no longer does it).
          report("compressingImage", { progress: overall(0) });
          const imageUri = await compressImageForUpload(originalUri);
          const formData = new FormData();
          const fileExtension = imageUri.split(".").pop();
          let mimeType = "image/jpeg";
          if (fileExtension === "png") {
            mimeType = "image/png";
          } else if (fileExtension === "gif") {
            mimeType = "image/gif";
          }

          formData.append("uid", author.id);
          formData.append("file", {
            uri: imageUri,
            name: `image.${fileExtension}`,
            type: mimeType,
          });

          report("uploading", { progress: overall(0) });
          const uploadResponse = await uploadFile(formData, {
            timeout: HEAVY_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              report.progress("uploading", { progress: overall(progressEvent.loaded / progressEvent.total) });
            },
          });
          cdnIds.push(uploadResponse.data.id);
          filesDone += 1;
        }

        const docIds = [];
        for (const dock of documents) {
          const formData = new FormData();

          formData.append("uid", author.id);
          formData.append("file", {
            uri: dock.uri,
            name: dock.name,
            type: dock.mimeType || "application/octet-stream",
          });

          report("uploading", { progress: overall(0) });
          const uploadResponse = await uploadFile(formData, {
            timeout: HEAVY_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              report.progress("uploading", { progress: overall(progressEvent.loaded / progressEvent.total) });
            },
          });
          docIds.push(uploadResponse.data.id);
          filesDone += 1;
        }

        // Videos: same two-step (upload -> cdn id) pattern as images and
        // documents, with a longer timeout since they can be up to 100MB.
        const videoIds = [];
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          const count = { current: i + 1, total: videos.length };
          const formData = new FormData();
          const extension = getVideoExtension(video.fileName || video.uri) || "mp4";

          // Compressed on the device to 720p H.264 (the API no longer does
          // it): the first half of this file's share of the bar, the upload
          // is the second half.
          report("compressingVideo", { ...count, progress: overall(0) });
          const compressed = await compressVideoForUpload(video.uri, (ratio) =>
            report.progress("compressingVideo", { ...count, progress: overall(ratio * 0.5) }),
          );

          formData.append("uid", author.id);
          formData.append("file", {
            uri: compressed.uri,
            // The compressor always writes an MP4.
            name: compressed.compressed
              ? `${(video.fileName || "video").replace(/\.[^.]*$/, "")}.mp4`
              : video.fileName || `video.${extension}`,
            type: compressed.compressed ? "video/mp4" : video.mimeType || getVideoMimeType(extension),
          });

          report("uploadingVideo", { ...count, progress: overall(0.5) });
          const uploadResponse = await uploadFile(formData, {
            timeout: VIDEO_UPLOAD_TIMEOUT,
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              const fileProgress = progressEvent.loaded / progressEvent.total;
              report.progress("uploadingVideo", { ...count, progress: overall(0.5 + fileProgress * 0.5) });
            },
          });
          videoIds.push(uploadResponse.data.id);
          filesDone += 1;
        }

        report("finishing");
        const response = await createPost({
          ...draft,
          cdn_image_id: cdnIds.length > 0 ? cdnIds.join(",") : null,
          cdn_document_id: docIds.length > 0 ? docIds.join(",") : null,
          cdn_video_id: videoIds.length > 0 ? videoIds.join(",") : null,
        });

        // Published: a saved draft of it has served its purpose. Cleared only
        // now, not when the composer closes, so a failed upload doesn't lose it.
        clearPostDraft(draftOwner);

        // AI moderation can hold a post for a human reviewer instead of
        // publishing it. Such a post is hidden server-side, so don't drop it
        // into the feed optimistically - tell the author it's queued instead.
        const isPendingModeration =
          response.data?.moderation?.status === "pending";

        if (isPendingModeration) {
          Toast.show({
            type: "info",
            text1: t("createPost.pendingModeration"),
            text2:
              response.data?.moderation?.message ||
              t("createPost.pendingModerationDesc"),
            autoHide: true,
            visibilityTime: 5000,
            topOffset: 60,
          });
        }

        if (privacy === "public" && !isPendingModeration) {
          setFeed((prevPosts) =>
            // A feed that hasn't loaded yet stays that way: the home screen
            // fetches it, new post included.
            prevPosts
              ? [
                  {
              ...response.data,
              is_mine: true,
              is_author: true,
              author: { ...author, ...response.data?.author },
              anonymous: response.data?.anonymous ?? draft.anonymous,
                  },
                  ...prevPosts,
                ]
              : prevPosts,
          );
        }

        return response;
      },
    });

    // Back to the feed while the post goes up - without the unsaved-changes
    // prompt, since the post isn't being abandoned.
    guardOffRef.current = true;
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
    }
  };

  // --- rendering ---------------------------------------------------------

  const { toolbarVisible } = editor;
  const chipBackground = isDarkMode ? theme.surface : "#F6F8FA";

  const submitDisabled = !canSubmit || loading;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ProgressHUD
        loadText={uploadProgressText || t("createPost.posting")}
        visible={loading}
        progress={uploadProgress}
      />

      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 6, borderBottomColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {t("createPost.title")}
        </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={submitDisabled}
          style={[
            styles.submit,
            { backgroundColor: submitDisabled ? theme.iconBackground : theme.primary },
          ]}
        >
          <Text style={[styles.submitText, { color: submitDisabled ? theme.subText : "#FFFFFF" }]}>
            {t("createPost.publish")}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 32 + (toolbarVisible ? TOOLBAR_HEIGHT : 0) },
        ]}
        bottomOffset={TOOLBAR_HEIGHT + 24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showDraftBanner && (
          <View style={[styles.banner, { backgroundColor: theme.iconBackground }]}>
            <Ionicons name="document-text-outline" size={18} color={theme.subText} />
            <Text style={[styles.bannerText, { color: theme.text }]}>{t("createPost.draftRestored")}</Text>
            <TouchableOpacity onPress={restartFromScratch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>
                {t("createPost.draftRestart")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDraftBanner(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color={theme.subText} />
            </TouchableOpacity>
          </View>
        )}

        {/* Where it goes and who sees it - one compact line above the title,
            like Reddit's community picker / X's audience pill. */}
        <View style={styles.metaRow}>
          <Dropdown
            options={subforums}
            placeholder={t("createPost.categoryShort")}
            selectedValue={selected}
            onValueChange={setSelected}
            containerStyle={{ flex: 1, marginVertical: 0 }}
            style={[styles.pill, { backgroundColor: theme.iconBackground }]}
            leftIcon={<Ionicons name="albums-outline" size={14} color={theme.subText} />}
            textStyle={styles.pillText}
            arrowSize={14}
          />
          <Dropdown
            options={
              isAnonymous
                ? view.filter((item) => item.value !== "followers")
                : view
            }
            placeholder={t("createPost.privacyPublic")}
            selectedValue={viewSelected}
            onValueChange={setViewSelected}
            containerStyle={{ marginVertical: 0 }}
            style={[styles.pill, { backgroundColor: theme.iconBackground, alignSelf: "flex-start" }]}
            leftIcon={<Ionicons name={viewSelected?.icon || "earth"} size={14} color={theme.subText} />}
            textStyle={styles.pillText}
            arrowSize={14}
          />
          <TouchableOpacity
            onPress={() => setIsAnonymous(!isAnonymous)}
            accessibilityRole="switch"
            accessibilityState={{ checked: isAnonymous }}
            accessibilityLabel={t("createPost.anonymous")}
            activeOpacity={0.7}
            style={[
              styles.anonButton,
              { backgroundColor: isAnonymous ? theme.primary : theme.iconBackground },
            ]}
          >
            <Ionicons
              name={isAnonymous ? "eye-off" : "eye-off-outline"}
              size={17}
              color={isAnonymous ? "#FFFFFF" : theme.subText}
            />
          </TouchableOpacity>
        </View>
        {isAnonymous && (
          <Text style={[styles.anonymousNote, { color: theme.subText }]}>{t("createPost.anonymousDesc")}</Text>
        )}
        <TextInput
          style={[styles.titleInput, { color: theme.text }]}
          placeholder={t("createPost.placeholderTitle")}
          placeholderTextColor={theme.subText}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          onSubmitEditing={() => {
            setMode("write");
            inputRef.current?.focus();
          }}
        />

        <PostEditorTabs editor={editor} />
        <PostEditorField editor={editor} placeholder={t("createPost.placeholderContent")} />

        <Text style={[styles.hintText, { color: theme.subText }]}>
          <Text style={styles.hintLink} onPress={() => navigateToHelp(865586194)}>
            {t("createPost.markdown")}
          </Text>
          {"   ·   "}
          <Text style={styles.hintLink} onPress={() => navigateToHelp(173336279)}>
            {t("createPost.rules")}
          </Text>
        </Text>

        {/* Attachments: icons only (X / Facebook composer style); the
            thumbnails and files appear below once something is added. */}
        <View style={[styles.attachBar, { borderTopColor: theme.border }]}>
          {[
            { key: "image", icon: "image-outline", label: t("createPost.addImage"), onPress: pickImage },
            { key: "video", icon: "videocam-outline", label: t("createPost.addVideo"), onPress: pickVideo },
            { key: "doc", icon: "document-attach-outline", label: t("createPost.addDocument"), onPress: pickDocument },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[styles.attachButton, item.key === "image" && styles.attachFirst]}
            >
              <Ionicons name={item.icon} size={24} color={theme.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {selectedDocuments.length > 0 && (
          <View style={styles.fileList}>
            {selectedDocuments.map((doc, index) => (
              <View
                key={index}
                style={[styles.fileItem, { backgroundColor: chipBackground, borderColor: theme.border }]}
              >
                <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                  {doc.name}
                </Text>
                <TouchableOpacity onPress={() => removeDocument(index)}>
                  <Ionicons name="close-circle" size={20} color={theme.subText} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {(selectedImages.length > 0 || selectedVideos.length > 0) && (
          // Photos and videos share one media row so attaching either feels
          // like the same action.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaRow}
            keyboardShouldPersistTaps="handled"
          >
            {selectedImages.map((uri, index) => (
              <View key={`image-${index}-${uri}`} style={styles.mediaThumb}>
                <FastImage
                  source={{ uri }}
                  style={[styles.mediaImage, { borderColor: theme.border }]}
                />
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
          </ScrollView>
        )}
      </KeyboardAwareScrollView>

      <PostEditorToolbar editor={editor} />
      <PostEditorMentions editor={editor} />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", marginHorizontal: 8 },
  submit: { minWidth: 76, height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  submitText: { fontSize: 14, fontWeight: "700" },
  body: { paddingHorizontal: 16, paddingTop: 12 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  bannerText: { flex: 1, fontSize: 13 },
  titleInput: { fontSize: 22, fontWeight: "800", paddingVertical: 8, paddingHorizontal: 0 },
  hintText: { fontSize: 12, marginTop: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  pill: { borderWidth: 0, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, gap: 2 },
  pillText: { fontSize: 13, fontWeight: "600" },
  anonButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  hintLink: { textDecorationLine: "underline" },
  attachBar: { flexDirection: "row", gap: 4, marginTop: 20, paddingTop: 6, paddingLeft: 0, borderTopWidth: StyleSheet.hairlineWidth, marginLeft: 0 },
  attachFirst: { marginLeft: -10 },
  attachButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  anonymousNote: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  fileList: { gap: 8, marginTop: 12 },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileName: { flex: 1, fontSize: 13 },
  mediaRow: { paddingTop: 12, paddingBottom: 4 },
  mediaThumb: { position: "relative", marginRight: 8 },
  mediaImage: { width: 130, height: 130, borderRadius: 16, borderWidth: 1 },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EF4444",
    borderRadius: 999,
    padding: 6,
  },
});

export default CreatePostScreen;
