import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  RefreshControl,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import FastImage from "../../../components/FastImage";
import {
  resolveNotificationTarget,
  isAnonymousNotificationActor,
} from "../../../utils/notificationRouting";
import { Ionicons } from "@expo/vector-icons";
import CustomLoading from "../../../components/CustomLoading";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  isRequestCanceled,
} from "../../../services/api/Api";
import { useUnreadCountsContext } from "../../../contexts/UnreadCountsContext";
import { useFocusEffect } from "@react-navigation/native";
import formatTime from "../../../utils/formatTime";
import { useTheme } from "../../../contexts/ThemeContext";
import { storage } from "../../../global/storage";
import { useTranslation } from "react-i18next";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import StyledName from "../../../components/profile/StyledName";
import NameIcon from "../../../components/profile/NameIcon";
import { getNameIcon } from "../../../utils/profileTheme";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";
import { LinearGradient } from "expo-linear-gradient";

const MODERATED_CONTENT_TYPES = ["topic", "comment", "message", "story"];
const contentTypeKey = (contentType) =>
  MODERATED_CONTENT_TYPES.includes(contentType) ? contentType : "other";

// Second line under a moderation notice: the admin's note when there is one,
// otherwise a short excerpt of the content so the user knows which one.
const moderationDetail = (notification, t) => {
  const { type, data } = notification;
  if (type !== "content_warning" && type !== "content_deleted") return null;
  const note = typeof data?.note === "string" ? data.note.trim() : "";
  if (note) return t('notifications.moderatorNote', { note });
  const excerpt = typeof data?.excerpt === "string" ? data.excerpt.trim() : "";
  return excerpt || null;
};

// Helper function to format notification message based on type and data
const formatNotificationMessage = (notification, t) => {
  const { type, data, actor } = notification;

  if (type === "payment_received") {
    return data?.message || data?.title || t('notifications.newNotification');
  }

  // System messages don't have an actor
  if (type === "system_message") {
    return data?.message || t('notifications.newNotification');
  }

  if (!actor) {
    // Handle other notifications without actor
    switch (type) {
      case "content_pending_review":
        return t(data?.content_type === "story"
          ? 'notifications.contentPendingReviewStory'
          : data?.comment_id
            ? 'notifications.contentPendingReviewComment'
            : 'notifications.contentPendingReviewPost');
      case "content_approved":
        return t(data?.content_type === "story"
          ? 'notifications.contentApprovedStory'
          : data?.comment_id
            ? 'notifications.contentApprovedComment'
            : 'notifications.contentApprovedPost');
      case "content_rejected":
        return t(data?.content_type === "story"
          ? 'notifications.contentRejectedStory'
          : data?.comment_id
            ? 'notifications.contentRejectedComment'
            : 'notifications.contentRejectedPost');
      case "moderation_pending":
        return t(
          data?.content_type === "story"
            ? 'notifications.moderationPendingStory'
            : data?.content_type === "comment"
              ? 'notifications.moderationPendingComment'
              : 'notifications.moderationPendingPost',
          { username: data?.author_username || "" }
        );
      case "content_warning":
        return t(`notifications.contentWarning.${contentTypeKey(data?.content_type)}`);
      case "content_deleted":
        return t(`notifications.contentDeleted.${contentTypeKey(data?.content_type)}`);
      case "topic_pinned":
        return `${t('notifications.pinnedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
      case "topic_moved":
        return `${t('notifications.movedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
      case "topic_closed":
        return `${t('notifications.closedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
      default:
        return t('notifications.newNotification');
    }
  }

  const actorName = actor.profile_name || actor.username;

  switch (type) {
    case "topic_liked":
      return `${t('notifications.likedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "topic_downvoted":
      return `${t('notifications.downvotedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "topic_commented":
      return `${t('notifications.commentedPost')} "${data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "topic_pinned":
      return `${t('notifications.pinnedPost')} "${data?.topic_title || ""}"`;
    case "topic_moved":
      return `${t('notifications.movedPost')} "${data?.topic_title || ""}"`;
    case "topic_closed":
      return `${t('notifications.closedPost')} "${data?.topic_title || ""}"`;
    case "comment_liked":
      return t('notifications.likedComment');
    case "comment_downvoted":
      return t('notifications.downvotedComment');
    case "comment_replied":
      return t('notifications.repliedComment');
    case "mentioned":
      if (data?.conversation_id) return t('notifications.mentionedInChat');
      if (data?.comment_id) return t('notifications.mentionedComment');
      if (data?.story_id) return t('notifications.mentionedInStory');
      return t('notifications.mentionedInPost');
    case "followed":
      return t('notifications.followedYou');
    case "points_gifted":
      return `${t('notifications.giftedPoints', { amount: Number(data?.amount || 0).toLocaleString() })}${data?.message ? `: "${data.message}"` : ""}`;
    case "story_reacted":
      return `${t('notifications.reactedStory')} ${data?.reaction_emoji || "👍"} ${t('notifications.toYourStory')}`;
    case "story_replied":
      return t('notifications.repliedStory');
    case "message_reacted":
      return `${t('notifications.reactedMessage')} ${data?.reaction_emoji || "👍"} ${t('notifications.toYourMessage')}`;
    case "message_replied":
      return t('notifications.repliedMessage');
    case "added_to_group":
      return `${t('notifications.addedToGroup')} "${data?.conversation_name || ""}"`;
    case "removed_from_group":
      return `${t('notifications.removedFromGroup')} "${data?.conversation_name || ""}"`;
    case "group_role_changed":
      if ((data?.role || "") === "owner") {
        return `${t('notifications.transferredOwnership')} "${data?.conversation_name || ""}"`;
      }
      if ((data?.role || "") === "member") {
        return `${t('notifications.removedDeputyRole')} "${data?.conversation_name || ""}"`;
      }
      return `${t('notifications.madeDeputy')} "${data?.conversation_name || ""}"`;
    case "conversation_background_changed":
      return data?.conversation_type === "group"
        ? `${t('notifications.changedBackgroundGroup')} "${data?.conversation_name || ""}"`
        : t('notifications.changedBackgroundPrivate');
    case "study_material_purchased":
      return `${t('notifications.purchasedMaterial')} "${data?.material_title || ""}"`;
    case "study_material_rated":
      return `${t('notifications.ratedMaterial')} "${data?.material_title || ""}"`;
    case "system_message":
    case "system_alert":
      return data?.message || t('notifications.systemSentMessage');
    case "App\\Notifications\\PostLiked":
      return `${t('notifications.likedPost')} "${data?.post_title || data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "App\\Notifications\\PostCommented":
      return `${t('notifications.commentedPost')} "${data?.post_title || data?.topic_title || ""}" ${t('notifications.ofYours')}`;
    case "App\\Notifications\\UserFollowed":
      return t('notifications.followedYou');
    case "App\\Notifications\\UserMentioned":
      return t('notifications.mentionedComment');
    case "App\\Notifications\\CommentReplied":
      return t('notifications.repliedComment');
    default:
      return t('notifications.interactedWithYou');
  }
};

// Map each notification to its appropriate badge icon, background color, and foreground color
const getNotificationBadge = (item) => {
  const type = item.type;
  const contentType = item.data?.content_type;

  // Moderation & Warnings
  if (type === "content_warning") {
    if (contentType === "message") {
      return {
        bg: "#22C55E",
        icon: "chatbubble-ellipses",
        color: "#FFFFFF",
      };
    }
    return {
      bg: "#EF4444",
      icon: "alert",
      color: "#FFFFFF",
    };
  }

  if (type === "content_deleted" || type === "content_rejected") {
    return {
      bg: "#EF4444",
      icon: "close",
      color: "#FFFFFF",
    };
  }

  if (type === "content_approved") {
    return {
      bg: "#22C55E",
      icon: "checkmark",
      color: "#FFFFFF",
    };
  }

  if (type === "content_pending_review" || type === "moderation_pending") {
    return {
      bg: "#EF4444",
      icon: "heart",
      color: "#FFFFFF",
    };
  }

  // Reactions & Likes
  if (
    type === "topic_liked" ||
    type === "comment_liked" ||
    type === "App\\Notifications\\PostLiked"
  ) {
    return {
      bg: "#3B82F6",
      icon: "flash",
      color: "#FFFFFF",
    };
  }

  // Comments & Replies
  if (
    type === "topic_commented" ||
    type === "comment_replied" ||
    type === "App\\Notifications\\PostCommented" ||
    type === "App\\Notifications\\CommentReplied" ||
    type === "mentioned"
  ) {
    return {
      bg: "#3B82F6",
      icon: "chatbubble",
      color: "#FFFFFF",
    };
  }

  if (type === "story_reacted") {
    return {
      bg: "#EC4899",
      icon: "heart",
      color: "#FFFFFF",
    };
  }

  if (type === "story_replied" || type === "message_replied") {
    return {
      bg: "#22C55E",
      icon: "arrow-undo",
      color: "#FFFFFF",
    };
  }

  if (type === "followed" || type === "App\\Notifications\\UserFollowed") {
    return {
      bg: "#22C55E",
      icon: "person-add",
      color: "#FFFFFF",
    };
  }

  if (type === "points_gifted") {
    return {
      bg: "#F59E0B",
      icon: "gift",
      color: "#FFFFFF",
    };
  }

  if (type === "system_message" || type === "system_alert") {
    return {
      bg: "#22C55E",
      icon: "arrow-undo",
      color: "#FFFFFF",
    };
  }

  return {
    bg: "#22C55E",
    icon: "notifications",
    color: "#FFFFFF",
  };
};

const getPostThumbnail = (item) => {
  return (
    item.data?.thumbnail_url ||
    item.data?.thumbnail ||
    item.data?.topic_thumbnail ||
    item.data?.topic_thumbnail_url ||
    item.data?.image_url ||
    item.data?.image ||
    item.data?.first_image ||
    item.data?.first_image_url ||
    item.data?.cover_image ||
    item.data?.topic_image_url ||
    item.data?.topic_image ||
    item.data?.post_image ||
    item.data?.post_thumbnail ||
    (Array.isArray(item.data?.image_urls) ? item.data.image_urls[0] : null) ||
    (Array.isArray(item.data?.images) ? item.data.images[0] : null) ||
    null
  );
};

const FILTER_TABS = [
  { id: "all", labelKey: "notifications.filterAll", defaultLabel: "Tất cả", icon: "notifications" },
  { id: "posts", labelKey: "notifications.filterPosts", defaultLabel: "Bài viết", icon: "chatbubble-outline" },
  { id: "interactions", labelKey: "notifications.filterInteractions", defaultLabel: "Tương tác", icon: "heart-outline" },
  { id: "system", labelKey: "notifications.filterSystem", defaultLabel: "Hệ thống", icon: "people-outline" },
];

export default function NotificationScreen({ navigation, scrollTriggerRef }) {
  const { theme, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const isFetchingRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const abortControllerRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { refreshNotificationCount, setNotificationUnreadCount } =
    useUnreadCountsContext();

  const fetchNotifications = useCallback(
    async (pageNum = 1, append = false) => {
      if (isFetchingRef.current && append) return;
      isFetchingRef.current = true;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (append) {
        setLoadingMore(true);
        setLoadMoreError(false);
      }

      try {
        if (pageNum === 1 && !append) {
          const cachedStr = storage.getString("cached_notifications");
          if (cachedStr) {
            try {
              const parsed = JSON.parse(cachedStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setNotifications(parsed);
                setLoading(false);
              }
            } catch (e) {}
          }
          setRefreshing(true);
          setLoadMoreError(false);
        }

        const response = await getNotifications(pageNum, 20, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        const notificationsData =
          response.data?.notifications || response.notifications || [];
        const fetchedNotifications = Array.isArray(notificationsData)
          ? notificationsData
          : [];

        const formattedNotifications = fetchedNotifications.map((notif) => {
          const isSystemMessage =
            notif.type === "system_message" || !notif.actor;

          return {
            id: notif.id,
            type: notif.type,
            data: notif.data,
            is_read: notif.is_read,
            read_at: notif.read_at,
            created_at: notif.created_at,
            created_at_human: notif.created_at_human,
            actor: notif.actor,
            user: {
              name: isSystemMessage
                ? t('notifications.system')
                : notif.actor?.profile_name ||
                  notif.actor?.username ||
                  t('notifications.user'),
              avatar: isSystemMessage
                ? "https://api.chuyenbienhoa.com/v1.0/users/system/avatar"
                : notif.actor?.avatar_url ||
                  `https://api.chuyenbienhoa.com/v1.0/users/${notif.actor?.username}/avatar`,
            },
            content: formatNotificationMessage(notif, t),
            time: formatTime(notif.created_at),
            read: notif.is_read,
            raw: notif,
          };
        });

        if (append) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const deduped = formattedNotifications.filter((n) => !existingIds.has(n.id));
            return [...prev, ...deduped];
          });
        } else {
          setNotifications(formattedNotifications);
          if (formattedNotifications.length > 0) {
            storage.set("cached_notifications", JSON.stringify(formattedNotifications));
          }
          // Automatically mark all as read whenever the user views the screen
          markAllNotificationsAsRead().catch(() => {});
          setNotificationUnreadCount(0);
        }

        pageRef.current = pageNum;
        setPage(pageNum);

        const paginationData = response.data?.pagination || response.pagination;
        const nextHasMore = paginationData
          ? paginationData.current_page < paginationData.last_page
          : fetchedNotifications.length === 20;
        hasMoreRef.current = nextHasMore;
        setHasMore(nextHasMore);
      } catch (error) {
        if (isRequestCanceled(error) || controller.signal.aborted) return;
        if (append) {
          setLoadMoreError(true);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          isFetchingRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [t, setNotificationUnreadCount]
  );

  useEffect(() => {
    fetchNotifications(1, false);
    return () => {
      abortControllerRef.current?.abort();
      isFetchingRef.current = false;
    };
  }, [fetchNotifications]);

  // When user focuses or switches to the Notification screen:
  // Automatically mark all as read immediately (no need to tap checkmark)
  useFocusEffect(
    useCallback(() => {
      setNotificationUnreadCount(0);
      markAllNotificationsAsRead()
        .then(() => {
          setNotifications((prev) =>
            prev.map((notif) => (notif.is_read ? notif : { ...notif, is_read: true, read: true }))
          );
        })
        .catch(() => {});
    }, [setNotificationUnreadCount])
  );

  const flatListRef = useRef(null);

  const scrollToTopOrReload = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setRefreshing(true);
    pageRef.current = 1;
    hasMoreRef.current = true;
    setPage(1);
    setHasMore(true);
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    pageRef.current = 1;
    hasMoreRef.current = true;
    setPage(1);
    setHasMore(true);
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  const loadMore = useCallback(() => {
    if (isFetchingRef.current || loading || refreshing || !hasMoreRef.current || loadMoreError) {
      return;
    }
    fetchNotifications(pageRef.current + 1, true);
  }, [loading, refreshing, loadMoreError, fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, is_read: true, read: true }
            : notif
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Filter notifications according to the active tab pill
  const filteredNotifications = useMemo(() => {
    if (activeTab === "all") return notifications;

    if (activeTab === "posts") {
      const postTypes = [
        "topic_liked", "topic_downvoted", "topic_commented", "topic_pinned",
        "topic_moved", "topic_closed", "comment_liked", "comment_downvoted",
        "comment_replied", "mentioned", "study_material_purchased", "study_material_rated",
        "App\\Notifications\\PostLiked", "App\\Notifications\\PostCommented",
        "App\\Notifications\\CommentReplied", "App\\Notifications\\UserMentioned"
      ];
      return notifications.filter((n) => postTypes.includes(n.type));
    }

    if (activeTab === "interactions") {
      const interactionTypes = [
        "topic_liked", "comment_liked", "App\\Notifications\\PostLiked",
        "story_reacted", "story_replied", "message_reacted", "message_replied",
        "followed", "points_gifted", "added_to_group", "removed_from_group",
        "group_role_changed", "conversation_background_changed", "App\\Notifications\\UserFollowed"
      ];
      return notifications.filter((n) => interactionTypes.includes(n.type));
    }

    if (activeTab === "system") {
      const systemTypes = [
        "content_warning", "content_deleted", "content_pending_review",
        "content_approved", "content_rejected", "moderation_pending",
        "system_message", "system_alert", "payment_received"
      ];
      return notifications.filter((n) => systemTypes.includes(n.type) || !n.actor);
    }

    return notifications;
  }, [notifications, activeTab]);

  const listExtraData = useMemo(
    () => ({ t, theme, isDarkMode, activeTab }),
    [t, theme, isDarkMode, activeTab]
  );

  const renderItem = ({ item }) => {
    const isAnonymous = isAnonymousNotificationActor(item.type, item.data, item.actor);
    const isSystemMessage = item.type === "system_message" || (!item.actor && !isAnonymous);
    const isModerationWarning = item.type === "content_warning" || item.type === "content_deleted";
    const resolvedActorName = item.actor?.profile_name || item.actor?.username;
    const userName = isSystemMessage
      ? t('notifications.system')
      : isAnonymous
        ? (resolvedActorName && resolvedActorName !== "null" ? resolvedActorName : (t('createPost.anonymousUser') || "Ẩn danh"))
        : (resolvedActorName && resolvedActorName !== "null" ? resolvedActorName : (t('notifications.user') || "Người dùng"));
    const actorTheme = isSystemMessage || isAnonymous ? null : item.actor?.profile_theme;
    const displayContent = formatNotificationMessage(item.raw || item, t);
    const moderationText = moderationDetail(item, t);
    const displayTime = item.created_at ? formatTime(item.created_at) : item.time;
    const badge = getNotificationBadge(item);
    const postThumbnail = getPostThumbnail(item);
    const isUnread = !item.read && !item.is_read;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        style={[
          styles.card,
          {
            backgroundColor: isDarkMode ? "#18181B" : "#FFFFFF",
            borderColor: isDarkMode ? "#27272A" : "#F0F2F5",
          },
          isUnread && styles.cardUnread,
        ]}
        onPress={() => {
          if (!item.read) {
            handleMarkAsRead(item.id);
          }
          const target = resolveNotificationTarget({
            type: item.type,
            data: item.data,
            actor: item.actor,
          });
          if (target) {
            navigation.navigate(target.screen, target.params);
          }
        }}
        onLongPress={() => {
          setSelectedNotification(item);
          setShowActionMenu(true);
        }}
      >
        {/* Left: Avatar with Badge */}
        <View style={styles.avatarWrapper}>
          {item.actor && !isSystemMessage && !isAnonymous ? (
            <AvatarFrameWrap
              theme={actorTheme}
              size={48}
              style={{ alignSelf: "center" }}
            >
              <FastImage
                source={{
                  uri: item.user?.avatar || `https://api.chuyenbienhoa.com/v1.0/users/${item.actor?.username}/avatar`,
                }}
                style={styles.avatarImg}
              />
            </AvatarFrameWrap>
          ) : isAnonymous ? (
            <View style={[styles.avatarImg, styles.anonymousAvatar, { backgroundColor: isDarkMode ? "#27272A" : "#E5E7EB" }]}>
              <Text style={{ color: theme.text, fontWeight: "bold", fontSize: 22 }}>?</Text>
            </View>
          ) : (
            <View style={[styles.avatarImg, styles.systemAvatarWrap, { borderColor: "#22C55E", backgroundColor: isDarkMode ? "#152E1B" : "#F0FAF2" }]}>
              <FastImage
                source={require("../../../assets/logo.png")}
                style={styles.systemAvatarImg}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Bottom-right notification kind badge */}
          <View
            style={[
              styles.avatarBadge,
              {
                backgroundColor: badge.bg,
                borderColor: isDarkMode ? "#18181B" : "#FFFFFF",
              },
            ]}
          >
            <Ionicons name={badge.icon} size={10} color={badge.color} />
          </View>
        </View>

        {/* Center: Content */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardMessage, { color: theme.text }]}>
            {isSystemMessage || !item.actor ? (
              <Text style={{ fontWeight: isModerationWarning ? "600" : "500" }}>
                {displayContent}
              </Text>
            ) : (
              <>
                <StyledName theme={actorTheme} variant="compact" style={[styles.actorName, { color: theme.text }]}>
                  {userName}
                </StyledName>
                {getNameIcon(actorTheme) ? " " : ""}
                <NameIcon theme={actorTheme} size={13} />
                {" "}{displayContent}
              </>
            )}
          </Text>

          {/* Moderator Note or Excerpt */}
          {moderationText ? (
            <Text style={[styles.moderatorNote, { color: isDarkMode ? "#9CA3AF" : "#6B7280" }]} numberOfLines={2}>
              {moderationText}
            </Text>
          ) : null}

          {/* Time row */}
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={isDarkMode ? "#71717A" : "#9CA3AF"} style={{ marginRight: 4 }} />
            <Text style={[styles.timeText, { color: isDarkMode ? "#71717A" : "#9CA3AF" }]}>
              {displayTime}
            </Text>
          </View>
        </View>

        {/* Right: Post thumbnail (if any) and Chevron */}
        {postThumbnail ? (
          <FastImage
            source={{ uri: postThumbnail }}
            style={styles.postThumbnail}
            resizeMode="cover"
          />
        ) : null}

        <Ionicons name="chevron-forward" size={17} color={isDarkMode ? "#52525B" : "#9CA3AF"} />
      </TouchableOpacity>
    );
  };

  const ActionMenu = () => (
    <Modal
      visible={showActionMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowActionMenu(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowActionMenu(false)}
      >
        <View style={[styles.actionMenu, { backgroundColor: theme.cardBackground }]}>
          <TouchableOpacity
            style={[
              styles.actionItem,
              { borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomColor: theme.border },
            ]}
            onPress={() => {
              if (selectedNotification && !selectedNotification.read) {
                handleMarkAsRead(selectedNotification.id);
              }
              setShowActionMenu(false);
            }}
          >
            <Ionicons name="checkmark-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.text }]}>
              {t('notifications.markAsRead', 'Đánh dấu đã đọc')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionItem,
              {
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
                borderBottomWidth: 0,
              },
            ]}
            onPress={() => {
              if (selectedNotification) {
                handleDeleteNotification(selectedNotification.id);
              }
              setShowActionMenu(false);
            }}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <Text style={[styles.actionText, { color: "#FF3B30" }]}>
              {t('notifications.delete', 'Xóa thông báo')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AndroidGlassBackdrop providerId="Notifications" style={{ flex: 1 }}>
        {/* Soft Ambient Light-Green Glow at Top */}
        <LinearGradient
          colors={
            isDarkMode
              ? ["rgba(20, 83, 45, 0.45)", "rgba(15, 23, 42, 0)"]
              : ["#E8F8EA", "rgba(240, 253, 244, 0.4)", "transparent"]
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[styles.ambientGlow, { height: insets.top + 140 }]}
          pointerEvents="none"
        />

        {/* Header matching the design mockup */}
        <View style={[styles.headerContainer, { paddingTop: insets.top + (Platform.OS === "ios" ? 6 : 10) }]}>
          {/* Left: Cute Frog Mascot + Doodles + Title */}
          <View style={styles.headerLeftRow}>
            {/* Mascot with action marks doodle */}
            <View style={styles.mascotWrapper}>
              <View style={styles.actionLinesWrapper}>
                <View style={[styles.actionLine, styles.actionLine1]} />
                <View style={[styles.actionLine, styles.actionLine2]} />
                <View style={[styles.actionLine, styles.actionLine3]} />
              </View>
              <FastImage
                source={require("../../../assets/logo.png")}
                style={styles.mascotLogo}
                resizeMode="contain"
              />
            </View>

            {/* Title & Subtitle */}
            <View style={styles.headerTitleColumn}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  {t('navigation.notifications', 'Thông báo')}
                </Text>
              </View>
              <Text style={[styles.headerSubtitle, { color: theme.subText }]}>
                {t('notifications.subtitle', 'Theo dõi các hoạt động mới nhất từ CYO')}
              </Text>
            </View>
          </View>

          {/* Decorative Sparkle ✦ */}
          <Text style={styles.sparkleStar}>✦</Text>

          {/* Top-Right: Settings / Filter Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate("NotificationSettingsScreen")}
            style={[
              styles.filterIconButton,
              {
                backgroundColor: isDarkMode
                  ? "rgba(34, 197, 94, 0.2)"
                  : "rgba(34, 197, 94, 0.14)",
              },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={21}
              color={isDarkMode ? "#4ADE80" : "#16A34A"}
            />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs Row */}
        <View style={styles.filterTabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsScroll}
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  activeOpacity={0.8}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.filterTabPill,
                    isActive
                      ? styles.filterTabPillActive
                      : [
                          styles.filterTabPillInactive,
                          {
                            backgroundColor: isDarkMode ? "#1F2937" : "#F3F4F6",
                            borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                          },
                        ],
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={15}
                    color={isActive ? "#FFFFFF" : isDarkMode ? "#9CA3AF" : "#6B7280"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.filterTabLabel,
                      isActive
                        ? styles.filterTabLabelActive
                        : { color: isDarkMode ? "#D1D5DB" : "#4B5563" },
                    ]}
                  >
                    {t(tab.labelKey, tab.defaultLabel)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Notifications List */}
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <CustomLoading />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={filteredNotifications}
            extraData={listExtraData}
            keyExtractor={(item) => item.id.toString()}
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingBottom: 110 + insets.bottom,
                flex: filteredNotifications.length === 0 ? 1 : undefined,
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : loadMoreError && hasMore ? (
                <TouchableOpacity
                  onPress={() => {
                    setLoadMoreError(false);
                    fetchNotifications(pageRef.current + 1, true);
                  }}
                  style={{ paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 14 }}>
                    {t("common.retry", "Chạm để thử lại")}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FastImage
                  source={require("../../../assets/logo.png")}
                  style={styles.emptyImage}
                  resizeMode="contain"
                />
                <Text style={[styles.emptyText, { color: theme.subText }]}>
                  {t('notifications.empty', 'Không có thông báo nào')}
                </Text>
              </View>
            }
          />
        )}
      </AndroidGlassBackdrop>

      {ActionMenu()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  mascotWrapper: {
    position: "relative",
    width: 48,
    height: 48,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  mascotLogo: {
    width: 44,
    height: 44,
  },
  actionLinesWrapper: {
    position: "absolute",
    top: -5,
    left: -4,
    width: 22,
    height: 14,
  },
  actionLine: {
    position: "absolute",
    width: 2.5,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: "#22C55E",
  },
  actionLine1: {
    top: 6,
    left: 1,
    transform: [{ rotate: "-40deg" }],
  },
  actionLine2: {
    top: 0,
    left: 8,
    transform: [{ rotate: "0deg" }],
  },
  actionLine3: {
    top: 5,
    left: 15,
    transform: [{ rotate: "35deg" }],
  },
  headerTitleColumn: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  sparkleStar: {
    position: "absolute",
    top: 36,
    right: 68,
    fontSize: 18,
    color: "#86EFAC",
  },
  filterIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  filterTabsContainer: {
    paddingBottom: 10,
  },
  filterTabsScroll: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  filterTabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabPillActive: {
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  filterTabPillInactive: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterTabLabel: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  filterTabLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    paddingTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  cardUnread: {
    borderLeftWidth: 3.5,
    borderLeftColor: "#22C55E",
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    position: "relative",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  anonymousAvatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  systemAvatarWrap: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  systemAvatarImg: {
    width: 36,
    height: 36,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 19,
    height: 19,
    borderRadius: 9.5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    marginRight: 8,
  },
  cardMessage: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  actorName: {
    fontWeight: "700",
  },
  moderatorNote: {
    fontSize: 12.5,
    fontStyle: "italic",
    marginTop: 3,
    lineHeight: 17,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  timeText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  postThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
  },
  emptyImage: {
    height: 70,
    width: 70,
    marginBottom: 12,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionMenu: {
    width: "75%",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "500",
  },
});
