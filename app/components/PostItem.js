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
import { useTheme } from "../contexts/ThemeContext";
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
  const { theme, isDarkMode } = useTheme();
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
      <View style={{ backgroundColor: theme.cardBackground }}>
        <TouchableOpacity
          onPress={() => {
            handleSavePost();
            hideBottomSheet();
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name={currentSaved ? "bookmark" : "bookmark-outline"}
              size={23}
              color={currentSaved ? theme.primary : theme.text}
            />
            <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="share-outline" size={23} color={theme.text} />
            <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>Chia sẻ</Text>
          </View>
        </TouchableOpacity>
        {isCurrentUser && (
          <TouchableOpacity onPress={() => console.log("Privacy", item.id)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="lock-closed-outline" size={23} color={theme.text} />
              <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
                Cài đặt quyền riêng tư
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {isCurrentUser && (
          <TouchableOpacity onPress={() => {
            if (navigation) {
              navigation.navigate("EditPostScreen", { postId: item.id });
            }
            hideBottomSheet();
          }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="create-outline" size={23} color={theme.text} />
              <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="flag-outline" size={23} color={"#ef4444"} />
            <Text
              style={{ padding: 12, fontSize: 17, color: "#ef4444" }}
            >
              Báo cáo vi phạm
            </Text>
          </View>
        </TouchableOpacity>
        {isCurrentUser && (
          <TouchableOpacity onPress={handleDeletePost}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="trash-outline" size={23} color={"#ef4444"} />
              <Text
                style={{ padding: 12, fontSize: 17, color: "#ef4444" }}
              >
                Xóa bài viết
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
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
        borderBottomColor: isDarkMode ? "#000" : "#E6E6E6",
        backgroundColor: theme.background,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {single ? (
          // Single view: no navigation, just show title
          <Text style={{
            fontWeight: "bold",
            fontSize: 21,
            paddingHorizontal: 15,
            marginTop: 15,
            flex: 1,
            color: theme.text
          }}>
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
              style={{ flex: 1 }}
            >
              <Text style={{
                fontWeight: "bold",
                fontSize: 21,
                paddingHorizontal: 15,
                marginTop: 15,
                flex: 1,
                color: theme.text
              }}>
                {item.title}
              </Text>
            </Pressable>
            <TouchableOpacity
              style={{ marginRight: 12, marginTop: 12 }}
              onPress={handleMoreOptions}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.subText} />
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
              color: theme.text,
            }}
            tagsStyles={{
              h1: {
                fontSize: 24,
                fontWeight: "bold",
                marginVertical: 12,
                color: theme.text,
              },
              h2: {
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 14,
                marginBottom: 8,
                color: theme.text,
              },
              h3: {
                fontSize: 16,
                fontWeight: "bold",
                marginTop: 12,
                marginBottom: 6,
                color: theme.text,
              },
              h4: {
                fontSize: 14,
                fontWeight: "600",
                marginTop: 10,
                marginBottom: 4,
                color: theme.text,
              },
              p: { marginBottom: 8, marginTop: 0, color: theme.text },
              strong: { fontWeight: "bold", color: theme.text },
              em: { fontStyle: "italic", color: theme.text },
              br: { marginBottom: 4 },
              blockquote: {
                backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
                borderLeftWidth: 4,
                borderLeftColor: theme.primary,
                marginVertical: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                fontStyle: "italic",
                borderRadius: 4,
              },
              hr: {
                borderTopWidth: 1,
                borderTopColor: theme.border,
                marginVertical: 15,
                backgroundColor: "transparent",
                height: 1,
              },
              code: {
                backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
                color: "#d63384",
                fontFamily: "monospace",
                fontSize: 14,
                paddingHorizontal: 4,
                paddingVertical: 2,
                borderRadius: 4,
              },
              a: {
                color: theme.primary,
                textDecorationLine: "underline",
              },
            }}
          />
        </View>
      </Pressable>
      {item.image_urls && item.image_urls.length > 0 && (
        <View style={{ backgroundColor: isDarkMode ? "#1e1e1e" : "#E4EEE3", marginTop: 8 }}>
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
                  backgroundColor: theme.iconBackground,
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 5,
                  borderWidth: 1,
                  borderColor: theme.border
                }}
              >
                <Ionicons name="document-text" size={30} color={theme.primary} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ fontWeight: '500', fontSize: 15, color: theme.text }} numberOfLines={1}>{fileName}</Text>
                  <Text style={{ fontSize: 12, color: theme.subText }}>Nhấn để xem tài liệu</Text>
                </View>
                <Ionicons name="download-outline" size={24} color={theme.subText} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <View
        style={{
          height: 1,
          backgroundColor: theme.border,
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
        style={{ paddingHorizontal: 15, flexDirection: "row", alignItems: "center" }}
        disabled={!navigation || !item?.author?.username || !!item.anonymous}
      >
        <View
          style={{
            backgroundColor: theme.cardBackground,
            width: 42,
            height: 42,
            borderRadius: 21,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: theme.border
          }}
        >
          {item.anonymous ? (
            <View style={{ width: "100%", height: "100%", backgroundColor: theme.iconBackground, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: theme.text, fontWeight: "bold", fontSize: 20 }}>?</Text>
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
        <Text style={{ fontWeight: "bold", color: theme.primary, marginLeft: 8, flexShrink: 1 }}>
          {item.anonymous ? "Người dùng ẩn danh" : (item?.author?.profile_name || item?.author?.username || "")}
          {item?.author?.verified && !item.anonymous && (
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
        <Text style={{ color: theme.subText }}> · {item.time || item.created_at_human || item.created_at}</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 15, marginVertical: 16 }}>
        <View style={{ gap: 12, flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Pressable onPress={() => handleVote(1)}>
            <Ionicons
              name="arrow-up-outline"
              size={28}
              color={
                currentVotes.some(
                  (vote) => vote?.username === username && vote.vote_value === 1
                )
                  ? "#22c55e"
                  : theme.subText
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
                  : { color: theme.subText }, // Default themed color
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
                  : theme.subText
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
                ? { backgroundColor: isDarkMode ? "#1B3A1E" : "#CDEBCA" } // Green background when saved
                : { backgroundColor: theme.iconBackground }, // Themed background when not saved
            ]}
          >
            <Ionicons
              name="bookmark"
              size={20}
              color={currentSaved ? theme.primary : theme.subText} // Green icon when saved, themed when not saved
            />
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center" }}>
            <Text style={{ color: theme.subText }}>
              {item.view_count ?? item.views_count ?? item.views ?? 0}
            </Text>
            <View style={{ marginRight: 4, marginLeft: 8 }}>
              <Ionicons name="eye-outline" size={20} color={theme.subText} />
            </View>
            {single ? (
              // Single view: just show comment count, no navigation
              <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
                <Text style={{ color: theme.subText, marginLeft: 4 }}>
                  {item.reply_count ?? item.comments ?? 0}
                </Text>
                <Ionicons name="chatbox-outline" size={20} color={theme.subText} />
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
                style={{ flexDirection: "row-reverse", alignItems: "center" }}
              >
                <Text style={{ color: theme.subText, marginLeft: 4 }}>{item.comments ?? 0}</Text>
                <Ionicons name="chatbox-outline" size={20} color={theme.subText} />
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
