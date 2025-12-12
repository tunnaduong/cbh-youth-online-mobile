import React, { useContext, useState } from "react";
import {
  View,
  Pressable,
  Text,
  Image,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
  Linking,
} from "react-native";
import RenderHTML from "react-native-render-html";
import Verified from "../assets/Verified";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AuthContext } from "../contexts/AuthContext";
import {
  deletePost,
  savePost,
  unsavePost,
  votePost,
  reportUser,
} from "../services/api/Api";
import ReportModal from "./ReportModal";
import ImageView from "react-native-image-viewing";
import { useBottomSheet } from "../contexts/BottomSheetContext";
import { FeedContext } from "../contexts/FeedContext";
import FBCollage from "react-native-fb-collage";
import Toast from "react-native-toast-message";
import { generatePostSlug } from "../utils/slugify";

const PostItem = ({
  navigation,
  item = {},
  onExpand,
  onVoteUpdate,
  onSaveUpdate,
  screenName,
  single = false, // New prop to distinguish between feed and detail page
  // For single view, accept direct state updates
  votes: externalVotes,
  saved: externalSaved,
  onVote: onVoteCallback, // Callback for single view vote updates
  onSave: onSaveCallback, // Callback for single view save updates
}) => {
  const [isExpanded, setIsExpanded] = useState(single); // Start expanded for single view, but allow toggling
  const { username } = useContext(AuthContext);
  const { setFeed, setRecentPostsProfile } = useContext(FeedContext);
  const [visible, setIsVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const { showBottomSheet, hideBottomSheet } = useBottomSheet();
  const isCurrentUser = item?.author?.username === username;

  // Use external state if provided (for single view), otherwise use item props
  const currentVotes =
    externalVotes !== undefined ? externalVotes : item.votes || [];
  const currentSaved =
    externalSaved !== undefined
      ? externalSaved
      : item.saved || item.is_saved || false;

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
            if (setFeed) {
              setFeed((prevPosts) =>
                prevPosts.filter((post) => post.id !== item.id)
              );
            }
            if (screenName && setRecentPostsProfile) {
              setRecentPostsProfile((prevPosts) =>
                prevPosts.filter((post) => post.id !== item.id)
              );
            }
            hideBottomSheet();
          },
        },
        {
          text: "Chỉnh sửa",
          style: "default",
          onPress: () => {
            if (navigation) {
              navigation.navigate("EditPostScreen", { postId: item.id });
            }
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

  const handleReportSubmit = async (reason) => {
    try {
      await reportUser({ topic_id: item.id, reason });
      Alert.alert("Cảm ơn", "Báo cáo của bạn đã được gửi. Chúng tôi sẽ xem xét trong thời gian sớm nhất.");
    } catch (e) {
      Alert.alert("Lỗi", e.response?.data?.message || e.message || "Không thể gửi báo cáo");
    }
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
            <Ionicons
              name={currentSaved ? "bookmark" : "bookmark-outline"}
              size={23}
              color={currentSaved ? "#000" : undefined}
            />
            <Text style={{ padding: 12, fontSize: 17 }}>
              {currentSaved ? "Bỏ lưu bài viết" : "Lưu bài viết"}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            shareLink(
              `https://chuyenbienhoa.com/${item.author.username
              }/posts/${generatePostSlug(item.id, item.title)}?source=share`
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
        <TouchableOpacity
          onPress={() => {
            setReportModalVisible(true);
            hideBottomSheet();
          }}
        >
          <View className="flex-row items-center">
            <Ionicons name="flag-outline" size={23} color={"#ef4444"} />
            <Text
              style={{ padding: 12, fontSize: 17 }}
              className="text-red-500"
            >
              Báo cáo vi phạm
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
    const existingVote = currentVotes.find(
      (vote) => vote?.username === username
    );
    let newVotes;

    if (existingVote) {
      if (existingVote.vote_value === voteValue) {
        // User clicked the same vote, remove it (unvote)
        newVotes = currentVotes.filter((vote) => vote?.username !== username);

        // Update UI instantly (if callback provided)
        if (single && onVoteCallback) {
          onVoteCallback(newVotes);
        } else if (onVoteUpdate) {
          onVoteUpdate(item.id, newVotes);
        }

        try {
          // Send a request to remove the vote
          await votePost(item.id, { vote_value: 0 }); // Assuming `vote_value: 0` removes the vote
        } catch (error) {
          console.error("Unvoting failed:", error);
          if (single && onVoteCallback) {
            onVoteCallback(currentVotes); // Revert UI if API fails
          } else if (onVoteUpdate) {
            onVoteUpdate(item.id, currentVotes); // Revert UI if API fails
          }
        }
        return;
      } else {
        // Change vote direction (upvote → downvote or vice versa)
        newVotes = currentVotes.map((vote) =>
          vote?.username === username
            ? { ...vote, vote_value: voteValue }
            : vote
        );
      }
    } else {
      // User hasn't voted yet, add a new vote
      newVotes = [...currentVotes, { username, vote_value: voteValue }];
    }

    // Update UI instantly (if callback provided)
    if (single && onVoteCallback) {
      onVoteCallback(newVotes);
    } else if (onVoteUpdate) {
      onVoteUpdate(item.id, newVotes);
    }

    try {
      await votePost(item.id, { vote_value: voteValue });
    } catch (error) {
      console.error("Voting failed:", error);
      if (single && onVoteCallback) {
        onVoteCallback(currentVotes); // Revert UI if API fails
      } else if (onVoteUpdate) {
        onVoteUpdate(item.id, currentVotes); // Revert UI if API fails
      }
    }
  };

  const handleSavePost = async () => {
    const newSavedStatus = !currentSaved; // Toggle save status

    // Update state (if callback provided)
    if (single && onSaveCallback) {
      onSaveCallback(newSavedStatus);
    } else if (onSaveUpdate) {
      onSaveUpdate(item.id, newSavedStatus);
    }

    try {
      if (currentSaved) {
        // Call the API to unsave the post
        await unsavePost(item.id);
      } else {
        // Call the API to save the post
        await savePost(item.id);
      }
    } catch (error) {
      console.error("Saving failed:", error);
      if (single && onSaveCallback) {
        onSaveCallback(!newSavedStatus); // Revert state if API call fails
      } else if (onSaveUpdate) {
        onSaveUpdate(item.id, !newSavedStatus); // Revert FeedContext update if API call fails
      }
    }
  };

  const handleExpandPost = () => {
    setIsExpanded(!isExpanded);
    if (!single && isExpanded && onExpand && item.content?.length > 300) {
      onExpand(); // Notify the FlatList to adjust the scroll position (only in feed mode)
    }
  };

  const truncatedContent =
    item.content && item.content.length > 300
      ? `${item.content.substring(0, 300)}...`
      : item.content || "";

  return (
    <View
      style={{
        borderBottomWidth: single ? 15 : 10,
        borderBottomColor: "#E6E6E6",
      }}
    >
      <View className="flex-row justify-between shrink">
        {single ? (
          // Single view: no navigation, just show title
          <Text className="font-bold text-[21px] px-[15px] mt-[15px] shrink flex-1">
            {item.title}
          </Text>
        ) : (
          // Feed view: clickable title that navigates to detail
          <>
            <Pressable
              onPress={() =>
                navigation?.navigate("PostScreen", {
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
          </>
        )}
      </View>
      <Pressable onPress={handleExpandPost}>
        <View style={{ paddingHorizontal: 15 }}>
          <RenderHTML
            contentWidth={Dimensions.get("window").width - 30}
            source={{
              html:
                isExpanded || !item.content || item.content.length <= 300
                  ? item.content || ""
                  : truncatedContent,
            }}
            baseStyle={{
              fontSize: 16,
              color: "#000",
            }}
            tagsStyles={{
              h1: {
                fontSize: 24,
                fontWeight: "bold",
                marginVertical: 12,
              },
              h2: {
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 14,
                marginBottom: 8,
              },
              h3: {
                fontSize: 16,
                fontWeight: "bold",
                marginTop: 12,
                marginBottom: 6,
              },
              h4: {
                fontSize: 14,
                fontWeight: "600",
                marginTop: 10,
                marginBottom: 4,
              },
              p: { marginBottom: 8, marginTop: 0 },
              strong: { fontWeight: "bold" },
              em: { fontStyle: "italic" },
              br: { marginBottom: 4 },
              blockquote: {
                backgroundColor: "#f7f7f8",
                borderLeftWidth: 4,
                borderLeftColor: "#e5e7eb",
                marginVertical: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                fontStyle: "italic",
                borderRadius: 4,
              },
              hr: {
                borderTopWidth: 1,
                borderTopColor: "#ededed",
                marginVertical: 15,
                backgroundColor: "transparent",
                height: 1,
              },
              code: {
                backgroundColor: "#f7f7f8",
                color: "#d63384",
                fontFamily: "monospace",
                fontSize: 14,
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
              },
              a: {
                color: "#319527",
                textDecorationLine: "underline",
              },
            }}
          />
        </View>
      </Pressable>
      {item.image_urls && item.image_urls.length > 0 && (
        <View className="bg-[#E4EEE3] mt-2">
          <FBCollage
            images={item.image_urls}
            imageOnPress={(index) => {
              setIsVisible(index);
            }}
            height={350}
            width={Dimensions.get("window").width}
          />
          <ImageView
            images={item.image_urls.map((url) => ({
              uri: url,
            }))}
            imageIndex={visible}
            visible={visible !== false}
            onRequestClose={() => setIsVisible(false)}
          />
        </View>
      )}

      {/* Document attachment display */}
      {item.document_urls && item.document_urls.length > 0 && (
        <View style={{ paddingHorizontal: 15, marginTop: 10 }}>
          {item.document_urls.map((docUrl, index) => {
            const fileName = decodeURIComponent(docUrl.split('/').pop()).replace(/^\d+_/, '');
            return (
              <TouchableOpacity
                key={index}
                onPress={() => Linking.openURL(docUrl)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#F0F2F5',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 5,
                  borderWidth: 1,
                  borderColor: '#ddd'
                }}
              >
                <Ionicons name="document-text" size={30} color="#309627" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ fontWeight: '500', fontSize: 15 }} numberOfLines={1}>{fileName}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>Nhấn để xem tài liệu</Text>
                </View>
                <Ionicons name="download-outline" size={24} color="#666" />
              </TouchableOpacity>
            );
          })}
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
        onPress={() => {
          if (!item.anonymous && navigation && item?.author?.username) {
            navigation.navigate("ProfileScreen", {
              username: item.author.username,
            });
          }
        }}
        className="px-[15px] flex-row items-center"
        disabled={!navigation || !item?.author?.username || !!item.anonymous}
      >
        <View
          className="bg-white w-[42px] h-[42px] rounded-full overflow-hidden items-center justify-center border border-[#dee2e6]"
        >
          {item.anonymous ? (
            <View className="w-full h-full bg-[#e9f1e9] items-center justify-center">
              <Text className="text-white font-bold text-xl">?</Text>
            </View>
          ) : (
            item?.author?.username && (
              <Image
                source={{
                  uri: `https://api.chuyenbienhoa.com/v1.0/users/${item.author.username}/avatar`,
                }}
                style={{ width: 40, height: 40, borderRadius: 30 }}
              />
            )
          )}
        </View>
        <Text className="font-bold text-[#319527] ml-2 shrink">
          {item.anonymous ? "Người dùng ẩn danh" : (item?.author?.profile_name || item?.author?.username || "")}
          {item?.author?.verified && !item.anonymous && (
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
        <Text> · {item.time || item.created_at_human || item.created_at}</Text>
      </Pressable>
      <View className="flex-row items-center px-[15px] my-4">
        <View className="gap-3 flex-row items-center">
          <Pressable onPress={() => handleVote(1)}>
            <Ionicons
              name="arrow-up-outline"
              size={28}
              color={
                currentVotes.some(
                  (vote) => vote?.username === username && vote.vote_value === 1
                )
                  ? "#22c55e"
                  : "#9ca3af"
              }
            />
          </Pressable>
          <Text
            style={[
              currentVotes.some(
                (vote) => vote?.username === username && vote.vote_value === 1
              )
                ? { color: "#22c55e" } // Apply green color for upvotes
                : currentVotes.some(
                  (vote) =>
                    vote?.username === username && vote.vote_value === -1
                )
                  ? { color: "#ef4444" } // Apply red color for downvotes
                  : { color: "#9ca3af" }, // Default gray color
              { fontSize: 20, fontWeight: "600" }, // Additional styles
            ]}
          >
            {currentVotes.reduce(
              (acc, vote) => acc + (vote.vote_value || 0),
              0
            ) || 0}
          </Text>
          <Pressable onPress={() => handleVote(-1)}>
            <Ionicons
              name="arrow-down-outline"
              size={28}
              color={
                currentVotes.some(
                  (vote) =>
                    vote?.username === username && vote.vote_value === -1
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
              currentSaved
                ? { backgroundColor: "#CDEBCA" } // Green background when saved
                : { backgroundColor: "#EAEAEA" }, // Gray background when not saved
            ]}
          >
            <Ionicons
              name="bookmark"
              size={20}
              color={currentSaved ? "#319527" : "#9ca3af"} // Green icon when saved, gray when not saved
            />
          </Pressable>
          <View className="flex-1 flex-row-reverse items-center">
            <Text className="text-gray-500">
              {item.view_count ?? item.views_count ?? item.views ?? 0}
            </Text>
            <View className="mr-1 ml-2">
              <Ionicons name="eye-outline" size={20} color={"#6b7280"} />
            </View>
            {single ? (
              // Single view: just show comment count, no navigation
              <View className="flex-row-reverse items-center">
                <Text className="text-gray-500 ml-1">
                  {item.reply_count ?? item.comments ?? 0}
                </Text>
                <Ionicons name="chatbox-outline" size={20} color={"#6b7280"} />
              </View>
            ) : (
              // Feed view: clickable comment count that navigates
              <Pressable
                onPress={() =>
                  navigation?.navigate("PostScreen", {
                    postId: item.id,
                    item,
                    screenName,
                  })
                }
                className="flex-row-reverse items-center"
              >
                <Text className="text-gray-500 ml-1">{item.comments ?? 0}</Text>
                <Ionicons name="chatbox-outline" size={20} color={"#6b7280"} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />
    </View >
  );
};

export default PostItem;
