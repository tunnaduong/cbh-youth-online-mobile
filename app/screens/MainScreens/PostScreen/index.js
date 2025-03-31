import React, { useContext, useState } from "react";
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
  getPostDetail,
  savePost,
  unsavePost,
  votePost,
} from "../../../services/api/Api";
import { useHeaderHeight } from "@react-navigation/elements";
import CommentBar from "../../../components/CommentBar";

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
  const { username } = useContext(AuthContext);
  const [votes, setVotes] = useState(item?.votes ?? []); // Local vote state
  const [isSaved, setIsSaved] = useState(item?.saved ?? false);
  const [post, setPost] = useState(item ?? null);
  const [comments, setComments] = useState([]); // Local comment state
  const height = useHeaderHeight();
  const commentInputRef = React.useRef(null);

  React.useEffect(() => {
    if (!item) fetchPost();
    fetchComment();
  }, []);

  const fetchPost = async () => {
    try {
      const response = await getPostDetail(postId); // Fetch post data from API
      setPost(response.data.topic); // Set the post data in state
      setVotes(response.data.topic.votes); // Set the votes in state
      setIsSaved(response.data.topic.saved); // Set the saved status in state
    } catch (error) {
      console.error("Error fetching post:", error);
    }
  };

  const fetchComment = async () => {
    try {
      const response = await getPostDetail(postId); // Fetch post data from API
      setComments(response.data.comments); // Set the post data in state
    } catch (error) {
      console.error("Error fetching comment:", error);
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

  const Comment = ({ comment, level = 0 }) => {
    return (
      <View
        style={{
          marginLeft: level * 20, // Indent based on the nesting level
          marginBottom: 10,
        }}
      >
        {/* Render the main comment */}

        <View
          style={{
            // backgroundColor: "#E4EEE3",
            borderRadius: 8,
            padding: 10,
            flexDirection: "row",
            gap: 10,
          }}
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
                    style={{ marginBottom: -4 }}
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
            <Text style={{ fontSize: 12, color: "gray", marginTop: 5 }}>
              {comment.created_at}
            </Text>
          </View>
        </View>

        {/* Render replies recursively */}
        {comment.replies?.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {comment.replies.map((reply) => (
              <Comment key={reply.id} comment={reply} level={level + 1} />
            ))}
          </View>
        )}
      </View>
    );
  };

  return post == null ? (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "white",
        flex: 1,
      }}
    >
      {/* <ActivityIndicator size={"large"} color="#636568" />
      <Text style={{ marginTop: 15 }}>Đang tải bảng tin...</Text> */}
    </View>
  ) : (
    <>
      <SafeAreaView style={{ backgroundColor: "white", flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            backgroundColor: "white",
          }}
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
                <Comment key={comment.id} comment={comment} />
              ))
            )}
          </View>
        </ScrollView>
        <CommentBar
          ref={commentInputRef}
          placeholderText={"Nhập bình luận..."}
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
