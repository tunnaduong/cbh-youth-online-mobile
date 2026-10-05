import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import { uploadInlineImage, MAX_INLINE_IMAGE_MB, getMentionSuggestions } from "../../services/api/Api";
import { useMentionInput } from "../MentionSuggestions";
import { CustomAlert } from "../CustomAlert";
import { apiErrorMessage } from "../../utils/apiMessage";
import { hasClipboardImage, readClipboardImage } from "../../utils/clipboardImage";
import {
  continueListOnEnter,
  createUploadToken,
  insertCodeBlock,
  insertImageTokens,
  insertLink,
  insertMentionTrigger,
  replaceToken,
  stripStaleUploadTokens,
  toggleInlineCode,
  toggleLinePrefix,
  wrapSelection,
} from "../../utils/markdownEdit";

// The GitHub-style post body editor shared by CreatePostScreen and
// PostEditScreen: the Markdown text with its caret, the toolbar actions,
// undo history, @mentions, inline images (placeholder at the caret, swapped
// for the link once the upload lands) and the Write/Preview mode. The screens
// own everything around it (title, category, attachments, saving) and render
// it with the pieces in PostEditorParts.js.

// Inline image uploads (up to MAX_INLINE_IMAGE_MB) need more headroom than
// the default upload timeout.
const HEAVY_UPLOAD_TIMEOUT = 300000;

export const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
// Typing is grouped into one undo step per burst - a pause this long starts a
// new one.
const TYPING_BATCH_MS = 700;
const MAX_UNDO_STEPS = 100;

export default function usePostEditor({ initialContent = "", userId }) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const [postContent, setPostContent] = useState(initialContent);
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
        text2: apiErrorMessage(error, t("createPost.retry")),
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


  // Replaces the whole text from outside (a post loaded for editing, "start
  // over") - not an edit, so it starts a fresh undo history.
  const reset = (text) => {
    endTypingBatch();
    historyRef.current = [];
    setCanUndo(false);
    commit(text, { start: text.length, end: text.length });
  };

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

  return {
    postContent,
    mode,
    setMode,
    inputRef,
    contentRef,
    selectionRef,
    forcedSelection,
    canUndo,
    uploadingImages,
    setContentFocused,
    keyboardHeight,
    toolbarVisible,
    markdownStyle,
    handleTextChange,
    handleToolbarAction,
    handleSelectMention,
    contentSuggestions,
    contentSuggestionsLoading,
    hasContentSuggestions,
    reset,
  };
}
