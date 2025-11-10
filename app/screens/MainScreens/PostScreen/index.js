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
  SafeAreaView,
  TouchableOpacity,
  Share,
  Alert,
  Text,
  Pressable,
  Image,
  Platform,
  ActionSheetIOS,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
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
import { FeedContext } from "../../../contexts/FeedContext";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useBottomSheet } from "../../../contexts/BottomSheetContext";
import PostItem from "../../../components/PostItem";
import Verified from "../../../assets/Verified";

const PostScreen = ({ route, navigation }) => {
  const { item, postId, screenName } = route.params; // Destructure item from route.params
  const { username, profileName, userInfo } = useContext(AuthContext);
  const [votes, setVotes] = useState(item?.votes ?? []); // Local vote state
  const [isSaved, setIsSaved] = useState(
    item?.saved ?? item?.is_saved ?? false
  );
  const [post, setPost] = useState(item ?? null);
  const [comments, setComments] = useState([]); // Local comment state
  const [commentText, setCommentText] = useState("");
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
  const isCurrentUser = post?.author?.username === username;

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
      <>
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
              color={isSaved ? "#000" : undefined}
            />
            <Text style={{ padding: 12, fontSize: 17 }}>
              {isSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            shareLink(
              `https://chuyenbienhoa.com/${post?.author?.username}/posts/${post?.id}?source=share`
            );
            hideBottomSheet();
          }}
        >
          <View className="flex-row items-center">
            <Ionicons name="share-outline" size={23} />
            <Text style={{ padding: 12, fontSize: 17 }}>Chia sẻ</Text>
          </View>
        </TouchableOpacity>
        {isCurrentUser && (
          <TouchableOpacity onPress={() => console.log("Privacy", post?.id)}>
            <View className="flex-row items-center">
              <Ionicons name="lock-closed-outline" size={23} />
              <Text style={{ padding: 12, fontSize: 17 }}>
                Cài đặt quyền riêng tư
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {isCurrentUser && (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("EditPostScreen", { postId: post?.id });
              hideBottomSheet();
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="create-outline" size={23} />
              <Text style={{ padding: 12, fontSize: 17 }}>
                Chỉnh sửa bài đăng
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => console.log("Report", post?.id)}>
          <View className="flex-row items-center">
            <Ionicons name="flag-outline" size={23} color={"#ef4444"} />
            <Text
              style={{ padding: 12, fontSize: 17 }}
              className="text-red-500"
            >
              Báo cáo
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
                Xóa bài viết
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </>
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
    Alert.alert(
      "Xóa bài viết này?",
      "Bạn có thể chỉnh sửa bài viết này thay vì xóa nó",
      [
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            await deletePost(post.id);
            // refresh the post list
            setFeed((prevPosts) => prevPosts.filter((p) => p.id !== post.id));
            if (screenName)
              setRecentPostsProfile((prevPosts) =>
                prevPosts.filter((p) => p.id !== post.id)
              );
            hideBottomSheet();
            navigation.goBack();
          },
        },
        {
          text: "Chỉnh sửa",
          style: "default",
          onPress: () => {
            navigation.navigate("EditPostScreen", { postId: post.id });
            hideBottomSheet();
          },
        },
        {
          text: "Hủy",
          style: "cancel",
        },
      ]
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleOpenBottomSheet}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#319527" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isSaved, post]);

  const fetchData = async () => {
    try {
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
      console.log(JSON.stringify(comments, null, 2));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
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
        () => console.log("Error measuring layout")
      );
    }
  };

  const handleVote = async (newVotes) => {
    // Update UI instantly
    setVotes(newVotes);

    // Update the FeedContext
    setFeed((prevFeed) =>
      prevFeed.map((post) =>
        post.id === postId ? { ...post, votes: newVotes } : post
      )
    );

    if (screenName)
      setRecentPostsProfile((prevFeed) =>
        prevFeed.map((post) =>
          post.id === postId ? { ...post, votes: newVotes } : post
        )
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
        post.id === postId ? { ...post, saved: newSavedStatus } : post
      )
    );

    if (screenName)
      setRecentPostsProfile((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId ? { ...post, saved: newSavedStatus } : post
        )
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
          comment.id
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
      });

      // Reset input state
      setCommentText("");
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
                            10
                          ) || 0
                    ) + "+",
                }
              : feedItem
          )
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
                              10
                            ) || 0
                      ) + "+",
                  }
                : feedItem
            )
          );
        }
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmitting(false);
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
                (vote) => vote.username === username
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
                      : vote
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
                  (vote) => vote.username === username
                );

                let newVotes = [...votes];

                if (existingVote) {
                  if (existingVote.vote_value === voteValue) {
                    // User is undoing their vote
                    newVotes = votes.filter(
                      (vote) => vote.username !== username
                    );
                  } else {
                    // User is changing their vote
                    newVotes = votes.map((vote) =>
                      vote.username === username
                        ? { ...vote, vote_value: voteValue }
                        : vote
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
      })
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
          options: ["Hủy", "Chỉnh sửa bình luận", "Xóa bình luận"],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Edit comment
            setEditingCommentId(commentId);
            setEditingCommentText(comment.content || "");
            setParentId(null);
            setReplyingTo(null);
            if (commentInputRef.current) {
              commentInputRef.current.focus();
            }
          } else if (buttonIndex === 2) {
            // Delete comment
            handleDeleteComment(commentId);
          }
        }
      );
    } else {
      Alert.alert(
        "Tùy chọn",
        "Chọn hành động",
        [
          {
            text: "Hủy",
            style: "cancel",
          },
          {
            text: "Chỉnh sửa bình luận",
            onPress: () => {
              setEditingCommentId(commentId);
              setEditingCommentText(comment.content || "");
              setParentId(null);
              setReplyingTo(null);
              if (commentInputRef.current) {
                commentInputRef.current.focus();
              }
            },
          },
          {
            text: "Xóa bình luận",
            style: "destructive",
            onPress: () => handleDeleteComment(commentId),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleDeleteComment = async (commentId) => {
    Alert.alert("Xóa bình luận", "Bạn có chắc chắn muốn xóa bình luận này?", [
      {
        text: "Hủy",
        style: "cancel",
      },
      {
        text: "Xóa",
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
                                  10
                                ) || 0
                          ) + "+",
                      }
                    : feedItem
                )
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
                                      ""
                                    ),
                                    10
                                  ) || 0
                            ) + "+",
                        }
                      : feedItem
                  )
                );
              }
            }
          } catch (error) {
            console.error("Error deleting comment:", error);
            Alert.alert("Lỗi", "Không thể xóa bình luận. Vui lòng thử lại.");
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
      });

      // Reset editing state
      setEditingCommentId(null);
      setEditingCommentText("");

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
                            10
                          ) || 0
                    ) + "+",
                }
              : feedItem
          )
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
                              10
                            ) || 0
                      ) + "+",
                  }
                : feedItem
            )
          );
        }
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      Alert.alert("Lỗi", "Không thể chỉnh sửa bình luận. Vui lòng thử lại.");
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
                  borderLeftColor: "#e4eee3",
                  paddingLeft: 10,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  author.username &&
                  navigation.navigate("ProfileScreen", {
                    username: author.username,
                  })
                }
              >
                <View
                  className="bg-white w-[42px] h-[42px] rounded-full overflow-hidden"
                  style={{
                    borderWidth: 1,
                    borderColor: "#dee2e6",
                  }}
                >
                  {author.username && (
                    <Image
                      source={{
                        uri: `https://api.chuyenbienhoa.com/v1.0/users/${author.username}/avatar`,
                      }}
                      style={{ width: 40, height: 40, borderRadius: 30 }}
                    />
                  )}
                </View>
              </Pressable>
              <View style={{ flexShrink: 1 }}>
                <Pressable
                  onPress={() =>
                    author.username &&
                    navigation.navigate("ProfileScreen", {
                      username: author.username,
                    })
                  }
                >
                  <Text style={{ fontWeight: "bold", color: "#319527" }}>
                    {author.profile_name || author.username || "Ẩn danh"}
                    {author.verified && (
                      <View>
                        <Verified
                          width={15}
                          height={15}
                          color={"#319527"}
                          style={{ marginBottom: -3 }}
                        />
                      </View>
                    )}
                  </Text>
                </Pressable>
                {/* Show notification if parent comment was deleted */}
                {comment.deleted_parent_username && (
                  <View
                    style={{
                      marginVertical: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: "#f3f4f6",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#e5e7eb",
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      Bình luận mà{" "}
                      <Text style={{ fontWeight: "600" }}>
                        {author.profile_name || author.username || "Ẩn danh"}
                      </Text>{" "}
                      đang phản hồi đã bị xóa
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    flexShrink: 1,
                  }}
                >
                  {String(content)}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Text style={{ fontSize: 12, color: "gray" }}>
                    {comment.created_at || ""} ·
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      focusCommentInput(
                        comment.id,
                        author.profile_name || author.username || "",
                        level
                      )
                    }
                  >
                    <Text className="text-gray-500 font-bold text-[12px]">
                      {" "}
                      Trả lời
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
                            vote.username === username && vote.vote_value === 1
                        )
                          ? "#22c55e"
                          : "#9ca3af"
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      { fontSize: 14, fontWeight: "600" },
                      { color: "#9ca3af", textAlign: "center" },
                      votes.some(
                        (vote) =>
                          vote.username === username && vote.vote_value === 1
                      )
                        ? { color: "#22c55e" }
                        : votes.some(
                            (vote) =>
                              vote.username === username &&
                              vote.vote_value === -1
                          )
                        ? { color: "#ef4444" }
                        : { color: "#9ca3af" },
                    ]}
                  >
                    {votes.reduce(
                      (acc, vote) => acc + (vote.vote_value || 0),
                      0
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
                            vote.username === username && vote.vote_value === -1
                        )
                          ? "#ef4444"
                          : "#9ca3af"
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
    }
  );

  return post == null ? (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        flex: 1,
      }}
    ></View>
  ) : (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "white" }}
        behavior={"padding"}
        keyboardVerticalOffset={110}
      >
        <SafeAreaView
          style={{
            flex: 1,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              backgroundColor: "white",
            }}
            ref={scrollViewRef}
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
            <View className="px-[15px] mb-4">
              <Text className="font-bold text-[20px] my-4">Bình luận</Text>
              {comments.length === 0 ? (
                <Text className="text-gray-500">Chưa có bình luận nào</Text>
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
          </ScrollView>
          {(parentId || editingCommentId) && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 15,
                paddingVertical: 10,
                backgroundColor: "#f3f4f6",
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb",
              }}
            >
              <Text style={{ color: "#6b7280", fontSize: 14, flex: 1 }}>
                {editingCommentId
                  ? "Đang chỉnh sửa bình luận..."
                  : `Đang trả lời bình luận của ${replyingTo}...`}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setParentId(null);
                  setReplyingTo(null);
                  setEditingCommentId(null);
                  setEditingCommentText("");
                  setCommentText("");
                }}
                style={{
                  marginLeft: 10,
                  padding: 5,
                  backgroundColor: "#e5e7eb",
                  borderRadius: 50,
                }}
              >
                <Ionicons name="close" size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>
          )}
          <CommentBar
            ref={commentInputRef}
            placeholderText={
              editingCommentId
                ? "Chỉnh sửa bình luận..."
                : parentId
                ? "Nhập trả lời..."
                : "Nhập bình luận..."
            }
            onSubmit={onSubmit}
            value={editingCommentId ? editingCommentText : commentText}
            onChangeText={
              editingCommentId ? setEditingCommentText : setCommentText
            }
            disabled={
              editingCommentId
                ? !editingCommentText.trim() || isSubmitting
                : !commentText.trim() || isSubmitting
            }
            editable={!isSubmitting}
            isSubmitting={isSubmitting}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
};

export default PostScreen;
