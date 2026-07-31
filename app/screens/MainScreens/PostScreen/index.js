import React, {
  useContext,
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Share,
  Alert,
  Text,
  Pressable,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Animated,
  RefreshControl,
  Platform,
  Keyboard,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  commentPost,
  commentPostWithImages,
  deletePost,
  getPostDetail,
  incrementPostView,
  voteComment,
  updateComment,
  deleteComment,
  getMentionSuggestions,
} from "../../../services/api/Api";
import CommentBar from "../../../components/CommentBar";
import FastImage from "../../../components/FastImage";
import MentionText from "../../../components/MentionText";
import MentionSuggestions, { useMentionInput } from "../../../components/MentionSuggestions";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import CustomLoading from "../../../components/CustomLoading";
import { FeedContext } from "../../../contexts/FeedContext";
import { useBottomSheet } from "../../../contexts/BottomSheetContext";
import PostItem from "../../../components/PostItem";
import Verified from "../../../assets/Verified";
import ReportModal from "../../../components/ReportModal";
import { reportUser } from "../../../services/api/Api";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import formatTime from "../../../utils/formatTime";
import { generatePostSlug } from "../../../utils/slugify";
import LottieView from "lottie-react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import CommentVotesModal from "../../../components/CommentVotesModal";
import ImageView from "react-native-image-viewing";

const Comment = React.memo(React.forwardRef(
  ({ comment, level = 0, border = false, commentRefs,
     highlightedCommentId, isDarkMode, theme, t, username,
     navigation, focusCommentInput, handleCommentVote,
     setCommentVotesModal, setImageViewer, handleLongPressComment }, ref) => {
    if (!comment || !comment.id) return null;

    const votes = comment.votes ?? [];
    const author = comment.author ?? {};
    const content = comment.content ?? "";
    const replies = comment.replies ?? [];
    const isHighlighted = highlightedCommentId === comment.id;

    const sharedProps = {
      commentRefs, highlightedCommentId, isDarkMode, theme, t, username,
      navigation, focusCommentInput, handleCommentVote,
      setCommentVotesModal, setImageViewer, handleLongPressComment,
    };

    return (
      <View
        ref={ref}
        style={{
          marginLeft: level * 20,
          backgroundColor: isHighlighted
            ? isDarkMode ? "rgba(99,179,237,0.18)" : "rgba(66,153,225,0.12)"
            : "transparent",
          borderRadius: isHighlighted ? 10 : 0,
        }}
      >
        <Pressable onLongPress={() => handleLongPressComment(comment.id)} delayLongPress={500}>
          <View
            style={[
              { paddingVertical: 10, flexDirection: "row", gap: 10 },
              border && { borderLeftWidth: 3, borderLeftColor: theme.border, paddingLeft: 10 },
            ]}
          >
            <Pressable
              onPress={() => author.username && !comment.is_anonymous && navigation.navigate("ProfileScreen", { username: author.username })}
              disabled={!author.username || !!comment.is_anonymous}
            >
              <View style={{ backgroundColor: theme.background, width: 42, height: 42, borderRadius: 21, overflow: "hidden", borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                {comment.is_anonymous ? (
                  <View style={{ width: "100%", height: "100%", backgroundColor: theme.iconBackground, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: theme.text, fontWeight: "bold", fontSize: 20 }}>?</Text>
                  </View>
                ) : author.username ? (
                  <FastImage source={{ uri: `https://api.chuyenbienhoa.com/v1.0/users/${author.username}/avatar` }} style={{ width: 40, height: 40, borderRadius: 30 }} />
                ) : null}
              </View>
            </Pressable>
            <View style={{ flexShrink: 1 }}>
              <Pressable
                onPress={() => author.username && !comment.is_anonymous && navigation.navigate("ProfileScreen", { username: author.username })}
                disabled={!author.username || !!comment.is_anonymous}
              >
                <Text style={{ fontWeight: "bold", color: theme.primary }}>
                  {comment.is_anonymous ? t("post.anonymousUser") : author.profile_name || author.username || ""}
                  {author.verified && !comment.is_anonymous && (
                    <View>
                      <Verified width={15} height={15} color={theme.primary} style={{ marginBottom: -3 }} />
                    </View>
                  )}
                </Text>
              </Pressable>
              {comment.deleted_parent_username && (
                <View style={{ marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.iconBackground, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}>
                  <Text style={{ fontSize: 12, color: theme.subText }}>
                    {t("post.replyDeletedPrefix")}{" "}
                    <Text style={{ fontWeight: "600", color: theme.text }}>{author.profile_name || author.username || t("post.anonymous")}</Text>{" "}
                    {t("post.replyDeletedSuffix")}
                  </Text>
                </View>
              )}
              {!!content && (
                <MentionText style={{ flexShrink: 1, color: theme.text }} mentions={comment.mentions} onMentionPress={(u) => navigation.navigate("ProfileScreen", { username: u })}>
                  {String(content)}
                </MentionText>
              )}
              {comment.image_urls?.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: content ? 6 : 0 }}>
                  {comment.image_urls.map((url, idx) => (
                    <TouchableOpacity key={idx} activeOpacity={0.85} onPress={() => setImageViewer({ visible: true, images: comment.image_urls.map((u) => ({ uri: u })), index: idx })}>
                      <FastImage source={{ uri: url }} style={{ width: comment.image_urls.length === 1 ? 200 : 96, height: comment.image_urls.length === 1 ? 200 : 96, borderRadius: 8 }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View className="flex-row items-center mt-1">
                <Text style={{ fontSize: 12, color: "gray" }}>
                  {comment.created_at ? formatTime(comment.created_at) : ""}
                  {comment.is_edited ? ` (${t("post.edited")})` : ""} ·
                </Text>
                <TouchableOpacity onPress={() => focusCommentInput(comment.id, comment.is_anonymous ? t("post.anonymousUser") : author.profile_name || author.username || "", level)}>
                  <Text style={{ color: theme.subText, fontWeight: "bold", fontSize: 12 }}>{" "}{t("post.reply")}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View className="flex-1 items-end shrink-0">
              <View>
                <TouchableOpacity onPress={() => handleCommentVote(comment.id, 1)}>
                  <Ionicons name="arrow-up-outline" size={18} color={votes.some((v) => v.username === username && v.vote_value === 1) ? "#22c55e" : theme.subText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCommentVotesModal({ visible: true, commentId: comment.id, commentPreview: typeof comment.content === "string" ? comment.content : "" })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ alignItems: "center", paddingVertical: 4 }}>
                  <Text style={[{ fontSize: 14, fontWeight: "600" }, votes.some((v) => v.username === username && v.vote_value === 1) ? { color: "#22c55e" } : votes.some((v) => v.username === username && v.vote_value === -1) ? { color: "#ef4444" } : { color: theme.subText }, { textAlign: "center" }]}>
                    {votes.reduce((acc, v) => acc + (v.vote_value || 0), 0)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleCommentVote(comment.id, -1)}>
                  <Ionicons name="arrow-down-outline" size={18} color={votes.some((v) => v.username === username && v.vote_value === -1) ? "#ef4444" : theme.subText} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
        {replies.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {replies.map((reply) => (
              <Comment
                key={reply.id}
                comment={reply}
                level={level + 1}
                border={true}
                ref={(r) => (commentRefs.current[reply.id] = r)}
                {...sharedProps}
              />
            ))}
          </View>
        )}
      </View>
    );
  },
));

const PostScreen = ({ route, navigation }) => {
  const { theme, isDarkMode, autoplayVideos } = useTheme();
  const { item, postId, screenName, highlightCommentId } = route.params; // Destructure item from route.params
  const { username, profileName, userInfo } = useContext(AuthContext);
  const [votes, setVotes] = useState(item?.votes ?? []); // Local vote state
  const [isSaved, setIsSaved] = useState(
    item?.saved ?? item?.is_saved ?? false,
  );
  const [post, setPost] = useState(item ?? null);
  const [comments, setComments] = useState([]); // Local comment state
  // Mirrors `comments` for callbacks below that need the latest comment tree
  // without taking it as a dependency - lets handleCommentVote/
  // focusCommentInput/handleLongPressComment stay referentially stable
  // (via useCallback) across renders where the comments themselves didn't
  // change, which React.memo(Comment) below relies on to avoid re-rendering
  // the entire (potentially deep) comment tree on every unrelated PostScreen
  // state change (scroll, keyboard, post-level votes, etc).
  const commentsRef = useRef(comments);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);
  const [commentText, setCommentText] = useState("");
  const latestCommentRef = React.useRef("");
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);
  const [parentId, setParentId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [selectedCommentImages, setSelectedCommentImages] = useState([]);
  const commentInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const commentRefs = useRef({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const { setFeed, setRecentPostsProfile } = useContext(FeedContext);
  const { showBottomSheet, hideBottomSheet } = useBottomSheet();
  const isCurrentUser =
    post?.is_owner === true ||
    post?.topic?.is_owner === true ||
    post?.author?.username === username ||
    String(post?.author?.id) === String(userInfo?.id) ||
    String(post?.user_id) === String(userInfo?.id) ||
    String(post?.uid) === String(userInfo?.id) ||
    String(post?.userid) === String(userInfo?.id) ||
    post?.is_mine === true ||
    post?.is_author === true;
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [commentVotesModal, setCommentVotesModal] = useState({ visible: false, commentId: null, commentPreview: "" });
  const [imageViewer, setImageViewer] = useState({ visible: false, images: [], index: 0 });
  const insets = useSafeAreaInsets();
  const headerHeight = 50 + insets.top;
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const lottieRef = useRef(null);

  const { mentionProps: commentMentionProps, suggestions: commentSuggestions, onSelectMention: onSelectCommentMention, loading: commentSuggestionsLoading } = useMentionInput({
    value: commentText,
    // Tapping a mention suggestion updates `commentText` through here, not
    // through CommentBar's onChangeText below - without also updating
    // latestCommentRef here, onSubmit's `latestCommentRef.current ||
    // commentText` would keep using the stale pre-mention-insert text (e.g.
    // "@tunna" instead of "@tunnaduong ") since the ref wins when truthy.
    onChange: (text) => {
      latestCommentRef.current = text;
      setCommentText(text);
    },
    fetchSuggestions: getMentionSuggestions,
  });

  const { mentionProps: editMentionProps, suggestions: editSuggestions, onSelectMention: onSelectEditMention, loading: editSuggestionsLoading } = useMentionInput({
    value: editingCommentText,
    onChange: setEditingCommentText,
    fetchSuggestions: getMentionSuggestions,
  });

  const activeSuggestions = editingCommentId ? editSuggestions : commentSuggestions;
  const activeSuggestionsLoading = editingCommentId ? editSuggestionsLoading : commentSuggestionsLoading;
  const onSelectActiveMention = editingCommentId ? onSelectEditMention : onSelectCommentMention;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 10, 60],
    outputRange: [0, 0, 0],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  React.useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (post?.id) {
      incrementPostView(post.id);
    }
  }, [post?.id]);

  const handleOpenBottomSheet = () => {
    showBottomSheet(
      <View style={{ backgroundColor: theme.cardBackground }}>
        <TouchableOpacity
          onPress={() => {
            handleSavePost(!isSaved);
            hideBottomSheet();
          }}
        >
          <View className="flex-row items-center">
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={23}
              color={isSaved ? theme.primary : theme.text}
            />
            <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
              {isSaved ? t("post.unsave") : t("post.save")}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            shareLink(
              `https://chuyenbienhoa.com/${post?.author?.id}/posts/${generatePostSlug(post?.id, post?.title)}?source=share`,
            );
            hideBottomSheet();
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="share-outline" size={23} color={theme.text} />
            <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
              {t("post.share")}
            </Text>
          </View>
        </TouchableOpacity>
        {/*
        {isCurrentUser && (
          <TouchableOpacity onPress={() => {
            navigation.navigate("PostEditScreen", { postId: post?.id });
            hideBottomSheet();
          }}>
            <View className="flex-row items-center">
              <Ionicons name="lock-closed-outline" size={23} color={theme.text} />
              <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
                {t('post.privacy')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        */}
        {isCurrentUser && (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("PostEditScreen", { postId: post?.id });
              hideBottomSheet();
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="create-outline" size={23} color={theme.text} />
              <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
                {t("post.edit")}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {!isCurrentUser && (
          <TouchableOpacity
            onPress={() => {
              hideBottomSheet();
              setReportModalVisible(true);
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="flag-outline" size={23} color={"#ef4444"} />
              <Text
                style={{ padding: 12, fontSize: 17 }}
                className="text-red-500"
              >
                {t("post.report")}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {isCurrentUser && (
          <TouchableOpacity onPress={handleDeletePost}>
            <View className="flex-row items-center">
              <Ionicons name="trash-outline" size={23} color={"#ef4444"} />
              <Text
                style={{ padding: 12, fontSize: 17 }}
                className="text-red-500"
              >
                {t("post.delete")}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>,
    );
  };

  const shareLink = async (link) => {
    try {
      await Share.share({
        message: link,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDeletePost = async () => {
    Alert.alert(t("post.deleteConfirmTitle"), t("post.deleteConfirmBody"), [
      {
        text: t("post.deleteAction"),
        style: "destructive",
        onPress: async () => {
          await deletePost(post.id);
          // refresh the post list
          setFeed((prevPosts) => prevPosts.filter((p) => p.id !== post.id));
          if (screenName)
            setRecentPostsProfile((prevPosts) =>
              prevPosts.filter((p) => p.id !== post.id),
            );
          hideBottomSheet();
          navigation.goBack();
        },
      },
      {
        text: t("post.editAction"),
        style: "default",
        onPress: () => {
          navigation.navigate("PostEditScreen", { postId: post.id });
          hideBottomSheet();
        },
      },
      {
        text: t("settings.cancel"),
        style: "cancel",
      },
    ]);
  };

  const fetchData = async () => {
    try {
      setLoadingPost(true);
      const response = await getPostDetail(postId); // Fetch post data from API
      const { post: topic, comments } = response.data;

      if (!item && !post) {
        setPost(topic); // Set the post data in state
        setVotes(topic?.votes ?? []); // Set the votes in state
        setIsSaved(topic?.is_saved ?? false); // Set the saved status in state
      }
      setPost(topic); // Update post state
      setVotes(topic?.votes ?? []); // Update votes state
      setIsSaved(topic?.is_saved ?? false); // Update saved status
      setComments(comments ?? []);

      if (highlightCommentId) {
        setHighlightedCommentId(highlightCommentId);
        setTimeout(() => {
          scrollToComment(highlightCommentId);
          setTimeout(() => setHighlightedCommentId(null), 2500);
        }, 600);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingPost(false);
    }
  };
  // Mirror for stable callbacks (see commentsRef above) that need to trigger
  // a refetch without taking fetchData itself as a dependency.
  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  const onRefresh = () => {
    setRefreshing(true);
    fetchData().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    });
  };

  const focusCommentInput = React.useCallback((id, name) => {
    const level = getCommentLevel(commentsRef.current, id);

    if (level >= 3) {
      // Trả lời cấp 4+ thì gán lại parentId là cấp 2
      const parentCommentId = findParentIdForReply(commentsRef.current, id);
      setParentId(parentCommentId ?? id); // fallback nếu không tìm được
    } else {
      setParentId(id);
    }

    setReplyingTo(name);

    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }

    setTimeout(() => {
      scrollToComment(id);
    }, 100);
  }, []);

  const getCommentLevel = (comments, id, currentLevel = 1) => {
    for (const comment of comments) {
      if (comment.id === id) return currentLevel;
      if (comment.replies?.length > 0) {
        const level = getCommentLevel(comment.replies, id, currentLevel + 1);
        if (level !== null) return level;
      }
    }
    return null;
  };

  const scrollToComment = (id) => {
    if (commentRefs.current[id]) {
      // FlatList's ref isn't a host node itself (unlike ScrollView) -
      // getScrollableNode() gets the underlying native scroll view that
      // measureLayout needs to measure against.
      const scrollNode = scrollViewRef.current?.getScrollableNode?.() ?? scrollViewRef.current;
      commentRefs.current[id].measureLayout(
        scrollNode,
        (x, y) => {
          scrollViewRef.current?.scrollToOffset({ offset: y, animated: true });
        },
        () => console.log("Error measuring layout"),
      );
    }
  };

  const handleVote = async (newVotes) => {
    // Update UI instantly
    setVotes(newVotes);

    // Update the FeedContext
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, votes: newVotes } : post,
      ),
    );

    if (screenName)
      setRecentPostsProfile((prevFeed) =>
        prevFeed.map((post) =>
          post.id === postId ? { ...post, votes: newVotes } : post,
        ),
      );

    setPost((prevPost) => ({
      ...prevPost,
      votes: newVotes,
    }));
  };

  const handleSavePost = async (newSavedStatus) => {
    setIsSaved(newSavedStatus); // Update UI instantly

    // Update the FeedContext
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, saved: newSavedStatus } : post,
      ),
    );

    if (screenName)
      setRecentPostsProfile((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, saved: newSavedStatus } : post,
        ),
      );

    setPost((prevPost) => ({
      ...prevPost,
      saved: newSavedStatus,
    }));
  };

  const findParentIdForReply = (comments, targetId, currentParentId = null) => {
    for (const comment of comments) {
      if (comment.id === targetId) {
        // Return the parent ID if the target comment is found
        return currentParentId;
      }
      if (comment.replies?.length > 0) {
        // Recursively search in the replies
        const parentId = findParentIdForReply(
          comment.replies,
          targetId,
          comment.id,
        );
        if (parentId !== null) {
          return parentId;
        }
      }
    }
    return null; // Return null if the target comment is not found
  };

  const MAX_COMMENT_IMAGES = 10;

  const launchCommentImagePicker = async (source) => {
    const remaining = MAX_COMMENT_IMAGES - selectedCommentImages.length;
    if (remaining <= 0) return;
    try {
      let result;
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t("common.error"), t("chatConversation.cameraPermissionDenied", "Không có quyền truy cập camera."));
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          allowsMultipleSelection: true,
          selectionLimit: remaining,
        });
      }
      if (!result.canceled && result.assets?.length > 0) {
        const normalized = await Promise.all(
          result.assets.map(async (asset) => {
            try {
              const r = await manipulateAsync(asset.uri, [], { compress: 0.85, format: SaveFormat.JPEG });
              return r.uri;
            } catch (_) {
              return asset.uri;
            }
          })
        );
        setSelectedCommentImages((prev) => [...prev, ...normalized].slice(0, MAX_COMMENT_IMAGES));
      }
    } catch (e) {
      console.error("Error picking comment image:", e);
    }
  };

  const pickCommentImage = () => {
    const takePhoto = t("chatConversation.takePhoto", "Chụp ảnh");
    const chooseLibrary = t("chatConversation.chooseFromLibrary", "Chọn từ thư viện");
    const cancel = t("common.cancel", "Hủy");
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [cancel, takePhoto, chooseLibrary], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) launchCommentImagePicker("camera");
          else if (idx === 2) launchCommentImagePicker("library");
        },
      );
    } else {
      Alert.alert(t("chatConversation.attachMedia", "Đính kèm ảnh"), null, [
        { text: takePhoto, onPress: () => launchCommentImagePicker("camera") },
        { text: chooseLibrary, onPress: () => launchCommentImagePicker("library") },
        { text: cancel, style: "cancel" },
      ]);
    }
  };

  const onSubmit = async () => {
    // Handle editing comment
    if (editingCommentId) {
      await handleUpdateComment();
      return;
    }

    // Handle new comment or reply
    const rawText = latestCommentRef.current || commentText;
    const trimmedText = rawText.trim();
    if ((!trimmedText && selectedCommentImages.length === 0) || isSubmitting) return;

    let replyingToId = parentId;

    setIsSubmitting(true);
    try {
      const params = {
        comment: trimmedText || undefined,
        topic_id: post.id,
        replying_to: replyingToId,
        is_anonymous: isAnonymousComment,
      };
      // Send comment to API
      const resp = selectedCommentImages.length > 0
        ? await commentPostWithImages(post.id, params, selectedCommentImages)
        : await commentPost(post.id, params);

      // Reset input state
      setCommentText("");
      setSelectedCommentImages([]);
      setIsAnonymousComment(false);
      setParentId(null);
      setReplyingTo(null);

      const response = await getPostDetail(postId);
      if (response.data) {
        setTimeout(() => {
          scrollToComment(resp.data.id);
        }, 100);
        const updatedPostData = response.data.post;
        setPost(updatedPostData);
        setVotes(updatedPostData?.votes ?? []);
        setIsSaved(updatedPostData?.is_saved ?? false);
        setComments(response.data.comments ?? []);

        // IMPORTANT: Update FeedContext
        setFeed((prevFeed) =>
          prevFeed.map((feedItem) =>
            feedItem.id === postId
              ? {
                  ...feedItem,
                  comments:
                    roundToNearestFive(
                      response.data.comments
                        ? response.data.comments.length
                        : parseInt(
                            updatedPostData.comments?.replace(/\D/g, ""),
                            10,
                          ) || 0,
                    ) + "+",
                }
              : feedItem,
          ),
        );

        if (screenName) {
          setRecentPostsProfile((prevFeed) =>
            prevFeed.map((feedItem) =>
              feedItem.id === postId
                ? {
                    ...feedItem,
                    comments:
                      roundToNearestFive(
                        response.data.comments
                          ? response.data.comments.length
                          : parseInt(
                              updatedPostData.comments?.replace(/\D/g, ""),
                              10,
                            ) || 0,
                      ) + "+",
                  }
                : feedItem,
            ),
          );
        }
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportSubmit = async (reason) => {
    try {
      const reportedUserId =
        post?.author?.id || post?.user_id || post?.uid || post?.userid;
      await reportUser({
        reported_user_id: reportedUserId,
        topic_id: post.id,
        reason,
      });
      Alert.alert(t("post.reportSuccessTitle"), t("post.reportSuccessBody"));
    } catch (e) {
      Alert.alert(
        t("profile.errorTitle"),
        e.response?.data?.message || e.message || t("post.reportError"),
      );
    }
  };

  // Define this outside the onSubmit function
  const roundToNearestFive = (count) => {
    if (count <= 5) {
      // If count is 5 or less, return exact count with leading zero
      return count.toString().padStart(2, "0");
    } else {
      // Round DOWN to the nearest multiple of 5 for counts above 5
      // For example: 6-10 → "05+", 11-15 → "10+", 16-20 → "15+"
      const rounded = Math.floor(count / 5) * 5;
      return rounded.toString().padStart(2, "0");
    }
  };

  const handleCommentVote = React.useCallback(async (commentId, voteValue) => {
    try {
      // Optimistically update the UI
      setComments((prevComments) => {
        // Helper function to update votes recursively
        const updateVotesRecursively = (comments) => {
          return comments.map((comment) => {
            // If this is the target comment, update its votes
            if (comment.id === commentId) {
              const votes = comment.votes ?? [];
              const existingVote = votes.find(
                (vote) => vote.username === username,
              );

              let newVotes = [...votes];

              if (existingVote) {
                if (existingVote.vote_value === voteValue) {
                  // User is undoing their vote
                  newVotes = votes.filter((vote) => vote.username !== username);
                } else {
                  // User is changing their vote
                  newVotes = votes.map((vote) =>
                    vote.username === username
                      ? { ...vote, vote_value: voteValue }
                      : vote,
                  );
                }
              } else {
                // User is voting for the first time
                newVotes = [...votes, { username, vote_value: voteValue }];
              }

              return { ...comment, votes: newVotes };
            }

            // If this comment has replies, recursively check them
            if (comment.replies && comment.replies.length > 0) {
              return {
                ...comment,
                replies: updateVotesRecursively(comment.replies),
              };
            }

            // If neither condition matches, return the comment unchanged
            return comment;
          });
        };

        // Start the recursive update from the top level
        return updateVotesRecursively(prevComments);
      });

      // Call the API to update the vote
      await voteComment(commentId, {
        vote_value: voteValue,
      });

      // If the API call is successful, the optimistic update is correct
    } catch (error) {
      console.error("Error voting on comment:", error);
      // If the API call fails, revert the optimistic update
      // You might want to show an error message to the user as well
      fetchDataRef.current(); // Re-fetch the data to revert the changes
    }
  }, [username]);

  const handleVoteReply = (commentId, replyId, voteValue) => {
    setComments((prevComments) =>
      prevComments.map((comment) => {
        if (comment.id === commentId) {
          // Found the parent comment, now update the specific reply
          const replies = comment.replies ?? [];
          return {
            ...comment,
            replies: replies.map((reply) => {
              if (reply.id === replyId) {
                // Apply the same voting logic to the reply
                const votes = reply.votes ?? [];
                const existingVote = votes.find(
                  (vote) => vote.username === username,
                );

                let newVotes = [...votes];

                if (existingVote) {
                  if (existingVote.vote_value === voteValue) {
                    // User is undoing their vote
                    newVotes = votes.filter(
                      (vote) => vote.username !== username,
                    );
                  } else {
                    // User is changing their vote
                    newVotes = votes.map((vote) =>
                      vote.username === username
                        ? { ...vote, vote_value: voteValue }
                        : vote,
                    );
                  }
                } else {
                  // User is voting for the first time
                  newVotes = [...votes, { username, vote_value: voteValue }];
                }

                return { ...reply, votes: newVotes };
              }
              return reply;
            }),
          };
        }
        return comment;
      }),
    );
  };

  const findCommentById = (comments, targetId) => {
    for (const comment of comments) {
      if (comment.id === targetId) {
        return comment;
      }
      if (comment.replies?.length > 0) {
        const found = findCommentById(comment.replies, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleLongPressComment = React.useCallback((commentId) => {
    const comment = findCommentById(commentsRef.current, commentId);
    if (!comment) return;

    const isCommentOwner = comment.author?.username === username;
    if (!isCommentOwner) return;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t("settings.cancel"),
            t("post.editComment"),
            t("post.deleteComment"),
          ],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Edit comment
            setEditingCommentId(commentId);
            setEditingCommentText(comment.content || "");
            setIsAnonymousComment(!!comment.is_anonymous);
            setParentId(null);
            setReplyingTo(null);
            if (commentInputRef.current) {
              commentInputRef.current.focus();
            }
          } else if (buttonIndex === 2) {
            // Delete comment
            handleDeleteCommentRef.current(commentId);
          }
        },
      );
    } else {
      Alert.alert(
        t("post.optionsTitle"),
        t("post.selectAction"),
        [
          {
            text: t("settings.cancel"),
            style: "cancel",
          },
          {
            text: t("post.editComment"),
            onPress: () => {
              setEditingCommentId(commentId);
              setEditingCommentText(comment.content || "");
              setIsAnonymousComment(!!comment.is_anonymous);
              setParentId(null);
              setReplyingTo(null);
              if (commentInputRef.current) {
                commentInputRef.current.focus();
              }
            },
          },
          {
            text: t("post.deleteComment"),
            style: "destructive",
            onPress: () => handleDeleteCommentRef.current(commentId),
          },
        ],
        { cancelable: true },
      );
    }
  }, [username, t]);

  const handleDeleteComment = async (commentId) => {
    Alert.alert(t("post.deleteComment"), t("post.deleteCommentConfirm"), [
      {
        text: t("settings.cancel"),
        style: "cancel",
      },
      {
        text: t("post.deleteAction"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment(commentId);
            // Refresh comments
            const response = await getPostDetail(postId);
            if (response.data) {
              setComments(response.data.comments ?? []);
              const updatedPostData = response.data.post;
              setPost(updatedPostData);

              // Update FeedContext
              setFeed((prevFeed) =>
                prevFeed.map((feedItem) =>
                  feedItem.id === postId
                    ? {
                        ...feedItem,
                        comments:
                          roundToNearestFive(
                            response.data.comments
                              ? response.data.comments.length
                              : parseInt(
                                  updatedPostData.comments?.replace(/\D/g, ""),
                                  10,
                                ) || 0,
                          ) + "+",
                      }
                    : feedItem,
                ),
              );

              if (screenName) {
                setRecentPostsProfile((prevFeed) =>
                  prevFeed.map((feedItem) =>
                    feedItem.id === postId
                      ? {
                          ...feedItem,
                          comments:
                            roundToNearestFive(
                              response.data.comments
                                ? response.data.comments.length
                                : parseInt(
                                    updatedPostData.comments?.replace(
                                      /\D/g,
                                      "",
                                    ),
                                    10,
                                  ) || 0,
                            ) + "+",
                        }
                      : feedItem,
                  ),
                );
              }
            }
          } catch (error) {
            console.error("Error deleting comment:", error);
            Alert.alert(t("profile.errorTitle"), t("post.deleteCommentError"));
          }
        },
      },
    ]);
  };
  const handleDeleteCommentRef = useRef(handleDeleteComment);
  useEffect(() => {
    handleDeleteCommentRef.current = handleDeleteComment;
  });

  const handleUpdateComment = async () => {
    if (!editingCommentText.trim() || isSubmitting || !editingCommentId) return;

    setIsSubmitting(true);
    try {
      await updateComment(editingCommentId, {
        comment: editingCommentText.trim(),
        is_anonymous: isAnonymousComment,
      });

      // Reset editing state
      setEditingCommentId(null);
      setEditingCommentText("");
      setIsAnonymousComment(false);

      // Refresh comments
      const response = await getPostDetail(postId);
      if (response.data) {
        setComments(response.data.comments ?? []);
        const updatedPostData = response.data.post;
        setPost(updatedPostData);

        // Update FeedContext
        setFeed((prevFeed) =>
          prevFeed.map((feedItem) =>
            feedItem.id === postId
              ? {
                  ...feedItem,
                  comments:
                    roundToNearestFive(
                      response.data.comments
                        ? response.data.comments.length
                        : parseInt(
                            updatedPostData.comments?.replace(/\D/g, ""),
                            10,
                          ) || 0,
                    ) + "+",
                }
              : feedItem,
          ),
        );

        if (screenName) {
          setRecentPostsProfile((prevFeed) =>
            prevFeed.map((feedItem) =>
              feedItem.id === postId
                ? {
                    ...feedItem,
                    comments:
                      roundToNearestFive(
                        response.data.comments
                          ? response.data.comments.length
                          : parseInt(
                              updatedPostData.comments?.replace(/\D/g, ""),
                              10,
                            ) || 0,
                      ) + "+",
                  }
                : feedItem,
            ),
          );
        }
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      Alert.alert(t("profile.errorTitle"), t("post.editCommentError"));
    } finally {
      setIsSubmitting(false);
    }
  };


  // Froggy loading animation
  const bounceValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (post == null) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceValue, {
            toValue: -20,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(bounceValue, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [post]);

  if (loadingPost) {
    return (
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
          flex: 1,
        }}
      >
        <CustomLoading size={90} />
      </View>
    );
  }

  return post == null ? (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.background,
        flex: 1,
      }}
    >
      <CustomLoading size={90} />
    </View>
  ) : (
    <>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {(activeSuggestions.length > 0 || activeSuggestionsLoading) && (
          <View
            style={{
              position: "absolute",
              bottom: (keyboardHeight || insets.bottom) + 72,
              left: 0,
              right: 0,
              zIndex: 50,
            }}
            pointerEvents="box-none"
          >
            <MentionSuggestions
              suggestions={activeSuggestions}
              onSelect={onSelectActiveMention}
              loading={activeSuggestionsLoading}
            />
          </View>
        )}
        {/* Floating header */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.background,
              opacity: headerBgOpacity,
            }}
          />
          <View
            style={{
              paddingTop: insets.top,
              paddingBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              height: 64 + insets.top,
            }}
          >
            <View style={{ width: 44 }}>
              <LiquidButton
                size={44}
                scrollY={scrollY}
                providerId="PostScreen"
                onPress={() => navigation.goBack()}
              >
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
              {t("post.details")}
            </Animated.Text>
            <View style={{ width: 44, alignItems: "flex-end" }}>
              <LiquidButton
                size={44}
                scrollY={scrollY}
                providerId="PostScreen"
                onPress={handleOpenBottomSheet}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={24}
                  color={theme.primary}
                />
              </LiquidButton>
            </View>
          </View>
        </View>

        {refreshing && (
          <View
            style={{
              position: "absolute",
              top: 15,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <LottieView
              source={require("../../../assets/refresh.json")}
              style={{ width: 40, height: 40 }}
              ref={lottieRef}
              loop
              autoPlay
            />
          </View>
        )}
        <AndroidGlassBackdrop providerId="PostScreen" style={{ flex: 1 }}>
        <Animated.FlatList
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={Animated.event(
            // headerBgOpacity/headerTitleOpacity/LiquidButton's own scrollY
            // interpolations only ever drive `opacity`, so this can run
            // fully on the native/UI thread instead of dispatching a scroll
            // event to JS on every frame.
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          contentContainerStyle={{
            paddingTop: 64 + insets.top,
            // KeyboardStickyView (below) floats the comment input above the
            // keyboard independently via its own reanimated tracking, but
            // this FlatList's own bottom padding still needs to grow while
            // the keyboard is open so the last comment doesn't end up
            // hidden behind the now-taller floating input bar.
            paddingBottom: (keyboardHeight || insets.bottom),
            backgroundColor: theme.background,
            flexGrow: 1,
          }}
          ref={scrollViewRef}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="transparent"
              colors={["transparent"]}
              progressBackgroundColor="transparent"
              style={{ backgroundColor: "transparent" }}
            />
          }
          // Windowing is the actual perf win over the old plain ScrollView -
          // only comments near the viewport stay mounted. initialNumToRender
          // is generous so scrollToComment's measureLayout (used for
          // scroll-to-highlighted-comment deep links) can usually find its
          // target already mounted without needing to scroll first.
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          data={comments}
          keyExtractor={(comment) => String(comment.id)}
          ListHeaderComponent={
            <>
              <PostItem
                navigation={navigation}
                item={post}
                single={true}
                votes={votes}
                saved={isSaved}
                onVote={handleVote}
                onSave={handleSavePost}
                screenName={screenName}
                isActive={autoplayVideos}
              />
              {/* comment section */}
              <View style={{ paddingHorizontal: 15 }}>
                <Text
                  style={{
                    fontWeight: "bold",
                    fontSize: 20,
                    marginVertical: 16,
                    color: theme.text,
                  }}
                >
                  {t("post.commentsTitle")}
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 15 }}>
              <Text style={{ color: theme.subText }}>
                {t("post.noComments")}
              </Text>
            </View>
          }
          renderItem={({ item: comment }) => (
            <View style={{ paddingHorizontal: 15 }}>
              <Comment
                comment={comment}
                ref={(ref) => (commentRefs.current[comment.id] = ref)}
                commentRefs={commentRefs}
                highlightedCommentId={highlightedCommentId}
                isDarkMode={isDarkMode}
                theme={theme}
                t={t}
                username={username}
                navigation={navigation}
                focusCommentInput={focusCommentInput}
                handleCommentVote={handleCommentVote}
                setCommentVotesModal={setCommentVotesModal}
                setImageViewer={setImageViewer}
                handleLongPressComment={handleLongPressComment}
              />
            </View>
          )}
          ListFooterComponent={
            // Combines the original 16px block spacing (after the last
            // comment/empty-state text) with the 50px spacer that used to
            // sit below it, before the floating comment input.
            <View style={{ height: 50, marginTop: 16, backgroundColor: "transparent" }} />
          }
        />
        </AndroidGlassBackdrop>
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmit={handleReportSubmit}
        />
        <CommentVotesModal
          visible={commentVotesModal.visible}
          commentId={commentVotesModal.commentId}
          commentPreview={commentVotesModal.commentPreview}
          navigation={navigation}
          onClose={() => setCommentVotesModal({ visible: false, commentId: null, commentPreview: "" })}
        />
        <ImageView
          images={imageViewer.images}
          imageIndex={imageViewer.index}
          visible={imageViewer.visible}
          onRequestClose={() => setImageViewer({ visible: false, images: [], index: 0 })}
          HeaderComponent={() => (
            <View style={{ paddingTop: insets.top + 8, paddingRight: 12, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setImageViewer({ visible: false, images: [], index: 0 })}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#00000077",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                hitSlop={{ top: 16, left: 16, bottom: 16, right: 16 }}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        />

        {Platform.OS === 'android' || Platform.OS === 'ios' ? (
          <KeyboardStickyView
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "transparent",
              zIndex: 5,
              paddingBottom: insets.bottom,
            }}
            // The `opened` lift is intentionally 20px short of the keyboard's
            // real height - that gap is meant to be absorbed by paddingBottom
            // (insets.bottom) above, which is ~34 on notched iPhones/Android
            // gesture nav. On devices with no bottom safe area (iPhone
            // 6s/7/8/SE - physical home button, insets.bottom === 0) nothing
            // absorbs it, so the bar renders 20px below the keyboard's top
            // edge. Drop the offset to 0 there so it lifts exactly to the
            // keyboard's edge instead.
            offset={{ opened: insets.bottom > 0 ? 20 : 0 }}
          >
            <CommentBar
              providerId="PostScreen"
              statusText={
                parentId || editingCommentId
                  ? editingCommentId
                    ? t("post.editingComment")
                    : t("post.replyingTo", { username: replyingTo })
                  : null
              }
              onClearStatus={() => {
                setParentId(null);
                setReplyingTo(null);
                setEditingCommentId(null);
                setEditingCommentText("");
                setCommentText("");
                setSelectedCommentImages([]);
                setIsAnonymousComment(false);
              }}
              value={editingCommentId ? editingCommentText : commentText}
              onChangeText={(text) => {
                if (!editingCommentId) latestCommentRef.current = text;
                (editingCommentId ? editMentionProps.onChangeText : commentMentionProps.onChangeText)(text);
              }}
              placeholderText={t("post.commentPlaceholder")}
              onSubmit={onSubmit}
              ref={commentInputRef}
              isSubmitting={isSubmitting}
              disabled={
                editingCommentId
                  ? !editingCommentText.trim()
                  : !commentText.trim() && selectedCommentImages.length === 0
              }
              isAnonymous={isAnonymousComment}
              onToggleAnonymous={() => setIsAnonymousComment(!isAnonymousComment)}
              anonymousDisabled={!!editingCommentId}
              onPickImage={!editingCommentId ? pickCommentImage : undefined}
              selectedImages={!editingCommentId ? selectedCommentImages : undefined}
              onClearImage={!editingCommentId ? (index) => setSelectedCommentImages((prev) => prev.filter((_, i) => i !== index)) : undefined}
            />
          </KeyboardStickyView>
        ) : (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "transparent",
              zIndex: 5,
              paddingBottom: insets.bottom,
            }}
          >
            <CommentBar
              providerId="PostScreen"
              statusText={
                parentId || editingCommentId
                  ? editingCommentId
                    ? t("post.editingComment")
                    : t("post.replyingTo", { username: replyingTo })
                  : null
              }
              onClearStatus={() => {
                setParentId(null);
                setReplyingTo(null);
                setEditingCommentId(null);
                setEditingCommentText("");
                setCommentText("");
                setSelectedCommentImages([]);
                setIsAnonymousComment(false);
              }}
              value={editingCommentId ? editingCommentText : commentText}
              onChangeText={(text) => {
                if (!editingCommentId) latestCommentRef.current = text;
                (editingCommentId ? editMentionProps.onChangeText : commentMentionProps.onChangeText)(text);
              }}
              placeholderText={t("post.commentPlaceholder")}
              onSubmit={onSubmit}
              ref={commentInputRef}
              isSubmitting={isSubmitting}
              disabled={
                editingCommentId
                  ? !editingCommentText.trim()
                  : !commentText.trim() && selectedCommentImages.length === 0
              }
              isAnonymous={isAnonymousComment}
              onToggleAnonymous={() => setIsAnonymousComment(!isAnonymousComment)}
              anonymousDisabled={!!editingCommentId}
              onPickImage={!editingCommentId ? pickCommentImage : undefined}
              selectedImages={!editingCommentId ? selectedCommentImages : undefined}
              onClearImage={!editingCommentId ? (index) => setSelectedCommentImages((prev) => prev.filter((_, i) => i !== index)) : undefined}
            />
          </View>
        )}
      </View>
    </>
  );
};

export default PostScreen;
