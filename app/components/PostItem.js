import React, { useContext, useState } from "react";
import {
  View,
  Pressable,
  Text,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
  Linking,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FastImage from "./FastImage";
import RenderHTML, {
  HTMLElementModel,
  HTMLContentModel,
} from "react-native-render-html";
import { WebView } from "react-native-webview";
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
import PostVotesModal from "./PostVotesModal";
import ImageView from "react-native-image-viewing";
import { useBottomSheet } from "../contexts/BottomSheetContext";
import { FeedContext } from "../contexts/FeedContext";
import FBCollage from "react-native-fb-collage";
import Toast from "react-native-toast-message";
import { generatePostSlug } from "../utils/slugify";
import { useTranslation } from "react-i18next";
import formatTime from "../utils/formatTime";
import VideoThumbnail from "./VideoThumbnail";

// react-native-render-html doesn't know about <iframe> by default (it's not
// a real HTML content tag), so it has to be registered as a custom element
// and given a custom renderer that plays the embed in a WebView.
const customHTMLElementModels = {
  iframe: HTMLElementModel.fromCustomModel({
    tagName: "iframe",
    contentModel: HTMLContentModel.block,
  }),
};

// Handles youtube.com/embed/<id>, youtube.com/watch?v=<id>, and youtu.be/<id>.
const extractYouTubeId = (url) => {
  const match = url.match(/(?:embed\/|[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

// A real mobile browser's UA - the default RN WebView Android UA (a
// "Dalvik/..." string) isn't a UA YouTube's embedded player recognizes as a
// supported browser, and it refuses to play at all rather than degrading
// gracefully, which is what actually surfaced as the numbered player error.
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

// Numeric codes the YouTube IFrame Player API's onError event actually
// documents - a bare <iframe> with no JS API attached can't report *any* of
// this, it just silently fails, which is why the previous version of this
// component had no way to confirm what was actually going wrong.
const YOUTUBE_ERROR_MESSAGES = {
  2: "Invalid video ID/parameter",
  5: "HTML5 player error",
  100: "Video not found (removed or private)",
  101: "Video owner disabled embedded playback",
  150: "Video owner disabled embedded playback",
  // Not in Google's official docs, but a very commonly reported real-world
  // error from the current player script when running inside an embedded
  // WebView (rather than a normal browser tab) - seen for otherwise-playable
  // videos. Widely worked around by serving the player from the privacy-
  // enhanced youtube-nocookie.com host instead (see the `host` player param
  // below), which sidesteps whatever ad/tracking-cookie-dependent code path
  // is throwing this.
  152: "Player error (WebView-specific, see youtube-nocookie.com fix)",
};

const YouTubeIframeRenderer = ({ tnode }) => {
  const rawSrc = tnode?.attributes?.src;
  if (!rawSrc) return null;
  const src = rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc;
  const width = Dimensions.get("window").width - 30;
  const height = (width * 9) / 16;

  const videoId = extractYouTubeId(src);
  if (!videoId) return null;

  // Load the real YouTube IFrame Player API (iframe_api) and construct the
  // player through it instead of dropping a bare <iframe> in - a bare iframe
  // can silently fail with no way to surface why, whereas the JS API's
  // onError/onReady/onStateChange callbacks give the actual numeric error
  // code YouTube considers this the real thing to check for embed problems,
  // and it's what youtube.com's own embed helper generates. `baseUrl` on the
  // WebView gives the page a real https://www.youtube.com origin (a raw
  // WebView `uri` load or file:// context has none, which the player
  // validates against and refuses to play without).
  const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>html,body{margin:0;padding:0;background:#000;overflow:hidden;}#player{position:absolute;top:0;left:0;width:100%;height:100%;}</style>
</head>
<body>
<div id="player"></div>
<script>
  function post(type, data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: data || {} }));
    }
  }
  window.onerror = function (message, source, lineno, colno) {
    post('jserror', { message: message, source: source, lineno: lineno, colno: colno });
  };
  post('boot', {});
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  function onYouTubeIframeAPIReady() {
    post('apiready', {});
    new YT.Player('player', {
      videoId: '${videoId}',
      host: 'https://www.youtube-nocookie.com',
      playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
      events: {
        onReady: function () { post('ready', {}); },
        onError: function (e) { post('error', { code: e.data }); },
        onStateChange: function (e) { post('statechange', { state: e.data }); }
      }
    });
  }
</script>
</body>
</html>`;

  return (
    <View
      style={{
        width,
        height,
        marginVertical: 8,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "#000",
      }}
    >
      <WebView
        source={{ html, baseUrl: "https://www.youtube.com" }}
        style={{ width, height }}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        userAgent={MOBILE_USER_AGENT}
        onMessage={(event) => {
          let parsed;
          try {
            parsed = JSON.parse(event.nativeEvent.data);
          } catch (e) {
            console.log("[YouTubeEmbed] raw message", event.nativeEvent.data);
            return;
          }
          if (parsed.type === "error") {
            console.log(
              `[YouTubeEmbed] player error ${parsed.data.code}: ${
                YOUTUBE_ERROR_MESSAGES[parsed.data.code] || "unknown error code"
              }`,
              { videoId, src },
            );
          } else {
            console.log(`[YouTubeEmbed] ${parsed.type}`, parsed.data, { videoId });
          }
        }}
        onError={(syntheticEvent) => {
          console.log("[YouTubeEmbed] WebView onError", syntheticEvent.nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          console.log("[YouTubeEmbed] WebView onHttpError", syntheticEvent.nativeEvent);
        }}
      />
    </View>
  );
};

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
  const insets = useSafeAreaInsets();
  const { username, userInfo } = useContext(AuthContext);
  const { setFeed, setRecentPostsProfile } = useContext(FeedContext);
  const [visible, setIsVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [votesModalVisible, setVotesModalVisible] = useState(false);
  const { showBottomSheet, hideBottomSheet } = useBottomSheet();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const isCurrentUser = item?.is_owner === true || item?.topic?.is_owner === true || item?.author?.username === username || String(item?.author?.id) === String(userInfo?.id) || String(item?.user_id) === String(userInfo?.id) || String(item?.uid) === String(userInfo?.id) || String(item?.userid) === String(userInfo?.id) || item?.is_mine === true || item?.is_author === true;

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
      t('post.deleteConfirmTitle'),
      t('post.deleteConfirmBody'),
      [
        {
          text: t('post.deleteAction'),
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
          text: t('post.editAction'),
          style: "default",
          onPress: () => {
            if (navigation) {
              navigation.navigate("PostEditScreen", { postId: item.id });
            }
            hideBottomSheet();
          },
        },
        {
          text: t('settings.cancel'),
          style: "cancel",
        },
      ]
    );
  };

  const handleReportSubmit = async (reason) => {
    try {
      const reportedUserId = item?.author?.id || item?.user_id || item?.uid || item?.userid;
      await reportUser({ reported_user_id: reportedUserId, topic_id: item.id, reason });
      Alert.alert(t('post.reportSuccessTitle'), t('post.reportSuccessBody'));
    } catch (e) {
      Alert.alert(t('profile.errorTitle'), e.response?.data?.message || e.message || t('post.reportError'));
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
              {currentSaved ? t('post.unsave') : t('post.save')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            shareLink(
              `https://chuyenbienhoa.com/${item.author.id}/posts/${generatePostSlug(item.id, item.title)}?source=share`
            );
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="share-outline" size={23} color={theme.text} />
            <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>{t('post.share')}</Text>
          </View>
        </TouchableOpacity>
        {false && isCurrentUser && (
          <TouchableOpacity onPress={() => {
            if (navigation) {
              navigation.navigate("PostEditScreen", { postId: item.id });
            }
            hideBottomSheet();
          }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="lock-closed-outline" size={23} color={theme.text} />
              <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
                {t('post.privacy')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        {isCurrentUser && (
          <TouchableOpacity onPress={() => {
            if (navigation) {
              navigation.navigate("PostEditScreen", { postId: item.id });
            }
            hideBottomSheet();
          }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="create-outline" size={23} color={theme.text} />
              <Text style={{ padding: 12, fontSize: 17, color: theme.text }}>
                {t('post.edit')}
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
              {t('post.report')}
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
                {t('post.delete')}
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

  // Hashtag links in post content point at "/search?type=hashtag&q=tag";
  // intercept those to navigate in-app instead of trying to open a URL,
  // and open any other (autolinked) link in the browser.
  const handleContentLinkPress = (event, href) => {
    const hashtagMatch = href?.match(/[?&]type=hashtag&(?:.*&)?q=([^&]+)/);
    if (hashtagMatch) {
      const tag = decodeURIComponent(hashtagMatch[1]);
      navigation?.navigate("SearchScreen", {
        initialQuery: tag,
        initialFilter: "hashtag",
      });
      return;
    }
    Linking.openURL(href);
  };

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
            fontSize: 28,
            paddingHorizontal: 15,
            marginTop: 0,
            marginBottom: 10,
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
            customHTMLElementModels={customHTMLElementModels}
            renderers={{ iframe: YouTubeIframeRenderer }}
            renderersProps={{
              a: { onPress: (event, href) => handleContentLinkPress(event, href) },
            }}
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
            HeaderComponent={() => (
              // react-native-image-viewing's default header uses RN's plain
              // SafeAreaView, which on Android applies no top inset at all,
              // so the close button sits under (behind) the status bar and
              // can't be tapped. Supply our own header using the safe area
              // insets we already have (same fix as ConversationScreen's
              // image viewer).
              <View style={{ paddingTop: insets.top + 8, paddingRight: 12, alignItems: "flex-end" }}>
                <TouchableOpacity
                  onPress={() => setIsVisible(false)}
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
        </View>
      )}

      {/* Video attachment display */}
      {item.video_urls && item.video_urls.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 15, paddingTop: 8, gap: 8 }}
        >
          {item.video_urls.map((url, index) => (
            <VideoThumbnail
              key={`${url}-${index}`}
              uri={url}
              width={single ? 260 : 220}
              height={single ? 180 : 150}
              borderRadius={12}
            />
          ))}
        </ScrollView>
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
                  <Text style={{ fontSize: 12, color: theme.subText }}>{t('post.tapToViewDoc')}</Text>
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
              <FastImage
                source={{
                  uri: `https://api.chuyenbienhoa.com/v1.0/users/${item.author.username}/avatar`,
                }}
                style={{ width: 40, height: 40, borderRadius: 30 }}
              />
            )
          )}
        </View>
        <Text style={{ fontWeight: "bold", color: theme.primary, marginLeft: 8, flexShrink: 1 }}>
          {item.anonymous ? t('post.anonymousUser') : (item?.author?.profile_name || item?.author?.username || "")}
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
        <Text style={{ color: theme.subText }}>
          {" · "}{formatTime(item.created_at || item.time || item.created_at_human)}{item.is_edited ? ` (${t('post.edited')})` : ""}
        </Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 15, marginVertical: 16 }}>
        <View style={{ gap: single ? 16 : 12, flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Pressable onPress={() => handleVote(1)}>
            <Ionicons
              name="arrow-up-outline"
              size={single ? 34 : 28}
              color={
                currentVotes.some(
                  (vote) => vote?.username === username && vote.vote_value === 1
                )
                  ? "#22c55e"
                  : theme.subText
              }
            />
          </Pressable>
          <Pressable onPress={() => setVotesModalVisible(true)} style={{ justifyContent: "center" }}>
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
                { fontSize: single ? 24 : 20, fontWeight: "600" }, // Additional styles
              ]}
            >
              {currentVotes.reduce(
                (acc, vote) => acc + (vote.vote_value || 0),
                0
              ) || 0}
            </Text>
          </Pressable>
          <Pressable onPress={() => handleVote(-1)}>
            <Ionicons
              name="arrow-down-outline"
              size={single ? 34 : 28}
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
                borderRadius: single ? 10 : 8, // Rounded corners
                width: single ? 42 : 33.6, // Width of the button
                height: single ? 42 : 33.6, // Height of the button
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
              size={single ? 24 : 20}
              color={currentSaved ? theme.primary : theme.subText} // Green icon when saved, themed when not saved
            />
          </Pressable>
          <View style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center" }}>
            <Text style={{ color: theme.subText, fontSize: single ? 16 : undefined }}>
              {item.view_count ?? item.views_count ?? item.views ?? 0}
            </Text>
            <View style={{ marginRight: 4, marginLeft: single ? 12 : 8 }}>
              <Ionicons name="eye-outline" size={single ? 24 : 20} color={theme.subText} />
            </View>
            {single ? (
              // Single view: just show comment count, no navigation
              <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
                <Text style={{ color: theme.subText, marginLeft: 4, fontSize: 16 }}>
                  {item.reply_count ?? item.comments ?? 0}
                </Text>
                <Ionicons name="chatbox-outline" size={24} color={theme.subText} />
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
      <PostVotesModal
        visible={votesModalVisible}
        onClose={() => setVotesModalVisible(false)}
        postId={item.id}
        postTitle={item.title || item?.topic?.title || t("voteModal.postTitleFallback")}
        navigation={navigation}
      />
    </View >
  );
};

export default PostItem;
