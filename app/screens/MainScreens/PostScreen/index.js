import React, { useContext, useState, useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Markdown from "react-native-markdown-display";
import Verified from "../../../assets/Verified";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  commentPost,
  getPostDetail,
  savePost,
  unsavePost,
  votePost,
} from "../../../services/api/Api";
import { useHeaderHeight } from "@react-navigation/elements";
import CommentBar from "../../../components/CommentBar";
import { TouchableOpacity } from "react-native";

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

const PostScreen = ({ route, onVoteUpdate, onSaveUpdate }) => {
  const { item, postId } = route.params; // Destructure item from route.params
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

  React.useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await getPostDetail(postId); // Fetch post data from API
      const { topic, comments } = response.data;

      if (!item && !post) {
        setPost(topic); // Set the post data in state
        setVotes(topic.votes); // Set the votes in state
        setIsSaved(topic.saved); // Set the saved status in state
      }
      setComments(comments); // Set the comments in state
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const focusCommentInput = (id, name) => {
    setParentId(id);
    setReplyingTo(name);
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
    setTimeout(() => {
      scrollToComment(id);
    }, 100);
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
    onVoteUpdate(post.id, newVotes);

    try {
      await votePost(post.id, {
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
    onSaveUpdate(post.id, newSavedStatus);

    try {
      if (isSaved) {
        // Call the API to unsave the post
        await unsavePost(post.id); // Make sure you have this function to call the DELETE API
      } else {
        // Call the API to save the post
        await savePost(post.id);
      }
    } catch (error) {
      console.error("Saving failed:", error);
      setIsSaved(!newSavedStatus); // Revert UI if API call fails
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
      if (comment.replies.length > 0) {
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
    if (!commentText.trim()) {
      return;
    }

    // Determine the correct parent ID for replying
    let replyingToId = parentId;
    if (parentId) {
      const parentCommentId = findParentIdForReply(comments, parentId);
      if (parentCommentId) {
        replyingToId = parentCommentId; // Redirect to the 2nd-level comment
      }
    }

    // Call the API to submit the comment or reply
    await commentPost(post.id, {
      comment: commentText.trim(),
      replying_to: replyingToId, // Use the redirected parent ID
    });

    // Fetch the updated comments
    fetchData();

    setParentId(null); // Reset parentId
    setReplyingTo(null); // Reset replyingTo

    // Clear the input field
    setCommentText("");
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
            <View style={{ flexShrink: 1 }}>
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
                    focusCommentInput(comment.id, comment.author.profile_name)
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
                <Pressable>
                  <Ionicons
                    name="arrow-up-outline"
                    size={18}
                    color={"#9ca3af"}
                  />
                </Pressable>
                <Text
                  style={[
                    { fontSize: 14, fontWeight: "600" },
                    { color: "#9ca3af", textAlign: "center" },
                  ]}
                >
                  {comment.votes.reduce(
                    (acc, vote) => acc + vote.vote_value,
                    0
                  )}
                </Text>
                <Pressable>
                  <Ionicons
                    name="arrow-down-outline"
                    size={18}
                    color={"#9ca3af"}
                  />
                </Pressable>
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
      <SafeAreaView style={{ backgroundColor: "white", flex: 1 }}>
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
            {post.image_url != null && (
              <View className="bg-[#E4EEE3] mt-2">
                <Image
                  source={{
                    uri: "https://api.chuyenbienhoa.com" + post.image_url,
                  }}
                  height={300}
                  style={{ resizeMode: "contain" }}
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
            <View className="px-[15px] flex-row items-center">
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
            </View>
            <View className="flex-row items-center px-[15px] my-4">
              <View className="gap-3 flex-row items-center">
                <Pressable onPress={() => handleVote(1)}>
                  <Ionicons
                    name="arrow-up-outline"
                    size={28}
                    color={
                      post.votes.some(
                        (vote) =>
                          vote.username === username && vote.vote_value === 1
                      )
                        ? "#22c55e"
                        : "#9ca3af"
                    }
                  />
                </Pressable>
                <Text
                  style={[
                    post.votes.some(
                      (vote) =>
                        vote.username === username && vote.vote_value === 1
                    )
                      ? { color: "#22c55e" } // Apply green color for upvotes
                      : post.votes.some(
                          (vote) =>
                            vote.username === username && vote.vote_value === -1
                        )
                      ? { color: "#ef4444" } // Apply red color for downvotes
                      : { color: "#9ca3af" }, // Default gray color
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
                      post.votes.some(
                        (vote) =>
                          vote.username === username && vote.vote_value === -1
                      )
                        ? "#ef4444"
                        : "#9ca3af"
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
                      ? { backgroundColor: "#CDEBCA" }
                      : { backgroundColor: "#EAEAEA" }, // Inline style for background color
                  ]}
                >
                  <Ionicons
                    name="bookmark"
                    size={20}
                    color={isSaved ? "#319527" : "#9ca3af"}
                  />
                </Pressable>
                <View className="flex-1 flex-row-reverse items-center">
                  <Text className="text-gray-500">{post.views}</Text>
                  <View className="mr-1 ml-2">
                    <Ionicons name="eye-outline" size={20} color={"#6b7280"} />
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
          placeholderText={
            parentId ? "Nhập trả lời..." : "Nhập bình luận..." // Change placeholder dynamically
          }
          onSubmit={onSubmit}
          value={commentText}
          onChangeText={setCommentText}
          disabled={!commentText.trim()}
        />
        <KeyboardAvoidingView
          keyboardVerticalOffset={height}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        />
      </SafeAreaView>
    </>
  );
};

export default PostScreen;
