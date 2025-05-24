import React, { useContext, useState, useRef, useLayoutEffect } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
} from "react-native";
import Markdown from "react-native-markdown-display";
import Verified from "../../../assets/Verified";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  commentPost,
  deletePost,
  getPostDetail,
  savePost,
  unsavePost,
  voteComment,
  votePost,
} from "../../../services/api/Api";
import { useHeaderHeight } from "@react-navigation/elements";
import CommentBar from "../../../components/CommentBar";
import { FeedContext } from "../../../contexts/FeedContext";
// import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageView from "react-native-image-viewing";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useBottomSheet } from "../../../contexts/BottomSheetContext";
import FBCollage from "react-native-fb-collage";

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 15,
  },
  heading1: {
    fontSize: 25,
  },
  heading2: {
    fontSize: 20,
  },
  heading3: {
    fontSize: 18,
  },
  heading4: {
    fontSize: 16,
  },
  paragraph: {
    fontSize: 16,
  },
  strong: {
    fontSize: 16,
  },
  em: {
    fontSize: 16,
  },
  bullet_list: {
    fontSize: 16,
  },
  ordered_list: {
    fontSize: 16,
  },
  hr: {
    backgroundColor: "#e5e7eb",
    marginVertical: 15,
  },
});

const PostScreen = ({ route, navigation }) => {
  const { item, postId, screenName } = route.params; // Destructure item from route.params
  const { username, profileName, userInfo } = useContext(AuthContext);
  const [votes, setVotes] = useState(item?.votes ?? []); // Local vote state
  const [isSaved, setIsSaved] = useState(item?.saved ?? false);
  const [post, setPost] = useState(item ?? null);
  const [comments, setComments] = useState([]); // Local comment state
  const [commentText, setCommentText] = useState("");
  const [parentId, setParentId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const height = useHeaderHeight();
  const commentInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const commentRefs = useRef({});
  const { setFeed, setRecentPostsProfile } = useContext(FeedContext);
  const insets = useSafeAreaInsets();
  const [visible, setIsVisible] = useState(false);
  const { showBottomSheet, hideBottomSheet } = useBottomSheet();
  const isCurrentUser = post?.author?.username === username;

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleOpenBottomSheet = () => {
    showBottomSheet(
      <>
        <TouchableOpacity
          onPress={() => {
            handleSavePost();
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
              `https://chuyenbienhoa.com/${post.author.username}/posts/${post.id}?source=share`
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
          <TouchableOpacity onPress={() => console.log("Privacy", post.id)}>
            <View className="flex-row items-center">
              <Ionicons name="lock-closed-outline" size={23} />
              <Text style={{ padding: 12, fontSize: 17 }}>
                Cài đặt quyền riêng tư
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {isCurrentUser && (
          <TouchableOpacity onPress={() => console.log("Privacy", post.id)}>
            <View className="flex-row items-center">
              <Ionicons name="create-outline" size={23} />
              <Text style={{ padding: 12, fontSize: 17 }}>
                Chỉnh sửa bài đăng
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => console.log("Privacy", post.id)}>
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
            setFeed((prevPosts) =>
              prevPosts.filter((post) => post.id !== post.id)
            );
            if (screenName)
              setRecentPostsProfile((prevPosts) =>
                prevPosts.filter((post) => post.id !== post.id)
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
      const { topic, comments } = response.data;

      if (!item && !post) {
        setPost(topic); // Set the post data in state
        setVotes(topic.votes); // Set the votes in state
        setIsSaved(topic.saved); // Set the saved status in state
      }
      setPost(topic); // Update post state
      setComments(comments);
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

  const handleVote = async (voteValue) => {
    const existingVote = votes.find((vote) => vote.username === username);
    let newVotes;

    if (existingVote) {
      if (existingVote.vote_value === voteValue) {
        // User clicked the same vote, remove it (undo vote)
        newVotes = votes.filter((vote) => vote.username !== username);
      } else {
        // Change vote direction (upvote → downvote or vice versa)
        newVotes = votes.map((vote) =>
          vote.username === username ? { ...vote, vote_value: voteValue } : vote
        );
      }
    } else {
      // User hasn't voted yet, add a new vote
      newVotes = [...votes, { username, vote_value: voteValue }];
    }

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

    try {
      await votePost(postId, {
        vote_value: voteValue,
      });
    } catch (error) {
      console.error("Voting failed:", error);
      setVotes(post.votes); // Revert UI if API fails
    }
  };

  const handleSavePost = async () => {
    const newSavedStatus = !isSaved; // Toggle save status
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

    try {
      if (newSavedStatus) {
        // Call the API to save the post
        await savePost(post.id);
      } else {
        // Call the API to unsave the post
        await unsavePost(post.id);
      }
    } catch (error) {
      console.error("Saving failed:", error);
      setIsSaved(!newSavedStatus); // Revert UI if API call fails

      // Revert the FeedContext update
      setFeed((prevFeed) =>
        prevFeed.map((post) =>
          post.id === postId ? { ...post, saved: !newSavedStatus } : post
        )
      );

      if (screenName)
        setRecentPostsProfile((prevFeed) =>
          prevFeed.map((post) =>
            post.id === postId ? { ...post, saved: !newSavedStatus } : post
          )
        );
    }
  };

  const convertToMarkdownLink = (text) => {
    // Preserve existing markdown links and images
    const markdownPatterns = [];
    text = text.replace(/(!?\[.*?]\(https?:\/\/[^\s)]+\))/g, (match) => {
      markdownPatterns.push(match);
      return `__MARKDOWN_PLACEHOLDER_${markdownPatterns.length - 1}__`;
    });

    // Convert plain URLs into markdown links
    text = text.replace(/\b(https?:\/\/[^\s)]+)\b/g, "[$1]($1)");

    // Restore original markdown links and images
    text = text.replace(
      /__MARKDOWN_PLACEHOLDER_(\d+)__/g,
      (_, index) => markdownPatterns[index]
    );

    return text;
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
    if (!commentText.trim()) return;

    let replyingToId = parentId;

    try {
      // Send comment to API
      const resp = await commentPost(post.id, {
        comment: commentText.trim(),
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
        const updatedPostData = response.data.topic;
        setPost(updatedPostData);
        setComments(response.data.comments);

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
              const existingVote = comment.votes.find(
                (vote) => vote.username === username
              );

              let newVotes = [...comment.votes];

              if (existingVote) {
                if (existingVote.vote_value === voteValue) {
                  // User is undoing their vote
                  newVotes = comment.votes.filter(
                    (vote) => vote.username !== username
                  );
                } else {
                  // User is changing their vote
                  newVotes = comment.votes.map((vote) =>
                    vote.username === username
                      ? { ...vote, vote_value: voteValue }
                      : vote
                  );
                }
              } else {
                // User is voting for the first time
                newVotes = [
                  ...comment.votes,
                  { username, vote_value: voteValue },
                ];
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
          return {
            ...comment,
            replies: comment.replies.map((reply) => {
              if (reply.id === replyId) {
                // Apply the same voting logic to the reply
                const existingVote = reply.votes.find(
                  (vote) => vote.username === username
                );

                let newVotes = [...reply.votes];

                if (existingVote) {
                  if (existingVote.vote_value === voteValue) {
                    // User is undoing their vote
                    newVotes = reply.votes.filter(
                      (vote) => vote.username !== username
                    );
                  } else {
                    // User is changing their vote
                    newVotes = reply.votes.map((vote) =>
                      vote.username === username
                        ? { ...vote, vote_value: voteValue }
                        : vote
                    );
                  }
                } else {
                  // User is voting for the first time
                  newVotes = [
                    ...reply.votes,
                    { username, vote_value: voteValue },
                  ];
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

  const Comment = React.forwardRef(
    ({ comment, level = 0, border = false }, ref) => {
      return (
        <View
          ref={ref} // Attach ref here
          style={{
            marginLeft: level * 20, // Indent based on the nesting level
          }}
        >
          {/* Render the main comment */}

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
                navigation.navigate("ProfileScreen", {
                  username: comment.author.username,
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
                <Image
                  source={{
                    uri: `https://api.chuyenbienhoa.com/v1.0/users/${comment.author.username}/avatar`,
                  }}
                  style={{ width: 40, height: 40, borderRadius: 30 }}
                />
              </View>
            </Pressable>
            <View style={{ flexShrink: 1 }}>
              <Pressable
                onPress={() =>
                  navigation.navigate("ProfileScreen", {
                    username: comment.author.username,
                  })
                }
              >
                <Text style={{ fontWeight: "bold", color: "#319527" }}>
                  {comment.author.profile_name}
                  {comment.author.verified && (
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
              <Text
                style={{
                  flexShrink: 1,
                }}
              >
                {comment.content}
              </Text>
              <View className="flex-row items-center mt-1">
                <Text style={{ fontSize: 12, color: "gray" }}>
                  {comment.created_at} ·
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    focusCommentInput(
                      comment.id,
                      comment.author.profile_name,
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
                      comment.votes.some(
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
                    comment.votes.some(
                      (vote) =>
                        vote.username === username && vote.vote_value === 1
                    )
                      ? { color: "#22c55e" }
                      : comment.votes.some(
                          (vote) =>
                            vote.username === username && vote.vote_value === -1
                        )
                      ? { color: "#ef4444" }
                      : { color: "#9ca3af" },
                  ]}
                >
                  {comment.votes.reduce(
                    (acc, vote) => acc + vote.vote_value,
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
                      comment.votes.some(
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

          {/* Render replies recursively */}
          {comment.replies?.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {comment.replies.map((reply) => (
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
            <View
              style={{
                borderBottomWidth: 15,
                borderBottomColor: "#E6E6E6",
              }}
            >
              <Text className="font-bold text-[21px] px-[15px] mt-[15px]">
                {post.title}
              </Text>
              <Markdown style={styles}>
                {convertToMarkdownLink(post.content)}
              </Markdown>
              {post.image_urls.length > 0 && (
                <View className="bg-[#E4EEE3] mt-2">
                  <FBCollage
                    images={post.image_urls}
                    imageOnPress={(index) => {
                      setIsVisible(index);
                    }}
                    height={350}
                    width={Dimensions.get("window").width}
                  />
                  <ImageView
                    images={post.image_urls.map((url) => ({
                      uri: url,
                    }))}
                    imageIndex={visible}
                    visible={visible !== false}
                    onRequestClose={() => setIsVisible(false)}
                  />
                </View>
              )}
              <View
                style={{
                  height: 1,
                  backgroundColor: "#E6E6E6",
                  marginHorizontal: 15,
                  marginVertical: 20,
                }}
              ></View>
              <Pressable
                onPress={() =>
                  navigation.navigate("ProfileScreen", {
                    username: post.author.username,
                  })
                }
                className="px-[15px] flex-row items-center"
              >
                <View
                  className="bg-white w-[42px] rounded-full overflow-hidden"
                  style={{
                    borderWidth: 1,
                    borderColor: "#dee2e6",
                  }}
                >
                  <Image
                    source={{
                      uri: `https://api.chuyenbienhoa.com/v1.0/users/${post.author.username}/avatar`,
                    }}
                    style={{ width: 40, height: 40, borderRadius: 30 }}
                  />
                </View>
                <Text className="font-bold text-[#319527] ml-2 shrink">
                  {post.author.profile_name}
                  {post.author.verified && (
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
                <Text> · {post.time}</Text>
              </Pressable>
              <View className="flex-row items-center px-[15px] my-4">
                <View className="gap-3 flex-row items-center">
                  <Pressable onPress={() => handleVote(1)}>
                    <Ionicons
                      name="arrow-up-outline"
                      size={28}
                      color={
                        votes.some(
                          (vote) =>
                            vote.username === username && vote.vote_value === 1
                        )
                          ? "#22c55e" // Green for upvote
                          : "#9ca3af" // Gray for default
                      }
                    />
                  </Pressable>
                  <Text
                    style={[
                      votes.some(
                        (vote) =>
                          vote.username === username && vote.vote_value === 1
                      )
                        ? { color: "#22c55e" } // Green for upvote
                        : votes.some(
                            (vote) =>
                              vote.username === username &&
                              vote.vote_value === -1
                          )
                        ? { color: "#ef4444" } // Red for downvote
                        : { color: "#9ca3af" }, // Gray for default
                      { fontSize: 20, fontWeight: "600" }, // Additional styles
                    ]}
                  >
                    {votes.reduce((acc, vote) => acc + vote.vote_value, 0)}
                  </Text>
                  <Pressable onPress={() => handleVote(-1)}>
                    <Ionicons
                      name="arrow-down-outline"
                      size={28}
                      color={
                        votes.some(
                          (vote) =>
                            vote.username === username && vote.vote_value === -1
                        )
                          ? "#ef4444" // Red for downvote
                          : "#9ca3af" // Gray for default
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={handleSavePost}
                    style={[
                      {
                        borderRadius: 8, // Rounded corners
                        width: 33.6, // Width of the button
                        height: 33.6, // Height of the button
                        alignItems: "center", // Center the content horizontally
                        justifyContent: "center", // Center the content vertically
                      },
                      isSaved
                        ? { backgroundColor: "#CDEBCA" } // Green background when saved
                        : { backgroundColor: "#EAEAEA" }, // Gray background when not saved
                    ]}
                  >
                    <Ionicons
                      name="bookmark"
                      size={20}
                      color={isSaved ? "#319527" : "#9ca3af"} // Green icon when saved, gray when not saved
                    />
                  </Pressable>
                  <View className="flex-1 flex-row-reverse items-center">
                    <Text className="text-gray-500">{post.views}</Text>
                    <View className="mr-1 ml-2">
                      <Ionicons
                        name="eye-outline"
                        size={20}
                        color={"#6b7280"}
                      />
                    </View>
                    <Text className="text-gray-500">{post.comments}</Text>
                    <View className="mr-1">
                      <Ionicons
                        name="chatbox-outline"
                        size={20}
                        color={"#6b7280"}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
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
          {parentId && (
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
                Đang trả lời bình luận của{" "}
                <Text style={{ fontWeight: "bold" }}>{replyingTo}</Text>...
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setParentId(null); // Reset parentId
                  setReplyingTo(null); // Reset replyingTo
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
            placeholderText={parentId ? "Nhập trả lời..." : "Nhập bình luận..."}
            onSubmit={onSubmit}
            value={commentText}
            onChangeText={setCommentText}
            disabled={!commentText.trim()}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
};

export default PostScreen;
