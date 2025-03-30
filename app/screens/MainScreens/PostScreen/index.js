import React, { useContext, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
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

const PostScreen = ({ route, onExpand, onVoteUpdate, onSaveUpdate }) => {
  const { item, postId } = route.params; // Destructure item from route.params
  const [isExpanded, setIsExpanded] = useState(false);
  const { username } = useContext(AuthContext);
  const [votes, setVotes] = useState(item?.votes ?? []); // Local vote state
  const [isSaved, setIsSaved] = useState(item?.saved ?? false);
  const [post, setPost] = useState(item ?? null);

  React.useEffect(() => {
    if (!item) fetchPost();
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

  const handleExpandPost = () => {
    setIsExpanded(!isExpanded);
    if (isExpanded && onExpand && post.content.length > 300) {
      onExpand(); // Notify the FlatList to adjust the scroll position
    }
  };

  const truncatedContent =
    post != null &&
    (post.content.length > 300
      ? `${post.content.substring(0, 300)}...`
      : post.content);

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
    <View
      style={{
        borderBottomWidth: 15,
        borderBottomColor: "#E6E6E6",
      }}
    >
      <Text className="font-bold text-[21px] px-[15px] mt-[15px]">
        {post.title}
      </Text>
      <Pressable onPress={handleExpandPost}>
        <Markdown style={styles}>
          {isExpanded
            ? post.content.replace(/(https?:\/\/[^\s]+)/g, "[$1]($1)")
            : truncatedContent.replace(/(https?:\/\/[^\s]+)/g, "[$1]($1)")}
        </Markdown>
      </Pressable>
      {post.image_url != null && (
        <View className="bg-[#E4EEE3] mt-2">
          <Image
            source={{ uri: "https://api.chuyenbienhoa.com" + post.image_url }}
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
                  (vote) => vote.username === username && vote.vote_value === 1
                )
                  ? "#22c55e"
                  : "#9ca3af"
              }
            />
          </Pressable>
          <Text
            style={[
              post.votes.some(
                (vote) => vote.username === username && vote.vote_value === 1
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
                  (vote) => vote.username === username && vote.vote_value === -1
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
            <Pressable className="mr-1">
              <Ionicons name="chatbox-outline" size={20} color={"#6b7280"} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PostScreen;
