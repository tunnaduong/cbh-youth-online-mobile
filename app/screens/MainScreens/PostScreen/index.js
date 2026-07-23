import React, {
  useContext,
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
} from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Text,
  Pressable,
  Image,
  ActionSheetIOS,
  KeyboardAvoidingView,
  Animated,
  RefreshControl,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  commentPost,
  deletePost,
  getPostDetail,
  incrementPostView,
  voteComment,
  updateComment,
  deleteComment,
} from "../../../services/api/Api";
import CommentBar from "../../../components/CommentBar";
import LiquidButton from "../../../components/LiquidButton";
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
import {
  KeyboardChatScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";

const PostScreen = ({ route, navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { item, postId, screenName } = route.params; // Destructure item from route.params
  const { username, profileName, userInfo } = useContext(AuthContext);
  const [votes, setVotes] = useState(item?.votes ?? []); // Local vote state
  const [isSaved, setIsSaved] = useState(
    item?.saved ?? item?.is_saved ?? false,
  );
  const [post, setPost] = useState(item ?? null);
  const [comments, setComments] = useState([]); // Local comment state
  const [commentText, setCommentText] = useState("");
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);
  const [parentId, setParentId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const commentInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const commentRefs = useRef({});
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
  const insets = useSafeAreaInsets();
  const headerHeight = 50 + insets.top;
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const lottieRef = useRef(null);

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
    if (post) {
      incrementPostView(post.id);
    }
  }, [post]);

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
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingPost(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
      }, 1000);
    });
  };

  const focusCommentInput = (id, name) => {
    const level = getCommentLevel(comments, id);

    if (level >= 3) {
      // Trả lời cấp 4+ thì gán lại parentId là cấp 2
      const parentCommentId = findParentIdForReply(comments, id);
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
  };

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
      commentRefs.current[id].measureLayout(
        scrollViewRef.current,
        (x, y) => {
          scrollViewRef.current.scrollTo({ y, animated: true });
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

  const onSubmit = async () => {
    // Handle editing comment
    if (editingCommentId) {
      await handleUpdateComment();
      return;
    }

    // Handle new comment or reply
    if (!commentText.trim() || isSubmitting) return;

    let replyingToId = parentId;

    setIsSubmitting(true);
    try {
      // Send comment to API
      const resp = await commentPost(post.id, {
        comment: commentText.trim(),
        topic_id: post.id,
        replying_to: replyingToId,
        is_anonymous: isAnonymousComment,
      });

      // Reset input state
      setCommentText("");
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

  const handleCommentVote = async (commentId, voteValue) => {
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
      fetchData(); // Re-fetch the data to revert the changes
    }
  };

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

  const handleLongPressComment = (commentId) => {
    const comment = findCommentById(comments, commentId);
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
            handleDeleteComment(commentId);
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
            onPress: () => handleDeleteComment(commentId),
          },
        ],
        { cancelable: true },
      );
    }
  };

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

  const Comment = React.forwardRef(
    ({ comment, level = 0, border = false }, ref) => {
      if (!comment || !comment.id) {
        return null;
      }

      const votes = comment.votes ?? [];
      const author = comment.author ?? {};
      const content = comment.content ?? "";
      const replies = comment.replies ?? [];

      return (
        <View
          ref={ref} // Attach ref here
          style={{
            marginLeft: level * 20, // Indent based on the nesting level
          }}
        >
          {/* Render the main comment */}

          <Pressable
            onLongPress={() => handleLongPressComment(comment.id)}
            delayLongPress={500}
          >
            <View
              style={[
                {
                  paddingVertical: 10,
                  flexDirection: "row",
                  gap: 10,
                },
                border && {
                  borderLeftWidth: 3,
                  borderLeftColor: isDarkMode ? "#2e4e2a" : "#e4eee3",
                  paddingLeft: 10,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  author.username &&
                  !comment.is_anonymous &&
                  navigation.navigate("ProfileScreen", {
                    username: author.username,
                  })
                }
                disabled={!author.username || !!comment.is_anonymous}
              >
                <View
                  style={{
                    backgroundColor: theme.background,
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {comment.is_anonymous ? (
                    <View
                      style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: theme.iconBackground,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: theme.text,
                          fontWeight: "bold",
                          fontSize: 20,
                        }}
                      >
                        ?
                      </Text>
                    </View>
                  ) : author.username ? (
                    <Image
                      source={{
                        uri: `https://api.chuyenbienhoa.com/v1.0/users/${author.username}/avatar`,
                      }}
                      style={{ width: 40, height: 40, borderRadius: 30 }}
                    />
                  ) : null}
                </View>
              </Pressable>
              <View style={{ flexShrink: 1 }}>
                <Pressable
                  onPress={() =>
                    author.username &&
                    !comment.is_anonymous &&
                    navigation.navigate("ProfileScreen", {
                      username: author.username,
                    })
                  }
                  disabled={!author.username || !!comment.is_anonymous}
                >
                  <Text style={{ fontWeight: "bold", color: theme.primary }}>
                    {comment.is_anonymous
                      ? t("post.anonymousUser")
                      : author.profile_name || author.username || ""}
                    {author.verified && !comment.is_anonymous && (
                      <View>
                        <Verified
                          width={15}
                          height={15}
                          color={theme.primary}
                          style={{ marginBottom: -3 }}
                        />
                      </View>
                    )}
                  </Text>
                </Pressable>
                {comment.deleted_parent_username && (
                  <View
                    style={{
                      marginVertical: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isDarkMode ? "#1f2937" : "#f3f4f6",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: theme.subText }}>
                      {t("post.replyDeletedPrefix")}{" "}
                      <Text style={{ fontWeight: "600", color: theme.text }}>
                        {author.profile_name ||
                          author.username ||
                          t("post.anonymous")}
                      </Text>{" "}
                      {t("post.replyDeletedSuffix")}
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    flexShrink: 1,
                    color: theme.text,
                  }}
                >
                  {String(content)}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Text style={{ fontSize: 12, color: "gray" }}>
                    {comment.created_at ? formatTime(comment.created_at) : ""}
                    {comment.is_edited ? ` (${t("post.edited")})` : ""} ·
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      focusCommentInput(
                        comment.id,
                        comment.is_anonymous
                          ? t("post.anonymousUser")
                          : author.profile_name || author.username || "",
                        level,
                      )
                    }
                  >
                    <Text
                      style={{
                        color: theme.subText,
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      {" "}
                      {t("post.reply")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="flex-1 items-end shrink-0">
                <View>
                  <TouchableOpacity
                    onPress={() => handleCommentVote(comment.id, 1)}
                  >
                    <Ionicons
                      name="arrow-up-outline"
                      size={18}
                      color={
                        votes.some(
                          (vote) =>
                            vote.username === username && vote.vote_value === 1,
                        )
                          ? "#22c55e"
                          : theme.subText
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      { fontSize: 14, fontWeight: "600" },
                      { color: theme.subText, textAlign: "center" },
                      votes.some(
                        (vote) =>
                          vote.username === username && vote.vote_value === 1,
                      )
                        ? { color: "#22c55e" }
                        : votes.some(
                              (vote) =>
                                vote.username === username &&
                                vote.vote_value === -1,
                            )
                          ? { color: "#ef4444" }
                          : { color: theme.subText },
                    ]}
                  >
                    {votes.reduce(
                      (acc, vote) => acc + (vote.vote_value || 0),
                      0,
                    )}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleCommentVote(comment.id, -1)}
                  >
                    <Ionicons
                      name="arrow-down-outline"
                      size={18}
                      color={
                        votes.some(
                          (vote) =>
                            vote.username === username &&
                            vote.vote_value === -1,
                        )
                          ? "#ef4444"
                          : theme.subText
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Render replies recursively */}
          {replies.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {replies.map((reply) => (
                <Comment
                  key={reply.id}
                  comment={reply}
                  level={level + 1}
                  border={true}
                  ref={(ref) => (commentRefs.current[reply.id] = ref)}
                />
              ))}
            </View>
          )}
        </View>
      );
    },
  );

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
        <KeyboardChatScrollView
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          contentContainerStyle={{
            paddingTop: 64 + insets.top,
            paddingBottom: insets.bottom,
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
        >
          <PostItem
            navigation={navigation}
            item={post}
            single={true}
            votes={votes}
            saved={isSaved}
            onVote={handleVote}
            onSave={handleSavePost}
            screenName={screenName}
          />
          {/* comment section */}
          <View style={{ paddingHorizontal: 15, marginBottom: 16 }}>
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
            {comments.length === 0 ? (
              <Text style={{ color: theme.subText }}>
                {t("post.noComments")}
              </Text>
            ) : (
              comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  ref={(ref) => (commentRefs.current[comment.id] = ref)}
                />
              ))
            )}
          </View>
          {/* Spacer to prevent comment bar from covering last comments */}
          <View style={{ height: 50, backgroundColor: "transparent" }} />
        </KeyboardChatScrollView>
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmit={handleReportSubmit}
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
            offset={{ opened: 20 }}
          >
            <CommentBar
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
                setIsAnonymousComment(false);
              }}
              value={editingCommentId ? editingCommentText : commentText}
              onChangeText={(text) =>
                editingCommentId
                  ? setEditingCommentText(text)
                  : setCommentText(text)
              }
              placeholderText={t("post.commentPlaceholder")}
              onSubmit={onSubmit}
              ref={commentInputRef}
              isSubmitting={isSubmitting}
              disabled={
                editingCommentId
                  ? !editingCommentText.trim()
                  : !commentText.trim()
              }
              isAnonymous={isAnonymousComment}
              onToggleAnonymous={() => setIsAnonymousComment(!isAnonymousComment)}
              anonymousDisabled={!!editingCommentId}
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
                setIsAnonymousComment(false);
              }}
              value={editingCommentId ? editingCommentText : commentText}
              onChangeText={(text) =>
                editingCommentId
                  ? setEditingCommentText(text)
                  : setCommentText(text)
              }
              placeholderText={t("post.commentPlaceholder")}
              onSubmit={onSubmit}
              ref={commentInputRef}
              isSubmitting={isSubmitting}
              disabled={
                editingCommentId
                  ? !editingCommentText.trim()
                  : !commentText.trim()
              }
              isAnonymous={isAnonymousComment}
              onToggleAnonymous={() => setIsAnonymousComment(!isAnonymousComment)}
              anonymousDisabled={!!editingCommentId}
            />
          </View>
        )}
      </View>
    </>
  );
};

export default PostScreen;
