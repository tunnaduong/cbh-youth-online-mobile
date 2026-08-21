import React, { useContext, useMemo, useState } from "react";
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
  Platform,
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
import InlineVideoPlayer from "./InlineVideoPlayer";
import { buildYouTubePlayerHtml, appendYouTubeEmbedBelow } from "../utils/youtubeShare";
import { appendSoundCloudEmbedBelow } from "../utils/soundcloudShare";
import { linkifyMentionsInHtml } from "../utils/mentionRender";

// react-native-render-html doesn't know about <iframe> by default (it's not
// a real HTML content tag), so it has to be registered as a custom element
// and given a custom renderer that plays the embed in a WebView. Exported so
// other RenderHTML instances (e.g. PostScreen's comment renderer) that also
// display backend-whitelisted YouTube/SoundCloud iframes can reuse the exact
// same setup instead of silently dropping unrecognized <iframe> tags.
export const customHTMLElementModels = {
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
// Pixel 9 Pro XL, Android 15 QPR1 stable (AP4A.241205.013).
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL Build/AP4A.241205.013) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/174.10.5.6 Mobile Safari/537.36";

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
  // Not in Google's official docs. A referrer-policy meta tag alone didn't
  // fix this (tried first). What did, in a working reference fix for this
  // same error in another embedded-WebView YouTube player (Flutter's
  // youtube_player_flutter, PR #1086): the page (`baseUrl`) and the
  // player's own iframe (`host`) need to be same-origin, both on
  // youtube-nocookie.com - see those two below.
  152: "Player error (see baseUrl/host same-origin fix)",
  153: "Player error (see baseUrl/host same-origin fix)",
};

export const YouTubeIframeRenderer = ({ tnode }) => {
  const rawSrc = tnode?.attributes?.src;
  const src = rawSrc ? (rawSrc.startsWith("//") ? `https:${rawSrc}` : rawSrc) : null;

  // SoundCloud's widget src (https://w.soundcloud.com/player/?url=...) is
  // already a complete, self-contained player page - unlike YouTube's embed
  // src, it doesn't need to be routed through a custom HTML wrapper/IFrame
  // Player API, so it's loaded directly as the WebView's `uri` source below.
  const isSoundCloud = !!src && src.includes("w.soundcloud.com");

  const videoId = src && !isSoundCloud ? extractYouTubeId(src) : null;
  const width = Dimensions.get("window").width - 30;
  const height = isSoundCloud ? 166 : (width * 9) / 16;

  // Declared before the early return below so hook order stays stable
  // regardless of which branch (SoundCloud vs YouTube) ends up rendering.
  const html = useMemo(
    () => (isSoundCloud ? null : buildYouTubePlayerHtml(videoId)),
    [isSoundCloud, videoId],
  );
  const source = useMemo(
    () => (isSoundCloud ? { uri: src } : { html, baseUrl: "https://www.youtube-nocookie.com" }),
    [isSoundCloud, src, html],
  );

  if (isSoundCloud) {
    if (!rawSrc) return null;
    return (
      <View
        style={{
          width,
          height,
          marginVertical: 8,
          borderRadius: 8,
          overflow: Platform.OS === "ios" ? "hidden" : "visible",
          backgroundColor: "#000",
        }}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
      >
        <WebView
          source={source}
          style={{ width, height }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={["*"]}
          mixedContentMode="always"
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          userAgent={MOBILE_USER_AGENT}
          onError={(syntheticEvent) => {
            console.log("[SoundCloudEmbed] WebView onError", syntheticEvent.nativeEvent);
          }}
          onHttpError={(syntheticEvent) => {
            console.log("[SoundCloudEmbed] WebView onHttpError", syntheticEvent.nativeEvent);
          }}
        />
      </View>
    );
  }

  // Load the real YouTube IFrame Player API (iframe_api) and construct the
  // player through it instead of dropping a bare <iframe> in - a bare iframe
  // can silently fail with no way to surface why, whereas the JS API's
  // onError/onReady/onStateChange callbacks give the actual numeric error
  // code. `baseUrl` on the WebView gives the page a real origin (a raw
  // WebView `uri` load or file:// context has none, which the player
  // validates against and refuses to play without) - it has to match the
  // player's own `host` below, not youtube.com: a working fix for this same
  // error 152 in another embedded-WebView YouTube player (Flutter's
  // youtube_player_flutter, see its PR #1086) was pairing
  // baseUrl=youtube-nocookie.com with host=youtube-nocookie.com, i.e. the
  // page and the player iframe it creates being same-origin.
  // Memoized so the WebView's `source` object identity stays stable across
  // re-renders of the surrounding post (RenderHTML re-invokes this renderer
  // on every parent render) - otherwise a fresh {html, baseUrl} object each
  // time made the WebView think its source changed and reload the whole
  // player, which was showing up as duplicate boot/apiready log pairs.
  // (`html`/`source` themselves are declared above, before the SoundCloud
  // early return, so hook order stays stable across both branches.)

  if (!rawSrc || !videoId) return null;

  return (
    <View
      style={{
        width,
        height,
        marginVertical: 8,
        borderRadius: 8,
        // Android: overflow:hidden clips via a software canvas path, which
        // hardware-decoded video content (a SurfaceTexture the WebView's
        // Chromium compositor draws outside the normal view draw() call)
        // isn't part of - it doesn't get captured into that clip, and the
        // surface ends up not compositing at all: black screen, audio and
        // controls still work fine since those aren't part of view
        // rendering. Only clipping here on iOS (WKWebView doesn't have this
        // problem) trades rounded corners for the video actually being
        // visible on Android.
        overflow: Platform.OS === "ios" ? "hidden" : "visible",
        backgroundColor: "#000",
      }}
      // This whole embed sits inside the post content's collapse/expand
      // Pressable. Tapping inside a WebView (e.g. the play button) doesn't
      // reliably consume the native touch before it reaches that ancestor,
      // so without this, pressing play was also toggling handleExpandPost
      // and collapsing the post - hiding the embed along with it. Claiming
      // the responder here for any touch starting inside the embed, and
      // refusing to hand it back, keeps every tap local to the player.
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      <WebView
        source={source}
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
  isActive = true, // Whether this card is on-screen — drives inline video autoplay
}) => {
  const videoUrls = Array.isArray(item.video_urls)
    ? item.video_urls
    : (typeof item.video_urls === "string" && item.video_urls)
      ? item.video_urls.split(",").map((v) => v.trim()).filter(Boolean)
      : item.video_url
        ? [item.video_url]
        : item.video
          ? [item.video]
          : [];
  // Small muted low-bitrate copies for feed autoplay (see
  // MediaThumbnailService/video_preview_urls on the backend) - decode cost
  // scales with source resolution regardless of card size, so autoplaying
  // the full original in a feed card burns far more CPU than needed.
  // Index-paired with videoUrls; falls back to the full video wherever a
  // preview hasn't been generated yet (older posts, or the async job just
  // hasn't finished).
  const videoPreviewUrls = Array.isArray(item.video_preview_urls) ? item.video_preview_urls : [];
  const videoThumbnailUrls = Array.isArray(item.video_thumbnail_urls) ? item.video_thumbnail_urls : [];
  // Same idea for the feed grid - a full-resolution original is wasted
  // decode/network cost at collage-thumbnail size. Falls back to the full
  // image wherever no thumbnail exists. The full-screen ImageView viewer
  // below still uses the real image_urls, untouched.
  const imageThumbnailUrls = Array.isArray(item.image_thumbnail_urls) ? item.image_thumbnail_urls : [];
  const displayImageUrls = Array.isArray(item.image_urls)
    ? item.image_urls.map((url, i) => imageThumbnailUrls[i] || url)
    : item.image_urls;
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
      throw e;
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
        {!isCurrentUser && (
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
        )}
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

  // Posts don't support "@all" broadcast mentions (that's a comment/chat-
  // only feature) - a real "all" username can never exist since it's
  // reserved, so this only lights up @mentions the backend actually
  // resolved (item.mentions).
  const validMentions = useMemo(
    () => (Array.isArray(item.mentions) ? new Set(item.mentions.map((m) => m.username.toLowerCase())) : null),
    [item.mentions]
  );

  // Hashtag links in post content point at "/search?type=hashtag&q=tag";
  // intercept those to navigate in-app instead of trying to open a URL.
  // "/username" links come from linkifyMentionsInHtml (mention-tag class)
  // and open the mentioned user's profile instead. Anything else (autolinked
  // URLs) opens in the browser.
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
    const mentionMatch = href?.match(/^\/([\w.-]{3,21})$/);
    if (mentionMatch) {
      navigation?.navigate("ProfileScreen", { username: mentionMatch[1] });
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
              html: appendSoundCloudEmbedBelow(appendYouTubeEmbedBelow(
                linkifyMentionsInHtml(
                  isExpanded || !item.content || item.content.length <= 300
                    ? item.content || ""
                    : truncatedContent,
                  validMentions
                )
              )),
            }}
            baseStyle={{
              fontSize: 16,
              color: theme.text,
            }}
            classesStyles={{
              "mention-tag": {
                color: "#22c55e",
                fontWeight: "600",
              },
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
              h5: {
                fontSize: 13,
                fontWeight: "600",
                marginTop: 8,
                marginBottom: 4,
                color: theme.text,
              },
              h6: {
                fontSize: 12,
                fontWeight: "600",
                marginTop: 8,
                marginBottom: 4,
                color: theme.subText,
              },
              p: { marginBottom: 8, marginTop: 0, color: theme.text },
              ul: { marginVertical: 6 },
              ol: { marginVertical: 6 },
              li: { marginBottom: 4, color: theme.text },
              pre: {
                backgroundColor: isDarkMode ? "#2C2C2C" : "#f7f7f8",
                borderRadius: 6,
                padding: 12,
                marginVertical: 12,
              },
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
      {((item.image_urls && item.image_urls.length > 0) || (videoUrls && videoUrls.length > 0)) && (
        <View style={{ backgroundColor: isDarkMode ? "#1e1e1e" : "#E4EEE3", marginTop: 8 }}>
          {item.image_urls && item.image_urls.length > 0 && (
            <>
              <FBCollage
                images={displayImageUrls}
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
            </>
          )}
          {videoUrls && videoUrls.length > 0 && (() => {
            const hasImages = item.image_urls && item.image_urls.length > 0;
            const screenWidth = Dimensions.get("window").width;
            if (!hasImages) {
              // Video only — full width edge to edge
              const videoW = screenWidth;
              const videoH = Math.round((videoW * 9) / 16);
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 4 }}
                >
                  {videoUrls.map((url, index) => (
                    <InlineVideoPlayer
                      key={`${url}-${index}`}
                      uri={videoPreviewUrls[index] || url}
                      fullscreenUri={url}
                      thumbnailUri={videoThumbnailUrls[index]}
                      width={videoW}
                      height={videoH}
                      borderRadius={0}
                      isActive={isActive}
                    />
                  ))}
                </ScrollView>
              );
            }
            // Has images alongside — keep compact size
            return (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10, gap: 8 }}
              >
                {videoUrls.map((url, index) => (
                  <InlineVideoPlayer
                    key={`${url}-${index}`}
                    uri={videoPreviewUrls[index] || url}
                    fullscreenUri={url}
                    thumbnailUri={videoThumbnailUrls[index]}
                    width={single ? 260 : 220}
                    height={single ? 180 : 150}
                    borderRadius={12}
                    isActive={isActive}
                  />
                ))}
              </ScrollView>
            );
          })()}
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
