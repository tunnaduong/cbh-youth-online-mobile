import React, { useContext, useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  TouchableOpacity,
  Share,
  Alert,
} from "react-native";
import Markdown from "react-native-markdown-display";
import Verified from "../assets/Verified";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../contexts/AuthContext";
import {
  deletePost,
  savePost,
  unsavePost,
  votePost,
} from "../services/api/Api";
import ImageView from "react-native-image-viewing";
import { useBottomSheet } from "../contexts/BottomSheetContext";
import { FeedContext } from "../contexts/FeedContext";

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

const PostItem = ({
  navigation,
  item = {},
  onExpand,
  onVoteUpdate,
  onSaveUpdate,
  screenName,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { username } = useContext(AuthContext);
  const { setFeed, setRecentPostsProfile } = useContext(FeedContext);
  const [visible, setIsVisible] = useState(false);
  const { showBottomSheet, hideBottomSheet } = useBottomSheet();
  const isCurrentUser = item.author.username === username;

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
            await deletePost(item.id);
            // refresh the post list
            setFeed((prevPosts) =>
              prevPosts.filter((post) => post.id !== item.id)
            );
            if (screenName)
              setRecentPostsProfile((prevPosts) =>
                prevPosts.filter((post) => post.id !== item.id)
              );
            hideBottomSheet();
          },
        },
        {
          text: "Chỉnh sửa",
          style: "default",
          onPress: () => {
            navigation.navigate("EditPostScreen", { postId: item.id });
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

  const handleMoreOptions = () => {
    showBottomSheet(
      <>
        <TouchableOpacity
          onPress={() => {
            handleSavePost();
            hideBottomSheet();
          }}
        >
          <View className="flex-row items-center">
            <Ionicons name="bookmark-outline" size={23} />
            <Text style={{ padding: 12, fontSize: 17 }}>Lưu bài viết</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            shareLink(
              `https://chuyenbienhoa.com/${item.author.username}/posts/${item.id}?source=share`
            );
          }}
        >
          <View className="flex-row items-center">
            <Ionicons name="share-outline" size={23} />
            <Text style={{ padding: 12, fontSize: 17 }}>Chia sẻ</Text>
          </View>
        </TouchableOpacity>
        {isCurrentUser && (
          <TouchableOpacity onPress={() => console.log("Privacy", item.id)}>
            <View className="flex-row items-center">
              <Ionicons name="lock-closed-outline" size={23} />
              <Text style={{ padding: 12, fontSize: 17 }}>
                Cài đặt quyền riêng tư
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {isCurrentUser && (
          <TouchableOpacity onPress={() => console.log("Privacy", item.id)}>
            <View className="flex-row items-center">
              <Ionicons name="create-outline" size={23} />
              <Text style={{ padding: 12, fontSize: 17 }}>
                Chỉnh sửa bài đăng
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => console.log("Privacy", item.id)}>
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

  const handleVote = async (voteValue) => {
    const existingVote = item.votes.find((vote) => vote?.username === username);
    let newVotes;

    if (existingVote) {
      if (existingVote.vote_value === voteValue) {
        // User clicked the same vote, remove it (unvote)
        newVotes = item.votes.filter((vote) => vote?.username !== username);

        // Update UI instantly
        onVoteUpdate(item.id, newVotes);

        try {
          // Send a request to remove the vote
          await votePost(item.id, { vote_value: 0 }); // Assuming `vote_value: 0` removes the vote
        } catch (error) {
          console.error("Unvoting failed:", error);
          onVoteUpdate(item.id, item.votes); // Revert UI if API fails
        }
        return;
      } else {
        // Change vote direction (upvote → downvote or vice versa)
        newVotes = item.votes.map((vote) =>
          vote?.username === username
            ? { ...vote, vote_value: voteValue }
            : vote
        );
      }
    } else {
      // User hasn't voted yet, add a new vote
      newVotes = [...item.votes, { username, vote_value: voteValue }];
    }

    // Update UI instantly
    onVoteUpdate(item.id, newVotes);

    try {
      await votePost(item.id, { vote_value: voteValue });
    } catch (error) {
      console.error("Voting failed:", error);
      onVoteUpdate(item.id, item.votes); // Revert UI if API fails
    }
  };

  const handleSavePost = async () => {
    const newSavedStatus = !item.saved; // Toggle save status
    onSaveUpdate(item.id, newSavedStatus); // Update FeedContext

    try {
      if (item.saved) {
        // Call the API to unsave the post
        await unsavePost(item.id);
      } else {
        // Call the API to save the post
        await savePost(item.id);
      }
    } catch (error) {
      console.error("Saving failed:", error);
      onSaveUpdate(item.id, !newSavedStatus); // Revert FeedContext update if API call fails
    }
  };

  const handleExpandPost = () => {
    setIsExpanded(!isExpanded);
    if (isExpanded && onExpand && item.content.length > 300) {
      onExpand(); // Notify the FlatList to adjust the scroll position
    }
  };

  const truncatedContent =
    item.content.length > 300
      ? `${item.content.substring(0, 300)}...`
      : item.content;

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

  return (
    <View
      style={{
        borderBottomWidth: 10,
        borderBottomColor: "#E6E6E6",
      }}
    >
      <View className="flex-row justify-between shrink">
        <Pressable
          onPress={() =>
            navigation.navigate("PostScreen", {
              postId: item.id,
              item,
              screenName,
            })
          }
          className="shrink flex-1"
        >
          <Text className="font-bold text-[21px] px-[15px] mt-[15px] shrink flex-1">
            {item.title}
          </Text>
        </Pressable>
        <TouchableOpacity
          className="mr-3 mt-3 shrink-0"
          onPress={handleMoreOptions}
        >
          <Ionicons name="ellipsis-horizontal" size={20} />
        </TouchableOpacity>
      </View>
      <Pressable onPress={handleExpandPost}>
        <Markdown style={styles}>
          {isExpanded
            ? convertToMarkdownLink(item.content)
            : convertToMarkdownLink(truncatedContent)}
        </Markdown>
      </Pressable>
      {item.image_url != null && (
        <Pressable
          onPress={() => {
            setIsVisible(true);
          }}
        >
          <View className="bg-[#E4EEE3] mt-2">
            <Image
              source={{ uri: "https://api.chuyenbienhoa.com" + item.image_url }}
              height={300}
              style={{ resizeMode: "contain" }}
            />
            <ImageView
              images={[
                { uri: "https://api.chuyenbienhoa.com" + item.image_url },
              ]}
              imageIndex={0}
              visible={visible}
              onRequestClose={() => setIsVisible(false)}
            />
          </View>
        </Pressable>
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
        onPress={() => {
          navigation.navigate("ProfileScreen", {
            username: item?.author?.username,
          });
        }}
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
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${item?.author?.username}/avatar`,
            }}
            style={{ width: 40, height: 40, borderRadius: 30 }}
          />
        </View>
        <Text className="font-bold text-[#319527] ml-2 shrink">
          {item.author.profile_name}
          {item.author.verified && (
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
        <Text> · {item.time}</Text>
      </Pressable>
      <View className="flex-row items-center px-[15px] my-4">
        <View className="gap-3 flex-row items-center">
          <Pressable onPress={() => handleVote(1)}>
            <Ionicons
              name="arrow-up-outline"
              size={28}
              color={
                item.votes.some(
                  (vote) => vote?.username === username && vote.vote_value === 1
                )
                  ? "#22c55e"
                  : "#9ca3af"
              }
            />
          </Pressable>
          <Text
            style={[
              item.votes.some(
                (vote) => vote?.username === username && vote.vote_value === 1
              )
                ? { color: "#22c55e" } // Apply green color for upvotes
                : item.votes.some(
                    (vote) =>
                      vote?.username === username && vote.vote_value === -1
                  )
                ? { color: "#ef4444" } // Apply red color for downvotes
                : { color: "#9ca3af" }, // Default gray color
              { fontSize: 20, fontWeight: "600" }, // Additional styles
            ]}
          >
            {item?.votes?.reduce((acc, vote) => acc + vote.vote_value, 0)}
          </Text>
          <Pressable onPress={() => handleVote(-1)}>
            <Ionicons
              name="arrow-down-outline"
              size={28}
              color={
                item.votes.some(
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
              item.saved
                ? { backgroundColor: "#CDEBCA" } // Green background when saved
                : { backgroundColor: "#EAEAEA" }, // Gray background when not saved
            ]}
          >
            <Ionicons
              name="bookmark"
              size={20}
              color={item.saved ? "#319527" : "#9ca3af"} // Green icon when saved, gray when not saved
            />
          </Pressable>
          <View className="flex-1 flex-row-reverse items-center">
            <Text className="text-gray-500">{item.views}</Text>
            <View className="mr-1 ml-2">
              <Ionicons name="eye-outline" size={20} color={"#6b7280"} />
            </View>
            <Pressable
              onPress={() =>
                navigation.navigate("PostScreen", {
                  postId: item.id,
                  item,
                  screenName,
                })
              }
              className="flex-row-reverse items-center"
            >
              <Text className="text-gray-500 ml-1">{item.comments}</Text>
              <Ionicons name="chatbox-outline" size={20} color={"#6b7280"} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PostItem;
