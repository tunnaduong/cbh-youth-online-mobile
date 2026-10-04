import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import Dropdown from "../../../components/Dropdown";
import { getCategoryName } from "../../../utils/forumUtils";
import {
  createPost,
  getSubforums,
  uploadFile,
  uploadInlineImage,
  MAX_INLINE_IMAGE_MB,
} from "../../../services/api/Api";
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
import {
  getVideoExtension,
  getVideoMimeType,
  validateVideoAsset,
} from "../../../utils/videoUpload";
import { autoEmbedYouTubeLinks } from "../../../utils/youtubeShare";
import { autoEmbedSoundCloudLinks } from "../../../utils/soundcloudShare";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import MentionSuggestions, { useMentionInput } from "../../../components/MentionSuggestions";
import { getMentionSuggestions } from "../../../services/api/Api";
import { CustomAlert } from "../../../components/CustomAlert";
import MarkdownToolbar, { TOOLBAR_HEIGHT } from "../../../components/PostEditor/MarkdownToolbar";
import PostPreview from "../../../components/PostEditor/PostPreview";
import { postMarkdownParser } from "../../../utils/postMarkdownParser";
import { hasClipboardImage, readClipboardImage } from "../../../utils/clipboardImage";
import {
  continueListOnEnter,
  createUploadToken,
  hasPendingUploads,
  insertCodeBlock,
  insertImageTokens,
  insertLink,
  insertMentionTrigger,
  replaceToken,
  stripStaleUploadTokens,
  toggleInlineCode,
  toggleLinePrefix,
  wrapSelection,
} from "../../../utils/markdownEdit";
import { clearPostDraft, isDraftEmpty, loadPostDraft, savePostDraft } from "../../../utils/postDraft";

// Large video/image/document uploads (up to 100MB) need more headroom than
// the default upload timeout.
const VIDEO_UPLOAD_TIMEOUT = 300000;
const HEAVY_UPLOAD_TIMEOUT = 300000;

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
// Typing is grouped into one undo step per burst - a pause this long starts a
// new one.
const TYPING_BATCH_MS = 700;
const MAX_UNDO_STEPS = 100;

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
  const [postContent, setPostContent] = useState(restoredDraft?.content ?? prefillContent);
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
  const [mode, setMode] = useState("write");

  // --- editor plumbing -------------------------------------------------
  // The text/selection live in refs as well as state: async work (an image
  // finishing its upload) has to patch the *current* text, not whatever a
  // stale closure captured.
  const inputRef = useRef(null);
  const contentRef = useRef(postContent);
  const selectionRef = useRef({ start: postContent.length, end: postContent.length });
  const [forcedSelection, setForcedSelection] = useState(undefined);
  const selectionTimerRef = useRef(null);
  const historyRef = useRef([]);
  const typingTimerRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const pendingTokensRef = useRef(new Set());
  const [uploadingImages, setUploadingImages] = useState(0);
  const [contentFocused, setContentFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(selectionTimerRef.current);
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  // The toolbar and the mention list ride on top of the keyboard, so they
  // need to know where it is.
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Applies text + selection from code (toolbar, upload result, undo).
  // The controlled `selection` prop is only held briefly: left in place, it
  // would pin the caret and fight the user's next keystroke.
  const commit = (text, selection) => {
    contentRef.current = text;
    selectionRef.current = selection;
    setPostContent(text);
    setForcedSelection(selection);
    clearTimeout(selectionTimerRef.current);
    selectionTimerRef.current = setTimeout(() => setForcedSelection(undefined), 150);
  };

  // Undo steps are snapshots of the state *before* an edit.
  const pushHistory = () => {
    const stack = historyRef.current;
    const snapshot = { text: contentRef.current, ...selectionRef.current };
    if (stack.length > 0 && stack[stack.length - 1].text === snapshot.text) return;
    stack.push(snapshot);
    if (stack.length > MAX_UNDO_STEPS) stack.shift();
    setCanUndo(true);
  };

  const endTypingBatch = () => {
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
  };

  const handleTextChange = (text) => {
    if (!typingTimerRef.current) pushHistory(); // first keystroke of a burst
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, TYPING_BATCH_MS);

    // Enter on a list/quote line carries the marker onto the next line.
    const continued = continueListOnEnter(contentRef.current, text);
    if (continued) {
      commit(continued.text, { start: continued.caret, end: continued.caret });
      contentMentionProps.onChangeText(continued.text);
      return;
    }

    contentRef.current = text;
    contentMentionProps.onChangeText(text);
  };

  // The mention hook rewrites the text itself when a suggestion is picked.
  const {
    mentionProps: contentMentionProps,
    suggestions: contentSuggestions,
    loading: contentSuggestionsLoading,
    onSelectMention: onSelectContentMention,
    hasSuggestions: hasContentSuggestions,
  } = useMentionInput({
    value: postContent,
    onChange: (text) => {
      contentRef.current = text;
      setPostContent(text);
    },
    fetchSuggestions: getMentionSuggestions,
  });

  const handleSelectMention = (user) => {
    endTypingBatch();
    pushHistory();
    onSelectContentMention(user);
    // The hook appends "@username " at the end; put the caret after it.
    const end = contentRef.current.length;
    commit(contentRef.current, { start: end, end });
  };

  const runEdit = (transform, { mention = false } = {}) => {
    endTypingBatch();
    const current = { text: contentRef.current, ...selectionRef.current };
    const next = transform(current);
    if (next.text === current.text && next.start === current.start && next.end === current.end) return;
    pushHistory();
    commit(next.text, { start: next.start, end: next.end });
    // "@" typed from the toolbar should open the suggestion list like a typed one.
    if (mention) contentMentionProps.onChangeText(next.text);
    inputRef.current?.focus();
  };

  const undo = () => {
    endTypingBatch();
    const stack = historyRef.current;
    const previous = stack.pop();
    setCanUndo(stack.length > 0);
    if (!previous) return;
    const text = stripStaleUploadTokens(previous.text, pendingTokensRef.current);
    commit(text, {
      start: Math.min(previous.start, text.length),
      end: Math.min(previous.end, text.length),
    });
  };

  // --- inline images ---------------------------------------------------
  const resolveToken = (token, replacement) => {
    pendingTokensRef.current.delete(token);
    const next = replaceToken({ text: contentRef.current, ...selectionRef.current }, token, replacement);
    if (next.text === contentRef.current) return; // author removed the placeholder
    commit(next.text, { start: next.start, end: next.end });
  };

  const uploadInlineAsset = async (asset, token) => {
    setUploadingImages((n) => n + 1);
    try {
      const url = await uploadInlineImage(asset, userId, { timeout: HEAVY_UPLOAD_TIMEOUT });
      if (mountedRef.current) resolveToken(token, `![image](${url})`);
    } catch (error) {
      console.log("Error uploading inline image:", error?.response?.data || error?.message);
      if (!mountedRef.current) return;
      resolveToken(token, "");
      Toast.show({
        type: "error",
        text1: t("createPost.imageUploadFailed"),
        text2: error?.response?.data?.message || t("createPost.retry"),
        autoHide: true,
        visibilityTime: 4000,
        topOffset: 60,
      });
    } finally {
      if (mountedRef.current) setUploadingImages((n) => n - 1);
    }
  };

  // Inline images: drop an "Uploading" placeholder at the caret for each one
  // right away, and swap it for the real link when its upload lands.
  const insertInlineImages = (picked) => {
    const assets = [];
    let skippedLarge = false;
    for (const asset of picked) {
      if (asset.fileSize && asset.fileSize > MAX_INLINE_IMAGE_MB * 1024 * 1024) {
        skippedLarge = true;
      } else {
        assets.push(asset);
      }
    }
    if (skippedLarge) {
      Toast.show({
        type: "error",
        text1: t("createPost.pickImageError"),
        text2: t("createPost.imageTooLarge", { mb: MAX_INLINE_IMAGE_MB }),
        autoHide: true,
        visibilityTime: 4000,
        topOffset: 60,
      });
    }
    if (assets.length === 0) return;

    let probe = contentRef.current;
    const jobs = assets.map((asset) => {
      const token = createUploadToken(probe);
      probe += token;
      return { asset, token };
    });

    endTypingBatch();
    const next = insertImageTokens(
      { text: contentRef.current, ...selectionRef.current },
      jobs.map((job) => job.token),
    );
    pushHistory();
    jobs.forEach((job) => pendingTokensRef.current.add(job.token));
    commit(next.text, { start: next.start, end: next.end });
    inputRef.current?.focus();

    jobs.forEach((job) => uploadInlineAsset(job.asset, job.token));
  };

  const reportImageError = (error) => {
    console.log("Error getting image:", error);
    Toast.show({
      type: "error",
      text1: t("createPost.pickImageError"),
      text2: t("createPost.retry"),
      autoHide: true,
      visibilityTime: 3000,
      topOffset: 60,
    });
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
      });
      if (!result.canceled && result.assets?.length) insertInlineImages(result.assets);
    } catch (error) {
      reportImageError(error);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const asset = await readClipboardImage();
      if (asset) insertInlineImages([asset]);
    } catch (error) {
      reportImageError(error);
    }
  };

  // The Image button. Pasting can't be intercepted from the system menu in
  // React Native, so the paste option lives here - offered only when the
  // clipboard really holds an image.
  const chooseImageSource = async () => {
    if (!(await hasClipboardImage())) return pickFromLibrary();
    CustomAlert.alert(
      t("createPost.imageSourceTitle"),
      "",
      [
        { text: t("createPost.pasteImage"), onPress: pasteFromClipboard },
        { text: t("createPost.chooseFromLibrary"), onPress: pickFromLibrary },
        { text: t("common.cancel"), style: "cancel" },
      ],
      { cancelable: true, stacked: true },
    );
  };

  const handleToolbarAction = (key) => {
    switch (key) {
      case "bold":
        return runEdit((s) => wrapSelection(s, "**"));
      case "italic":
        return runEdit((s) => wrapSelection(s, "_"));
      case "link":
        return runEdit(insertLink);
      case "image":
        return chooseImageSource();
      case "mention":
        return runEdit(insertMentionTrigger, { mention: true });
      case "bulletList":
        return runEdit((s) => toggleLinePrefix(s, "bullet"));
      case "numberedList":
        return runEdit((s) => toggleLinePrefix(s, "ordered"));
      case "heading":
        return runEdit((s) => toggleLinePrefix(s, "heading"));
      case "strikethrough":
        return runEdit((s) => wrapSelection(s, "~~"));
      case "quote":
        return runEdit((s) => toggleLinePrefix(s, "quote"));
      case "code":
        return runEdit(toggleInlineCode);
      case "codeBlock":
        return runEdit(insertCodeBlock);
      case "undo":
        return undo();
      default:
        return undefined;
    }
  };

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
    endTypingBatch();
    historyRef.current = [];
    setCanUndo(false);
    pendingSubforumRef.current = null;
    setTitle("");
    commit("", { start: 0, end: 0 });
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
          return { ...item, value: id, label: getCategoryName(name, t) };
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

          const uploadResponse = await uploadFile(formData, {
            timeout: HEAVY_UPLOAD_TIMEOUT,
          });
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

          const uploadResponse = await uploadFile(formData, {
            timeout: HEAVY_UPLOAD_TIMEOUT,
          });
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

      // Published: the draft has served its purpose, and leaving the screen
      // from here on must not trigger the unsaved-changes prompt.
      clearPostDraft(userId);
      guardOffRef.current = true;

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

      if (viewSelected.value === "public" && !isPendingModeration) {
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
        // Skip when a pending-moderation toast already went up above, or the
        // two stack on top of each other.
        if (!isPendingModeration) {
          Toast.show({
            type: "success",
            text1: t("createPost.postedSuccess"),
            text2: t("createPost.reloading"),
            autoHide: true,
            visibilityTime: 2000,
            topOffset: 60,
          });
        }
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

  // --- rendering ---------------------------------------------------------
  const markdownStyle = useMemo(() => {
    const codeBackground = isDarkMode ? "#2C2C2C" : "#EEF0F2";
    return {
      syntax: { color: theme.subText },
      link: { color: theme.primary },
      h1: { fontSize: 20 },
      blockquote: { borderColor: theme.border, borderWidth: 3, marginLeft: 0, paddingLeft: 8 },
      code: {
        fontFamily: MONO,
        fontSize: 15,
        color: theme.text,
        backgroundColor: codeBackground,
        borderWidth: 0,
        borderRadius: 4,
        padding: 0,
      },
      pre: {
        fontFamily: MONO,
        fontSize: 15,
        color: theme.text,
        backgroundColor: codeBackground,
        borderWidth: 0,
        borderRadius: 6,
        padding: 2,
      },
      // The library's mentionUser default also sets a cyan backgroundColor +
      // borderRadius (a solid highlighted chip) - override both so a mention
      // is just colored/bold text, not dropped in a background box.
      mentionUser: { color: "#22c55e", fontWeight: "600", backgroundColor: "transparent", borderRadius: 0 },
    };
  }, [theme, isDarkMode]);

  // Not gated on the software keyboard being up: with a hardware keyboard
  // (iPad) there is none, and the toolbar is still what the author wants.
  const toolbarVisible = mode === "write" && contentFocused;
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

        {/* GitHub-style underlined tabs. */}
        <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
          {["write", "preview"].map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => {
                if (key === "preview") Keyboard.dismiss();
                setMode(key);
              }}
              style={[styles.tab, mode === key && { borderBottomColor: theme.primary }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === key ? theme.text : theme.subText },
                  mode === key && { fontWeight: "700" },
                ]}
              >
                {t(`createPost.${key}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Kept mounted (just hidden) while previewing so the caret position
            and edit history survive a trip to the Preview tab. */}
        <View style={mode === "write" ? styles.editorWrap : styles.hidden}>
          <MarkdownTextInput
            ref={inputRef}
            style={[styles.contentInput, { color: theme.text }]}
            parser={postMarkdownParser}
            markdownStyle={markdownStyle}
            placeholder={t("createPost.placeholderContent")}
            placeholderTextColor={theme.subText}
            value={postContent}
            onChangeText={handleTextChange}
            onSelectionChange={(e) => {
              selectionRef.current = e.nativeEvent.selection;
            }}
            selection={forcedSelection}
            onFocus={() => setContentFocused(true)}
            onBlur={() => setContentFocused(false)}
            multiline
            textAlignVertical="top"
          />
        </View>

        {mode === "preview" && (
          <PostPreview
            markdown={autoEmbedSoundCloudLinks(autoEmbedYouTubeLinks(postContent))}
          />
        )}

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

      {/* Formatting toolbar, riding on top of the keyboard. Stays mounted so
          it already tracks the keyboard when it becomes visible. */}
      {mode === "write" && (
        <KeyboardStickyView
          style={styles.sticky}
          pointerEvents={toolbarVisible ? "auto" : "none"}
        >
          <View
            style={{
              opacity: toolbarVisible ? 1 : 0,
              // No keyboard to sit on: stay clear of the home indicator.
              paddingBottom: keyboardHeight === 0 ? insets.bottom : 0,
              backgroundColor: isDarkMode ? theme.surface : "#F2F3F5",
            }}
          >
            <MarkdownToolbar
              onAction={handleToolbarAction}
              canUndo={canUndo}
              imageBusy={uploadingImages > 0}
            />
          </View>
        </KeyboardStickyView>
      )}

      {/* Rendered outside the ScrollView - a FlatList (inside MentionSuggestions)
          nested in a ScrollView of the same orientation doesn't get a usable
          height and never shows anything, only warns. */}
      {hasContentSuggestions && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: toolbarVisible
              ? (keyboardHeight || insets.bottom) + TOOLBAR_HEIGHT + 8
              : (keyboardHeight || insets.bottom) + 16,
            zIndex: 50,
            elevation: 50,
          }}
          pointerEvents="box-none"
        >
          <MentionSuggestions
            suggestions={contentSuggestions}
            loading={contentSuggestionsLoading}
            onSelect={handleSelectMention}
          />
        </View>
      )}
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
  editorWrap: { minHeight: 240 },
  hidden: { display: "none" },
  contentInput: {
    minHeight: 240,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 24,
  },
  hintText: { fontSize: 12, marginTop: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  pill: { borderWidth: 0, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, gap: 2 },
  pillText: { fontSize: 13, fontWeight: "600" },
  anonButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  tabsRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 4, marginBottom: 14 },
  tab: { paddingVertical: 10, marginRight: 22, marginBottom: -StyleSheet.hairlineWidth, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 14, fontWeight: "500" },
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
  sticky: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 40 },
});

export default CreatePostScreen;
