import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InlineVideoPlayer from "../../../../components/InlineVideoPlayer";
import FastImage from "../../../../components/FastImage";
import UserNameRow from "../../../../components/profile/UserNameRow";
import { AvatarFrameWrap } from "../../../../components/profile/AvatarFrame";
import MentionText from "../../../../components/MentionText";
import SharedPostCard from "../../../../components/SharedPostCard";
import LinkPreviewCard from "../../../../components/LinkPreviewCard";
import { findPreviewableUrl } from "../../../../utils/linkPreview";
import ReplyPreviewBubble from "../../../../components/ReplyPreviewBubble";
import Toast from "react-native-toast-message";
import { resolveMediaUrl, formatMessageTime } from "./chatUtils";
import { styles } from "./styles";
import { SwipeableMessage } from "./SwipeableMessage";
import { ReactionBadge } from "./ReactionBadge";
import { MultiAttachmentGrid } from "./MultiAttachmentGrid";

// A single message bubble (everything renderMessage used to build inline for
// item.type === "message"). Split into its own React.memo'd component -
// previously this was all inline in ConversationScreen's render, so ANY
// screen state change (typing indicator, a media load error on one message,
// scroll position) re-rendered and re-diffed EVERY message in the whole
// conversation, which is the main reason chats with lots of images/videos
// felt laggy well before you scrolled anywhere near the edge of what's
// mounted. Handlers are passed via a stable `handlersRef` (see
// messageHandlersRef in ConversationScreen) instead of directly, so this
// component's props stay referentially stable across unrelated re-renders
// and React.memo can actually skip re-rendering a bubble whose own message
// didn't change.
// Image.getSize() is a native/network round-trip (fetches remote image
// headers to learn intrinsic dimensions) - without caching, every mount of
// an image/video MessageRow re-issued it, so opening or scrolling through a
// conversation with lots of media fired potentially hundreds of redundant
// native calls at once. Keyed by URL and shared across all MessageRow
// instances/remounts for the lifetime of the app.
const imageAspectRatioCache = new Map();

const MessageRow = React.memo(({
  item,
  prevMessage,
  nextMessage,
  isGroupChat,
  theme,
  isDarkMode,
  t,
  username,
  navigation,
  mediaLoadError,
  isDownloadingThis,
  handlersRef,
  onImageError,
  activeInlineVideoId,
  autoplayVideos,
  seenAvatars,
  // Worked out once by MessagesListContent from the window width.
  bubbleMaxWidth,
}) => {

  // For group chats, check if sender changed from previous message. Also
  // true for the AI in a private chat (isGroupChat is false there, but its
  // name should still show above its bubble like it does everywhere else -
  // see the (isGroupChat || item.sender?.is_ai) check that reads this below).
  const senderChanged =
    (isGroupChat || item.sender?.is_ai) &&
    !item.is_myself &&
    (!prevMessage ||
      prevMessage.is_myself !== item.is_myself ||
      prevMessage.sender?.id !== item.sender?.id ||
      (prevMessage.sender?.username !== item.sender?.username &&
        !prevMessage.sender?.id &&
        !item.sender?.id));

  // Check if this is the last message in a group (same sender and same alignment).
  // This used to only compare actual sender identity when isGroupChat - fine
  // as long as a private (non-group) conversation could only ever have ONE
  // possible "not me" sender. That stopped being true once Yoyo AI can also
  // post into any conversation (e.g. someone replies to a message with /ai
  // inside a normal 1-on-1 chat): two consecutive "not me" messages from two
  // actually-different senders (the other human, then the AI) both have
  // is_myself === false, so without this check they were treated as one
  // group and only the last one got an avatar - making it look like a
  // single shared avatar for two different people. Now checks real sender
  // identity regardless of conversation type.
  const isLastInGroup =
    !nextMessage ||
    nextMessage.is_myself !== item.is_myself ||
    (!item.is_myself &&
      // Different sender IDs (for authenticated users)
      ((nextMessage.sender?.id &&
        item.sender?.id &&
        nextMessage.sender.id !== item.sender.id) ||
        // Different usernames (for guests or fallback)
        nextMessage.sender?.username !== item.sender?.username));

  // Check if this is a story reply message
  const isStoryReply = item.metadata?.story_reply === true;
  const storyOwnerName = item.metadata?.story_owner_name;

  // `type` is overloaded as the list envelope ("message"/"date"/"time"), so once a
  // message has gone through a refetch its original content type only survives in
  // `content_type` (see injectTimeHeaders) - check both so attachments keep
  // rendering as images/file cards instead of falling back to plain text.
  // A post shared from the feed: render the preview card instead of the bare
  // link, and keep whatever note the sender typed above it.
  const sharedTopic = item.metadata?.shared_topic || null;
  const sharedTopicNote = sharedTopic
    ? String(item.content || "").replace(sharedTopic.url || "", "").trim()
    : "";

  const isImageMessage = item.type === "image" || item.content_type === "image";
  const isVideoMessage = item.type === "video" || item.content_type === "video";
  const isFileMessage = item.type === "file" || item.content_type === "file";
  // Any other link pasted or typed into a text message gets a preview card
  // under the text, the way a shared post does.
  const linkPreviewUrl = useMemo(
    () =>
      sharedTopic || item.is_recalled || isImageMessage || isVideoMessage || isFileMessage
        ? null
        : findPreviewableUrl(item.content),
    [sharedTopic, item.is_recalled, isImageMessage, isVideoMessage, isFileMessage, item.content]
  );
  const resolvedFileUrl = resolveMediaUrl(item.file_url);
  const resolvedThumbnailUrl = resolveMediaUrl(item.metadata?.thumbnail_url);
  // Small (480px) muted preview clip for autoplay - see
  // MediaThumbnailService::videoPreview on the backend. Decoding a full
  // compressed video (up to 1920x1080) inline in a ~200px bubble burns far
  // more CPU than that tiny player needs; falls back to the full file for
  // older messages sent before this existed.
  const resolvedPreviewUrl = resolveMediaUrl(item.metadata?.preview_url);
  // Same idea for the static image bubble - a full-resolution original is
  // wasted decode/network cost at bubble size. Backend generates this
  // synchronously at send time, but falls back to the full file if it's
  // ever missing rather than showing nothing.
  const displayImageUrl = isImageMessage ? (resolvedThumbnailUrl || resolvedFileUrl) : null;
  const [imageAspectRatio, setImageAspectRatio] = useState(null);

  useEffect(() => {
    const url = isImageMessage ? displayImageUrl : isVideoMessage ? resolvedThumbnailUrl : null;
    if (!url) {
      setImageAspectRatio(null);
      return undefined;
    }

    const cached = imageAspectRatioCache.get(url);
    if (cached != null) {
      setImageAspectRatio(cached);
      return undefined;
    }

    let cancelled = false;
    setImageAspectRatio(null);
    // Try to get intrinsic size so we can preserve original ratio instead of 1:1 crop
    Image.getSize(
      url,
      (w, h) => {
        if (w > 0 && h > 0) imageAspectRatioCache.set(url, w / h);
        if (!cancelled && w > 0) setImageAspectRatio(w / h);
      },
      () => {
        /* ignore error, keep default square fallback */
      }
    );
    return () => {
      cancelled = true;
    };
  }, [displayImageUrl, resolvedThumbnailUrl, isImageMessage, isVideoMessage]);

  const handleSwipeReply = () => {
    // Still sending: it has no real id to reply to yet.
    if (item.is_sending) return;
    const contentType =
      item.type === "image" || item.type === "video" || item.type === "file"
        ? item.type
        : item.content_type === "image" || item.content_type === "video" || item.content_type === "file"
          ? item.content_type
          : "text";
    handlersRef.current.setReplyingTo({
      id: item.id,
      content: contentType === "text" ? item.content : null,
      type: contentType,
      file_url: item.file_url ?? null,
      sender: item.sender,
    });
    handlersRef.current.focusInput?.();
  };

  return (
    <SwipeableMessage isMyMessage={item.is_myself} onSwipe={handleSwipeReply}>
    <View
      style={[
        // Add extra spacing for group chats when sender changes (applies to entire message block)
        isGroupChat &&
          !item.is_myself &&
          senderChanged &&
          styles.groupMessageWrapper,
      ]}
    >
      {/* Show story reply header */}
      {isStoryReply && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            const storyId = item.metadata?.story_id ?? item.metadata?.storyId;
            if (storyId) {
              // popTo, not navigate: navigate would push a second copy of
              // the tabs (and of the home feed) on top of this chat.
              navigation.popTo("MainScreens", {
                screen: "Home",
                params: { openStoryId: storyId },
              });
            } else {
              Toast.show({
                type: "info",
                text1: t("common.error"),
                text2: t("chatConversation.storyNotAvailable"),
              });
            }
          }}
        >
          <View
            style={[
              styles.storyReplyHeader,
              item.is_myself && styles.storyReplyHeaderRight,
            ]}
          >
            {item.is_myself ? (
              <>
                <Text
                  style={[
                    styles.storyReplyText,
                    styles.storyReplyTextRight,
                    { color: theme.subText },
                  ]}
                >
                  {t("chatConversation.storyReply.you", {
                    owner: storyOwnerName || t("chatConversation.anonymous"),
                  })}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={theme.subText}
                />
              </>
            ) : (
              <>
                <Ionicons name="arrow-back" size={14} color={theme.subText} />
                <Text
                  style={[styles.storyReplyText, { color: theme.subText }]}
                >
                  {t("chatConversation.storyReply.other", {
                    sender:
                      item.sender?.profile_name ||
                      item.sender?.username ||
                      t("chatConversation.anonymous"),
                  })}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      )}
      {/* Show sender name for group chats when sender changes, and always for Yoyo AI */}
      {(isGroupChat || item.sender?.is_ai) && !item.is_myself && senderChanged && (
        <UserNameRow
          name={
            item.sender?.profile_name ||
            item.sender?.username ||
            t("chatConversation.anonymous")
          }
          theme={item.sender?.profile_theme}
          style={[styles.senderNameText, { color: theme.subText }]}
          containerStyle={styles.senderName}
        />
      )}
      <View
        style={[
          styles.messageContainer,
          item.is_myself
            ? styles.myMessageContainer
            : styles.theirMessageContainer,
        ]}
      >
        {!item.is_myself && isLastInGroup && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handlersRef.current.openSenderActions?.(item.sender)}
          >
            <AvatarFrameWrap
              theme={item.sender?.profile_theme}
              size={32}
              style={styles.messageAvatarWrap}
            >
              <FastImage
                source={{
                  uri:
                    item.sender?.avatar_url ||
                    "https://chuyenbienhoa.com/assets/images/placeholder-user.jpg",
                }}
                style={styles.messageAvatar}
              />
            </AvatarFrameWrap>
          </TouchableOpacity>
        )}
        <View
          style={{
            position: "relative",
            maxWidth: bubbleMaxWidth,
            flexShrink: 1,
            alignSelf: item.is_myself ? "flex-end" : "flex-start",
            // The reaction badge hangs off the bottom corner of the bubble
            // (see reactionAddBadge/reactionPillBadge) - without this the
            // next message's footer/timestamp sits right underneath it.
            marginBottom: 16,
          }}
        >
          <Pressable
            style={[
              styles.messageBubble,
              // maxWidth already lives on the wrapper above - a percentage
              // value here would resolve against this wrapper's own
              // auto-sized width instead of the row's, collapsing text to
              // ~1 char per line. Cancel it out.
              { maxWidth: undefined, flexShrink: 1 },
              isImageMessage || isVideoMessage
                ? styles.imageMessageBubble
                : isFileMessage
                  ? [
                      styles.fileMessageBubble,
                      item.is_myself
                        ? [styles.myMessageBubble, { backgroundColor: isDarkMode ? "#064e3b" : "#E8F5E9" }]
                        : [styles.theirMessageBubble, { backgroundColor: isDarkMode ? "#1f2937" : "#F5F5F5" }],
                    ]
                  : item.type === "chat" || item.type === "part"
                  ? [
                      item.is_myself
                        ? styles.myMessageBubble
                        : styles.theirMessageBubble,
                      styles.chatMessageBubble,
                      {
                        borderColor: isDarkMode
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.08)",
                      },
                    ]
                  : item.is_myself
                    ? [
                        styles.myMessageBubble,
                        { backgroundColor: isDarkMode ? "#064e3b" : "#E8F5E9" },
                      ]
                    : [
                        styles.theirMessageBubble,
                        { backgroundColor: isDarkMode ? "#1f2937" : "#F5F5F5" },
                      ],
              !item.is_myself && !isLastInGroup && { marginLeft: 40 },
            ]}
            onLongPress={(evt) => handlersRef.current.openReactionPicker(item, evt)}
            delayLongPress={350}
            onPress={
              item.is_recalled ? undefined : () => {
                const now = Date.now();
                const lastTap = handlersRef.current.lastTapRef.current[item.id] || 0;
                if (now - lastTap < 300) {
                  handlersRef.current.handleDoubleTapMessage(item);
                } else {
                  handlersRef.current.lastTapRef.current[item.id] = now;
                  if (isImageMessage && resolvedFileUrl) {
                    handlersRef.current.openImageViewer(resolvedFileUrl);
                  } else if (isVideoMessage && resolvedFileUrl) {
                    handlersRef.current.openVideoViewer(resolvedFileUrl);
                  } else if (isFileMessage && resolvedFileUrl) {
                    handlersRef.current.handleOpenFile(item);
                  }
                }
              }
            }
          >
            {item.is_recalled ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, opacity: 0.55 }}>
                <Ionicons name="arrow-undo-outline" size={14} color={item.is_myself ? "#fff" : (isDarkMode ? "#aaa" : "#555")} />
                <Text style={{ fontStyle: "italic", color: item.is_myself ? "#fff" : (isDarkMode ? "#aaa" : "#555"), fontSize: 14 }}>
                  {t("chatConversation.recalled", "Tin nhắn đã bị thu hồi")}
                </Text>
              </View>
            ) : null}
            {item.reply_to && !item.is_recalled && (
              <ReplyPreviewBubble
                item={item}
                currentUsername={username}
                onPress={() => handlersRef.current.handleJumpToRepliedMessage(item.reply_to.id)}
              />
            )}
            {!item.is_recalled &&
            (isImageMessage || isVideoMessage) &&
            Array.isArray(item.file_urls) &&
            item.file_urls.length > 1 ? (
              <MultiAttachmentGrid
                urls={item.file_urls}
                isVideo={isVideoMessage}
                onPressItem={(idx) => {
                  if (isImageMessage) {
                    handlersRef.current.openImageViewerGallery(
                      item.file_urls.map(resolveMediaUrl),
                      idx,
                    );
                  } else {
                    handlersRef.current.openVideoViewer(
                      resolveMediaUrl(item.file_urls[idx]),
                    );
                  }
                }}
              />
            ) : !item.is_recalled && isImageMessage && item.file_url ? (
              <>
                {mediaLoadError ? (
                  // Tap to try again (one failure used to be final for the
                  // whole visit). The native reason stays in the log only.
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => onImageError(item.id, null)}
                    style={[styles.messageImage, styles.mediaErrorFallback]}
                  >
                    <Ionicons name="refresh" size={28} color="#fff" />
                    <Text style={styles.mediaErrorText} numberOfLines={2}>
                      {t("chatConversation.loadImageError", "Không tải được ảnh")}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <FastImage
                    source={{ uri: displayImageUrl }}
                    shimmer
                    style={
                      imageAspectRatio
                        ? [styles.messageImage, { aspectRatio: imageAspectRatio, height: undefined }]
                        : styles.messageImage
                    }
                    resizeMode={"cover"}
                    onError={(e) => {
                      const reason = e?.nativeEvent?.error || "unknown error";
                      console.error("[ChatMedia] image FAILED to load", {
                        id: item.id,
                        raw_file_url: item.file_url,
                        resolved: displayImageUrl,
                        reason,
                      });
                      onImageError(item.id, reason);
                    }}
                  />
                )}
                {item.is_sending && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    {typeof item.upload_progress === "number" && (
                      <Text style={styles.uploadProgressText}>
                        {item.upload_progress}%
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : !item.is_recalled && isVideoMessage ? (
              <>
                {autoplayVideos && String(item.id) === String(activeInlineVideoId) ? (
                  (() => {
                    const thumbWidth = 200;
                    const thumbHeight = imageAspectRatio
                      ? Math.round(thumbWidth / imageAspectRatio)
                      : 200;
                    return (
                      <InlineVideoPlayer
                        uri={resolvedPreviewUrl || resolvedFileUrl}
                        width={thumbWidth}
                        height={thumbHeight}
                        borderRadius={12}
                        isActive={true}
                        interactive={false}
                      />
                    );
                  })()
                ) : (
                  resolvedThumbnailUrl ? (
                    <FastImage
                      source={{ uri: resolvedThumbnailUrl }}
                      shimmer
                      style={
                        imageAspectRatio
                          ? [styles.messageImage, { aspectRatio: imageAspectRatio, height: undefined }]
                          : styles.messageImage
                      }
                      resizeMode={"cover"}
                      onError={undefined}
                    />
                  ) : (
                    <View style={[styles.messageImage, styles.videoPlaceholder]} />
                  )
                )}
                {!(autoplayVideos && String(item.id) === String(activeInlineVideoId)) && (
                  <View style={styles.videoPlayOverlay}>
                    <Ionicons name="play" size={22} color="#fff" />
                  </View>
                )}
                {item.is_sending && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    {typeof item.upload_progress === "number" && (
                      <Text style={styles.uploadProgressText}>
                        {item.upload_progress}%
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : !item.is_recalled && isFileMessage ? (
              <View style={styles.fileMessageContent}>
                <View style={styles.fileIconWrapper}>
                  {isDownloadingThis ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color={theme.primary}
                    />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      styles.fileMessageName,
                      {
                        color: item.is_myself
                          ? isDarkMode
                            ? "#ecfdf5"
                            : "#000"
                          : theme.text,
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {item.content || item.file_name || t("chatConversation.attachment", "Tệp đính kèm")}
                  </Text>
                  <Text style={[styles.fileMessageSub, { color: theme.subText }]}>
                    {item.is_sending
                      ? typeof item.upload_progress === "number"
                        ? t("chatConversation.sendingPercent", "Đang gửi... {{percent}}%", {
                            percent: item.upload_progress,
                          })
                        : t("chatConversation.sending", "Đang gửi...")
                      : isDownloadingThis
                        ? t("chatConversation.downloading", "Đang tải...")
                        : t("chatConversation.tapToOpen", "Nhấn để mở")}
                  </Text>
                </View>
              </View>
            ) : !item.is_recalled && sharedTopic ? (
              <View style={{ gap: 8 }}>
                {sharedTopicNote ? (
                  <MentionText
                    style={[
                      styles.messageText,
                      {
                        color: item.is_myself
                          ? isDarkMode
                            ? "#ecfdf5"
                            : "#000"
                          : theme.text,
                      },
                    ]}
                    mentions={item.mentions}
                    allowBroadcastMention={isGroupChat}
                    onMentionPress={(username) =>
                      navigation.navigate("ProfileScreen", { username })
                    }
                  >
                    {sharedTopicNote}
                  </MentionText>
                ) : null}
                <SharedPostCard
                  topic={sharedTopic}
                  compact
                  onPress={() =>
                    navigation.navigate("PostScreen", { postId: sharedTopic.id })
                  }
                />
              </View>
            ) : !item.is_recalled ? (
              <MentionText
                style={[
                  styles.messageText,
                  {
                    color: item.is_myself
                      ? isDarkMode
                        ? "#ecfdf5"
                        : "#000"
                      : theme.text,
                  },
                ]}
                mentions={item.mentions}
                // 1-1 conversations only ever have the two participants -
                // @all has no meaning there, so it must render as plain
                // text instead of a highlighted/tappable mention.
                allowBroadcastMention={isGroupChat}
                enableAiCommands
                onMentionPress={(username) =>
                  navigation.navigate("ProfileScreen", { username })
                }
              >
                {item.content}
              </MentionText>
            ) : null}
            {linkPreviewUrl ? (
              <LinkPreviewCard url={linkPreviewUrl} compact style={{ marginTop: 8 }} />
            ) : null}
          </Pressable>
          <ReactionBadge item={item} theme={theme} isDarkMode={isDarkMode} handlersRef={handlersRef} />
        </View>
      </View>
      {isLastInGroup && (
        <View
          style={[
            styles.messageFooter,
            item.is_myself
              ? styles.myMessageFooter
              : styles.theirMessageFooter,
            !item.is_myself && { marginLeft: 40 },
          ]}
        >
          <Text style={[styles.messageTime, { color: theme.subText }]}>
            {formatMessageTime(item.created_at, t)}
            {item.is_edited && !item.is_recalled ? (
              <Text style={{ fontSize: 11, fontStyle: "italic", color: theme.subText }}>
                {" "}{t("chatConversation.edited", "(Đã sửa)")}
              </Text>
            ) : null}
          </Text>
          {!isGroupChat && item.is_myself && (
            <View style={styles.readStatus}>
              {item.read_at ? (
                <View style={styles.doubleCheck}>
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.primary}
                    style={styles.checkOverlap}
                  />
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.primary}
                  />
                </View>
              ) : (
                <Ionicons name="checkmark" size={12} color={theme.subText} />
              )}
            </View>
          )}
          {isGroupChat && seenAvatars?.length > 0 && (
            <TouchableOpacity
              style={styles.seenByRow}
              onPress={() => handlersRef.current.showSeenBy?.(seenAvatars)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {seenAvatars.slice(0, 3).map((p, i) => (
                <FastImage
                  key={p.id}
                  source={{ uri: p.avatar_url }}
                  style={[
                    styles.seenAvatar,
                    { borderColor: theme.background, marginLeft: i === 0 ? 0 : -6 },
                  ]}
                />
              ))}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
    </SwipeableMessage>
  );
}, (prev, next) => {
  // Custom comparator: `mediaLoadError`/`isDownloadingThis` are already
  // narrowed to this row's own value by the caller, so a plain shallow prop
  // comparison (React.memo's default) is exactly what we want - no custom
  // logic needed beyond letting unspecified props fall through to reference
  // equality. This comparator exists only to document that intent;
  // functionally it mirrors the default shallow comparison.
  return (
    prev.item === next.item &&
    prev.prevMessage === next.prevMessage &&
    prev.nextMessage === next.nextMessage &&
    prev.isGroupChat === next.isGroupChat &&
    prev.theme === next.theme &&
    prev.isDarkMode === next.isDarkMode &&
    prev.t === next.t &&
    prev.username === next.username &&
    prev.navigation === next.navigation &&
    prev.mediaLoadError === next.mediaLoadError &&
    prev.isDownloadingThis === next.isDownloadingThis &&
    prev.activeInlineVideoId === next.activeInlineVideoId &&
    prev.autoplayVideos === next.autoplayVideos &&
    prev.handlersRef === next.handlersRef &&
    prev.onImageError === next.onImageError &&
    prev.seenAvatars === next.seenAvatars &&
    prev.bubbleMaxWidth === next.bubbleMaxWidth
  );
});

export { MessageRow };
