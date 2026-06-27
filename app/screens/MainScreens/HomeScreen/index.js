import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Animated,
  TouchableOpacity,
  Pressable,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  Switch,
  TouchableHighlight,
  Platform,
  AppState,
  Dimensions,
  Alert,
  DeviceEventEmitter,
  StatusBar,
  PanResponder,
} from "react-native";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  getHomePosts,
  getStories,
  incrementPostView,
  resendVerificationEmail,
  reactToStory,
  removeStoryReaction,
  replyToStory,
  getStoryViewers,
  blockUser,
  reportUser,
  deleteStory,
  markStoryAsViewed,
  unfollowUser,
} from "../../../services/api/Api";
import ReportModal from "../../../components/ReportModal";
import formatTime from "../../../utils/formatTime";
import PostItem from "../../../components/PostItem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storage } from "../../../global/storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { FeedContext } from "../../../contexts/FeedContext";
import { useStatusBar } from "../../../contexts/StatusBarContext";
import { useTheme } from "../../../contexts/ThemeContext";
import LottieView from "lottie-react-native";
import Toast from "react-native-toast-message";
import FastImage from "../../../components/FastImage";
import InstagramStories from "@birdwingo/react-native-instagram-stories";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import ActionSheet from "react-native-actions-sheet";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

const emojis = ["👍", "❤️", "🔥", "😆", "😮", "😢", "😡"];

// Map emojis to reaction types
const emojiToReactionType = {
  "👍": "like",
  "❤️": "love",
  "🔥": "like", // Fire doesn't exist in API, use like
  "😆": "haha",
  "😮": "wow",
  "😢": "sad",
  "😡": "angry",
};

const FloatingEmoji = ({ emoji, onComplete }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 150; // Increased random range for wider spread

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -300, // Increased travel distance
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: randomX,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
  }, []);

  return (
    <Animated.Text
      style={{
        position: "absolute",
        fontSize: 80, // Increased font size
        left: "50%",
        bottom: 200,
        marginLeft: -40, // Half of the emoji's approximate width
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 4;

const ZoomableStoryImage = ({ uri, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Store raw values for calculations
  const scaleValue = useRef(1);
  const lastScale = useRef(1);
  const translateXValue = useRef(0);
  const translateYValue = useRef(0);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  // Track initial distance for pinch gesture
  const initialDistance = useRef(null);
  const initialMidpoint = useRef({ x: 0, y: 0 });

  const getDistance = (touches) => {
    const [t1, t2] = touches;
    return Math.sqrt(
      Math.pow(t2.pageX - t1.pageX, 2) + Math.pow(t2.pageY - t1.pageY, 2)
    );
  };

  const getMidpoint = (touches) => {
    const [t1, t2] = touches;
    return {
      x: (t1.pageX + t2.pageX) / 2,
      y: (t1.pageY + t2.pageY) / 2,
    };
  };

  const clampTranslate = (tx, ty, currentScale) => {
    const maxX = (SCREEN_WIDTH * (currentScale - 1)) / 2;
    const maxY = (SCREEN_HEIGHT * (currentScale - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    };
  };

  const resetTransform = () => {
    scaleValue.current = 1;
    lastScale.current = 1;
    translateXValue.current = 0;
    translateYValue.current = 0;
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length > 1 || scaleValue.current > 1,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Capture if zoomed in or if 2 fingers used
        return scaleValue.current > 1 || gestureState.numberActiveTouches > 1;
      },
      onPanResponderGrant: () => {
        lastTranslateX.current = translateXValue.current;
        lastTranslateY.current = translateYValue.current;
        lastScale.current = scaleValue.current;
        initialDistance.current = null;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // Pinch to zoom
          const dist = getDistance(touches);
          const mid = getMidpoint(touches);

          if (initialDistance.current === null) {
            initialDistance.current = dist;
            initialMidpoint.current = mid;
          }

          const newScale = Math.max(
            MIN_SCALE,
            Math.min(MAX_SCALE, lastScale.current * (dist / initialDistance.current))
          );

          scaleValue.current = newScale;
          scale.setValue(newScale);

          // Pan while pinching (follow midpoint)
          const dx = mid.x - initialMidpoint.current.x;
          const dy = mid.y - initialMidpoint.current.y;
          const clamped = clampTranslate(
            lastTranslateX.current + dx,
            lastTranslateY.current + dy,
            newScale
          );
          translateXValue.current = clamped.x;
          translateYValue.current = clamped.y;
          translateX.setValue(clamped.x);
          translateY.setValue(clamped.y);
        } else if (touches.length === 1 && scaleValue.current > 1) {
          // Pan when zoomed in
          const clamped = clampTranslate(
            lastTranslateX.current + gestureState.dx,
            lastTranslateY.current + gestureState.dy,
            scaleValue.current
          );
          translateXValue.current = clamped.x;
          translateYValue.current = clamped.y;
          translateX.setValue(clamped.x);
          translateY.setValue(clamped.y);
        }
      },
      onPanResponderRelease: () => {
        lastTranslateX.current = translateXValue.current;
        lastTranslateY.current = translateYValue.current;
        lastScale.current = scaleValue.current;
        initialDistance.current = null;

        // Snap back to MIN_SCALE if below threshold
        if (scaleValue.current < MIN_SCALE + 0.1) {
          resetTransform();
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <Animated.Image
      source={{ uri }}
      style={[
        style,
        {
          transform: [
            { scale },
            { translateX },
            { translateY },
          ],
        },
      ]}
      resizeMode="cover"
      {...panResponder.panHandlers}
    />
  );
};

const StoryOptionsModal = ({
  actionSheetRef,
  storyRef,
  setReportModalVisible,
  currentStoryUserRef,
  currentStory,
  currentStoryRef,
  userStories,
  dismissStoryModal,
  fetchStories,
}) => {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const { blockUser: blockUserInContext, userInfo } = useContext(AuthContext);
  const isOwnStory = String(currentStoryUserRef.current?.id) === String(userInfo?.id) || String(currentStoryUserRef.current?.uid) === String(userInfo?.id);
  const insets = useSafeAreaInsets();

  return (
    <ActionSheet
      ref={actionSheetRef}
      containerStyle={{
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        backgroundColor: theme.cardBackground,
      }}
      indicatorStyle={{
        width: 30,
        height: 4,
        backgroundColor: isDarkMode ? "#666" : "#404040",
        marginTop: 10,
      }}
      onClose={() => {
        storyRef.current?.resume?.(); // Resume story timer when sheet closes
      }}
      gestureEnabled={true}
    >
      <View style={{ paddingVertical: 8, paddingBottom: insets.bottom || 20, backgroundColor: theme.cardBackground }}>
        {!isOwnStory && (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          paddingVertical: 16,
          marginHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: theme.border
        }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.iconBackground,
              justifyContent: "center",
              alignItems: "center"
            }}>
              <Ionicons
                name="notifications-outline"
                size={23}
                color={theme.subText}
              />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 17, color: theme.text }}>{t('home.receiveStory')}</Text>
              <Text style={{ color: theme.subText, fontSize: 13 }}>
                {t('home.turnOnOffStory')}
              </Text>
            </View>
          </View>
          <Switch
            value={false}
            onValueChange={(value) => {
              actionSheetRef.current?.hide();
              Toast.show({
                type: "info",
                text1: value ? t('home.followNotificationsOn') : t('home.followNotificationsOff'),
                text2: value
                  ? t('home.receiveNotifications')
                  : t('home.stopNotifications'),
              });
            }}
            trackColor={{ false: "#767577", true: theme.primary }}
          />
        </View>
        )}

        <TouchableOpacity
          onPress={() => {
            actionSheetRef.current?.hide();
            Toast.show({
              type: "info",
              text1: t('home.share'),
              text2: t('home.linkCopied'),
            });
          }}
        >
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 16,
            marginHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border
          }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.iconBackground,
              justifyContent: "center",
              alignItems: "center"
            }}>
              <Ionicons name="link-outline" size={23} color={theme.subText} />
            </View>
            <Text style={{ marginLeft: 12, fontSize: 17, color: theme.text }}>
              {t('home.copyLinkShare')}
            </Text>
          </View>
        </TouchableOpacity>

        {isOwnStory ? (
          <TouchableOpacity
            onPress={() => {
              actionSheetRef.current?.hide();
              Alert.alert(t('home.deleteStoryTitle') || "Xóa story", t('home.deleteStoryDesc') || "Bạn có chắc muốn xóa story này?", [
                { text: t('settings.cancel') || "Hủy", style: "cancel" },
                {
                  text: t('home.deleteStory') || "Xóa", style: "destructive", onPress: async () => {
                    try {
                      const storyIdToDelete = currentStoryRef.current;
                      if (storyIdToDelete) {
                        await deleteStory(storyIdToDelete);
                        dismissStoryModal();
                        fetchStories();
                        Toast.show({
                          type: "success",
                          text1: t('home.deleteStorySuccess') || "Xóa thành công",
                        });
                      }
                    } catch (e) {
                      Toast.show({
                        type: "error",
                        text1: t('common.error'),
                        text2: e.message,
                      });
                    }
                  }
                }
              ]);
            }}
          >
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 16,
              marginHorizontal: 20
            }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.iconBackground,
                justifyContent: "center",
                alignItems: "center"
              }}>
                <Ionicons name="trash-outline" size={23} color="#ef4444" />
              </View>
              <Text style={{ marginLeft: 12, fontSize: 17, color: "#ef4444" }}>
                {t('home.deleteStory') || "Xóa story"}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => {
                actionSheetRef.current?.hide();
                setReportModalVisible(true);
              }}
            >
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                marginHorizontal: 20,
                borderBottomWidth: 1,
                borderBottomColor: theme.border
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.iconBackground,
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                  <Ionicons name="warning-outline" size={23} color={theme.subText} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontSize: 17, color: theme.text }}>{t('home.reportStory')}</Text>
                  <Text style={{ color: theme.subText, fontSize: 13 }}>
                    {t('home.reportStoryDesc')}
                  </Text>
                </View>
                <View style={{ marginLeft: "auto" }}>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={23}
                    color="#D1D1D1"
                  />
                </View>
              </View>
            </TouchableOpacity>

            {currentStoryUserRef.current?.isFollowed && (
              <TouchableOpacity
                onPress={async () => {
                  actionSheetRef.current?.hide();
                  try {
                    const userToUnfollow = currentStoryUserRef.current;
                    if (userToUnfollow && userToUnfollow.id) {
                      await unfollowUser(userToUnfollow.id);
                      fetchStories(); // Update the UI if needed
                      Toast.show({
                        type: "success",
                        text1: t('home.unfollowPerson'),
                        text2: t('home.unfollowed'),
                      });
                    }
                  } catch (error) {
                    console.error("Failed to unfollow user from stories:", error);
                    Toast.show({
                      type: "error",
                      text1: t('common.error'),
                      text2: error.message || "Failed to unfollow",
                    });
                  }
                }}
              >
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 16,
                  marginHorizontal: 20
                }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: theme.iconBackground,
                    justifyContent: "center",
                    alignItems: "center"
                  }}>
                    <Ionicons name="close-outline" size={23} color={theme.text} />
                  </View>
                  <Text style={{ marginLeft: 12, fontSize: 17, color: theme.text }}>
                    {t('home.unfollowPerson')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                actionSheetRef.current?.hide();
                Alert.alert(t('home.blockedTitle'), t('home.blockedBody'), [
                  { text: t('settings.cancel'), style: "cancel" },
                  {
                    text: t('home.blockPerson'), style: "destructive", onPress: async () => {
                      const userToBlockRef = currentStoryUserRef.current;
                      console.log("Blocking user (ref)...", userToBlockRef);

                      try {
                        let userToBlock = userToBlockRef;

                        if (!userToBlock && currentStoryRef.current) {
                          const foundUser = userStories.find(u => u.stories.some(s => s.id === currentStoryRef.current));
                          if (foundUser) {
                            userToBlock = { id: foundUser.uid, username: foundUser.id };
                          }
                        }

                        if (userToBlock) {
                          await blockUser(userToBlock.id || userToBlock.uid);

                          const usernameToBlock = userToBlock.username || userToBlock.id;
                          await blockUserInContext(usernameToBlock);

                          dismissStoryModal();
                          setTimeout(() => {
                            Alert.alert(t('home.blockedSuccessTitle'), t('home.blockedSuccessMessage'));
                          }, 500);

                          fetchStories();
                        } else {
                          console.error("No user found to block");
                          Alert.alert(t('home.blockedErrorTitle'), t('home.blockedErrorMessage'));
                        }
                      } catch (e) {
                        console.error("Block error:", e);
                        Alert.alert(t('common.error'), e.message || t('common.unknownError'));
                      }
                    }
                  }
                ]);
              }}
            >
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 16,
                marginHorizontal: 20
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: theme.iconBackground,
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                  <Ionicons name="ban-outline" size={23} color="#ef4444" />
                </View>
                <Text style={{ marginLeft: 12, fontSize: 17, color: "#ef4444" }}>
                  {t('home.blockPerson')}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ActionSheet>
  );
};

const ReplyBar = ({
  storyId,
  userId,
  username,
  navigation,
  viewersCount = 0,
  onDismissStory,
  storyRef,
}) => {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const { userInfo } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isOwnStory = String(userId) === String(userInfo?.id);

  const handleEmojiPress = async (emoji) => {
    if (emoji === "add" || !storyId) return;

    const id = Date.now();
    setFloatingEmojis((prev) => [...prev, { id, emoji }]);

    const reactionType = emojiToReactionType[emoji];
    if (reactionType) {
      try {
        await reactToStory(storyId, reactionType);
      } catch (error) {
        console.error("Error reacting to story:", error);
        Toast.show({
          type: "error",
          text1: t('common.error'),
          text2: t('home.reactionError'),
        });
      }
    }
  };

  const handleAnimationComplete = (id) => {
    setFloatingEmojis((prev) => prev.filter((emoji) => emoji.id !== id));
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !storyId || isSending) return;

    setIsSending(true);
    try {
      const response = await replyToStory(storyId, replyText.trim());
      setReplyText("");
      Toast.show({
        type: "success",
        text1: t('home.replySent'),
        text2: t('home.replySentBody'),
      });

      if (response?.data?.conversation_id && navigation) {
        navigation.navigate("ConversationScreen", {
          conversationId: response.data.conversation_id,
        });
      }
    } catch (error) {
      console.error("Error replying to story:", error);

      let errorMessage = t('home.replySendError');

      if (error.response?.data) {
        if (error.response.data.message) {
          if (typeof error.response.data.message === "string") {
            errorMessage = error.response.data.message;
          } else if (typeof error.response.data.message === "object") {
            const firstError = Object.values(error.response.data.message)[0];
            errorMessage = Array.isArray(firstError)
              ? firstError[0]
              : firstError;
          }
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: errorMessage,
        visibilityTime: 4000,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleViewCountPress = () => {
    if (navigation && storyId) {
      if (onDismissStory) {
        onDismissStory();
      }
      setTimeout(() => {
        navigation.navigate("StoryViewersScreen", {
          storyId: storyId,
        });
      }, 100);
    }
  };

  if (isOwnStory) {
    return (
      <View style={{ paddingBottom: insets.bottom }}>
        <View style={styles.viewCountBar}>
          <TouchableOpacity
            onPress={handleViewCountPress}
            style={styles.viewCountButton}
          >
            <Ionicons name="eye-outline" size={20} color="#fff" />
            <Text style={styles.viewCountText}>
              {t('home.views', { count: viewersCount === 0 ? 0 : viewersCount - 1 })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardStickyView style={{ flex: 1 }}>
      {floatingEmojis.map(({ id, emoji }) => (
        <FloatingEmoji
          key={id}
          emoji={emoji}
          onComplete={() => handleAnimationComplete(id)}
        />
      ))}
      <View style={{ paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6, paddingHorizontal: 8 }}>
          {emojis.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleEmojiPress(emoji)}
            >
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.replyBar}>
          <TextInput
            placeholder={t('chat.typeMessage')}
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            style={[
              styles.input,
              {
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.2)",
              },
            ]}
            value={replyText}
            onChangeText={setReplyText}
            onFocus={() => storyRef.current?.pause?.()}
            onBlur={() => storyRef.current?.resume?.()}
            onSubmitEditing={handleSendReply}
            editable={!isSending}
          />
          <TouchableOpacity
            style={{ position: "absolute", right: 20 }}
            onPress={handleSendReply}
            disabled={!replyText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardStickyView>
  );
};

const HomeScreen = ({ navigation, route, scrollTriggerRef }) => {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(2);
  const viewedPosts = useRef(new Set());
  const flatListRef = React.useRef(null);
  const { feed, setFeed } = useContext(FeedContext);
  const lottieRef = useRef(null);
  const storyRef = useRef(null);
  const actionSheetRef = useRef(null);
  const [userStories, setUserStories] = useState([]);
  const [currentStory, setCurrentStory] = useState(null);
  const currentStoryRef = useRef(null);
  useEffect(() => {
    currentStoryRef.current = currentStory;
  }, [currentStory]);
  const [currentStoryUser, setCurrentStoryUser] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isStoryVisible, setIsStoryVisible] = useState(false);
  const {
    username,
    isLoggedIn,
    emailVerifiedAt,
    userInfo,
    updateEmailVerificationStatus,
    refreshUserInfo,
    blockedUsers,
    blockUser: blockUserInContext,
  } = useContext(AuthContext);
  const { updateStatusBar, barStyle, backgroundColor } = useStatusBar();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const previousStatusBarStyle = useRef({
    barStyle: "dark-content",
    backgroundColor: "#ffffff",
  });
  const [verificationModalVisible, setVerificationModalVisible] =
    useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const scrollPositionRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const isScrollingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);

  React.useEffect(() => {
    if (!isLoggedIn) {
      // Reset feed state when the user signs out
      setFeed(null);
      setRefreshing(false);
      setHasMore(true);
      setCurrentPage(2);
      viewedPosts.current = new Set();
    }
  }, [isLoggedIn]);

  // Add effect to handle refresh trigger from story creation
  useEffect(() => {
    if (route.params?.refresh) {
      fetchStories();
    }
  }, [route.params?.refresh]);

  // Handle story highlighting from notifications
  useEffect(() => {
    if (route.params?.highlightStoryId && userStories.length > 0) {
      // Find the user and story to highlight
      const storyToHighlight = route.params.highlightStoryId;
      const userWithStory = userStories.find((user) =>
        user.stories.some((story) => story.storyId === storyToHighlight)
      );
      if (userWithStory) {
        // Open the story viewer for that user
        setTimeout(() => {
          storyRef.current?.show(userWithStory.id);
        }, 500);
      }
    }
  }, [route.params?.highlightStoryId, userStories]);

  const currentStoryUserRef = useRef(null); // Ref to hold fresh user object for callbacks

  const updateCurrentStoryUser = (user) => {
    setCurrentStoryUser(user);
    currentStoryUserRef.current = user;
  };

  const handleFetchFeed = async (page = 1) => {
    try {
      if (page === 1) {
        const cachedStr = storage.getString("cached_feed");
        if (cachedStr) {
          try {
            const parsed = JSON.parse(cachedStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setFeed((prev) => prev ? prev : parsed);
            }
          } catch(e) {}
        }
        setRefreshing(true);
      }

      const response = await getHomePosts(page);
      const posts = response?.data?.data;
      const validPosts = Array.isArray(posts) ? posts : [];
      setFeed(validPosts);

      if (page === 1 && validPosts.length > 0) {
        storage.set("cached_feed", JSON.stringify(validPosts));
      }
    } catch (error) {
      console.log("Error fetching newsfeed:", error);
      setFeed((prev) => prev ?? []);
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: t('home.loadingError'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      if (page === 1) {
        setTimeout(() => {
          setRefreshing(false);
        }, 1000);
      }
    }
  };

  React.useEffect(() => {
    handleFetchFeed();
  }, []);

  const onEndReached = () => {
    if (!hasMore) return;

    getHomePosts(currentPage)
      .then((response) => {
        const newPosts = response?.data?.data;
        if (!Array.isArray(newPosts) || newPosts.length === 0) {
          setHasMore(false);
          return;
        }
        setFeed((prevData) => {
          if (!Array.isArray(prevData)) return newPosts;
          return [...prevData, ...newPosts];
        });
        setCurrentPage((prevPage) => prevPage + 1);
      })
      .catch((error) => {
        console.error("Error loading more posts:", error);
      });
  };

  const ListEndLoader = () => {
    if (hasMore) {
      return (
        <View
          style={{
            marginTop: 20,
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LottieView
            source={require("../../../assets/refresh.json")}
            style={{
              width: 40,
              height: 40,
            }}
            loop
            autoPlay
          />
        </View>
      );
    }
  };

  const handleExpandPost = (index) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index,
        animated: false,
      });
    }
  };

  const handleVoteUpdate = (postId, newVotes) => {
    setFeed((prevFeed) =>
      prevFeed
        ? prevFeed.map((post) =>
            post.id === postId ? { ...post, votes: newVotes } : post
          )
        : prevFeed
    );
  };

  const handleSaveUpdate = (postId, savedStatus) => {
    setFeed((prevFeed) =>
      prevFeed
        ? prevFeed.map((post) =>
            post.id === postId ? { ...post, saved: savedStatus } : post
          )
        : prevFeed
    );
  };

  const handleViewableItemsChanged = ({ viewableItems }) => {
    if (!viewableItems) return;
    viewableItems.forEach((viewableItem) => {
      if (!viewableItem?.item) return;
      const postId = viewableItem.item.id;

      if (postId != null && !viewedPosts.current.has(postId)) {
        viewedPosts.current.add(postId); // Mark as viewed
        increasePostView(postId); // Call API
      }
    });
  };

  const increasePostView = async (postId) => {
    try {
      await incrementPostView(postId);
    } catch (error) {
      console.error("Failed to increase view:", error);
    }
  };

  const handleStoryOptions = (userId) => {
    // If the library passes the userId here, let's use it to ensure context is set!
    if (userId) {
      console.log("handleStoryOptions called with userId:", userId);
      const user = userStories.find((u) => u.id === userId || u.uid === userId);
      if (user) {
        updateCurrentStoryUser({ id: user.uid, username: user.id });
      }
    } else {
      console.log("handleStoryOptions called without userId, relying on currentStoryUser state");
    }

    storyRef.current?.pause?.(); // Pause the story timer
    actionSheetRef.current?.show();
  };

  const handleStoryShow = (userId) => {
    setIsStoryVisible(true);
    // Save current status bar style so we can restore it on hide
    previousStatusBarStyle.current = { barStyle, backgroundColor };
    if (Platform.OS === "android") {
      StatusBar.setHidden(false);
      updateStatusBar("light-content", "#000000");
    } else {
      updateStatusBar("light-content", "#000000");
    }
  };

  const handleStoryStart = async (userId, storyId) => {
    // userId here matches the 'id' field in transformed data (which is username based on my transform)
    // Actually, let's verify what userId is passed by the library. It passes the story's user id field.
    // In transform, I set uid: user.id, id: user.username.

    // Find the user and story to set current state
    const user = userStories.find((u) => u.id === userId || u.uid === userId);
    if (user) {
      const story = user.stories.find(s => s.id === storyId);
      if (story) {
        setCurrentStory(story.id); // or story.storyId
        updateCurrentStoryUser({ id: user.uid, username: user.id }); // user.id is username string
      }
    }

    // Mark story as viewed when story starts
    if (storyId) {
      try {
        await markStoryAsViewed(storyId);
      } catch (error) {
        // Silently fail - don't show error to user
        console.error("Failed to mark story as viewed:", error);
      }
    }
  };

  const handleStoryHide = () => {
    setIsStoryVisible(false);
    if (Platform.OS === "android") StatusBar.setHidden(false);
    // Restore previous status bar style
    updateStatusBar(
      previousStatusBarStyle.current.barStyle,
      previousStatusBarStyle.current.backgroundColor
    );
  };

  const dismissStoryModal = () => {
    // Method to dismiss story modal
    if (storyRef.current && typeof storyRef.current.hide === "function") {
      storyRef.current.hide();
    }
  };

  const handleReportSubmit = async (reason) => {
    try {
      if (!currentStoryUser) return;
      await reportUser({ story_id: currentStory, reported_user_id: currentStoryUser.uid || currentStoryUser.id, reason });
      Toast.show({
        type: "success",
        text1: t('home.reportSentTitle'),
        text2: t('home.reportSentBody'),
        topOffset: 60,
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2: e.message || t('post.reportError'),
        topOffset: 60,
      });
    }
  };

  const handleBlockUser = () => {
    // Use Alert from React Native (need import, but might rely on Toast or confirming)
    // Since we are in Modal context (ActionSheet), Alert works.
    // But verify Alert is imported? No, it's not imported in snippet.
    // Assuming I'll add Alert to imports if needed, or use a custom Confirmation.
    // For now I'll just use the blockUser API directly with a simple confirmation if possible?
    // Or just call it. But blocking is destructive.
  };

  const fetchStories = async () => {
    try {
      console.log("HomeScreen fetching stories. BlockedUsers:", blockedUsers);
      const response = await getStories();
      if (response?.data) {
        console.log("Stories fetched:", response.data.data?.length);
        const formattedStories = transformStoriesData(response);
        setUserStories(formattedStories);

        // Async prefetch story images to speed up story loading
        try {
          const prefetchUrls = [];
          formattedStories.forEach((user) => {
            user.stories?.forEach((story) => {
              if (story.source?.uri) {
                prefetchUrls.push(story.source.uri);
              }
            });
          });
          if (prefetchUrls.length > 0) {
            Promise.all(prefetchUrls.map((uri) => Image.prefetch(uri))).catch((err) =>
              console.log("Error prefetching story images:", err)
            );
          }
        } catch (prefetchErr) {
          console.log("Failed to prefetch stories:", prefetchErr);
        }
      }
    } catch (error) {
      console.error("Error fetching stories:", error);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [blockedUsers]);

  const transformStoriesData = (apiResponse) => {
    if (!apiResponse?.data) return [];

    let users = apiResponse.data.data;
    if (!Array.isArray(users)) return [];

    return users
      .filter((user) => user && Array.isArray(user.stories) && user.stories.length > 0)
      .map((user) => ({
        uid: user.id,
        id: user.username,
        name: user.name,
        isFollowed: user.is_following,
        avatarSource: {
          uri: `https://api.chuyenbienhoa.com/users/${user.username}/avatar`,
        },
        stories: user.stories.map((story) => ({
          id: story.id,
          storyId: story.id, // Store the actual story ID
          userId: user.id, // Store user ID
          username: user.username, // Store username
          source: {
            uri: `https://api.chuyenbienhoa.com${story.media_url}`,
          },
          duration: story.duration,
          viewers_count: story.viewers?.length || 0,
          renderContent: () => (
            <ZoomableStoryImage
              uri={`https://api.chuyenbienhoa.com${story.media_url}`}
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT,
              }}
            />
          ),
          renderFooter: () => (
            <ReplyBar
              storyId={story.id}
              userId={user.id}
              username={user.username}
              navigation={navigation}
              viewersCount={story.viewers?.length || 0}
              onDismissStory={dismissStoryModal}
              storyRef={storyRef}
            />
          ),
          date: formatTime(story.created_at || story.created_at_human),
          created_at: story.created_at,
          created_at_human: story.created_at_human,
          onStoryItemPress: () => {
            setCurrentStory(story.id);
            setCurrentStoryUser({ id: user.id, username: user.username });
          },
        })),
      }));
  };

  const EmailVerificationAlert = () => {
    if (!isLoggedIn || emailVerifiedAt) {
      return null;
    }

    return (
      <TouchableOpacity
        onPress={() => setVerificationModalVisible(true)}
        style={{
          backgroundColor: isDarkMode ? "#332b00" : "#FFF3CD",
          borderLeftWidth: 4,
          borderLeftColor: "#FFC107",
          padding: 12,
          marginHorizontal: 15,
          marginTop: 10,
          marginBottom: 5,
          borderRadius: 4,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
          <Ionicons name="alert-circle-outline" size={20} color={isDarkMode ? "#FFC107" : "#856404"} />
        <Text
          style={{
            marginLeft: 10,
            color: isDarkMode ? "#FFC107" : "#856404",
            fontSize: 14,
            flex: 1,
          }}
        >
          {t('home.verifyEmail')}
        </Text>
        <Ionicons name="chevron-forward-outline" size={18} color={isDarkMode ? "#FFC107" : "#856404"} />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => {
    return (
      <>
        <EmailVerificationAlert />
        <ScrollView
          style={{
            borderBottomWidth: 10,
            borderBottomColor: isDarkMode ? "#000" : "#E6E6E6",
            padding: 15,
            backgroundColor: theme.background,
          }}
          contentContainerStyle={{ gap: 10, paddingRight: 15 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {/* Story like Facebook component */}
          <TouchableHighlight
            onPress={() => navigation.navigate("CreateStory")}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 16,
              backgroundColor: theme.cardBackground,
              width: 100,
              height: 160,
              borderWidth: 1,
              borderColor: theme.border
            }}
          >
            <View style={{ flex: 1 }}>
              <FastImage
                source={{
                  uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
                }}
                style={{ width: 100, height: 115 }}
              />
              <View style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: theme.cardBackground,
                paddingTop: 24,
                paddingBottom: 8,
                alignItems: "center"
              }}>
                <Text style={{
                  fontSize: 13,
                  fontWeight: "500",
                  textAlign: "center",
                  color: theme.text
                }}>
                  {t('home.createStory')}
                </Text>
              </View>
              <View style={{
                position: "absolute",
                bottom: 28,
                left: 31,
                backgroundColor: theme.cardBackground,
                borderRadius: 20
              }}>
                <Ionicons name="add-circle" size={40} color={theme.primary} />
              </View>
            </View>
          </TouchableHighlight>
          {filteredStories.map((user) => (
            <TouchableHighlight
              key={user.id}
              onPress={() => storyRef.current?.show(user.id)}
              style={{
                position: "relative",
                width: 100,
                height: 160,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: theme.cardBackground,
                borderWidth: 1,
                borderColor: theme.border
              }}
            >
              <View>
                {/* Story Image */}
                <Image
                  source={{ uri: user.stories[0].source.uri }}
                  style={{ width: 100, height: 160 }}
                />

                {/* Avatar */}
                <View style={{ position: "absolute", top: 8, left: 8 }}>
                  <View style={{ borderRadius: 100, padding: 2, borderWidth: 2, borderColor: theme.primary }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, overflow: "hidden" }}>
                      <Image
                        source={{ uri: user.avatarSource.uri }}
                        style={{ width: 24, height: 24 }}
                      />
                    </View>
                  </View>
                </View>

                {/* Gradient + Title */}
                <View className="absolute bottom-0 left-0 right-0 h-14 justify-end">
                  <LinearGradient
                    colors={["black", "transparent"]}
                    start={{ x: 0.5, y: 1 }}
                    end={{ x: 0.5, y: 0 }}
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: 130,
                      bottom: -90,
                    }}
                  />
                  <Text
                    numberOfLines={2}
                    className="text-[13px] font-semibold text-white p-1.5"
                    style={{
                      textShadowColor: "rgba(0, 0, 0, 0.8)",
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 2,
                    }}
                  >
                    {user.name}
                  </Text>
                </View>
              </View>
            </TouchableHighlight>
          ))}
        </ScrollView>
      </>
    );
  };

  const handleScroll = (event) => {
    // Track scroll position
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollPositionRef.current = Math.max(0, offsetY); // Ensure non-negative
    isScrollingRef.current = false;

    // Auto hide bottom tab bar
    const diff = offsetY - lastScrollYRef.current;
    if (offsetY < 50) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
    } else if (diff > 15) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", false);
    } else if (diff < -10) {
      DeviceEventEmitter.emit("SET_TABBAR_VISIBLE", true);
    }
    lastScrollYRef.current = offsetY;

    // If scrolled to top during manual scroll, reset processing flag
    if (offsetY <= 10 && isProcessingRef.current && !refreshing) {
      isProcessingRef.current = false;
    }
  };

  const handleScrollBeginDrag = () => {
    isScrollingRef.current = true;
  };

  const handleRefresh = React.useCallback(() => {
    // Prevent multiple refresh calls - use ref for immediate check
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setRefreshing(true);
    setHasMore(true);
    setCurrentPage(2);
    viewedPosts.current = new Set(); // Reset viewed posts

    // Don't manually scroll - let RefreshControl handle it naturally
    // This prevents content from being pushed down

    fetchStories();

    // Refresh user info to update email verification status
    if (isLoggedIn && refreshUserInfo) {
      refreshUserInfo();
    }

    handleFetchFeed().finally(() => {
      setTimeout(() => {
        setRefreshing(false);
        isProcessingRef.current = false;
        // Reset scroll position after refresh completes
        scrollPositionRef.current = 0;
      }, 1000);
    });
  }, [isLoggedIn, refreshUserInfo]);

  // Function to scroll to top or reload
  const scrollToTopOrReload = React.useCallback(() => {
    // Debounce: prevent rapid clicks (minimum 300ms between triggers)
    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 300) {
      return;
    }
    lastTriggerTimeRef.current = now;

    // If already processing (refreshing or scrolling), ignore - use ref for immediate check
    if (isProcessingRef.current) {
      return;
    }

    const isAtTop = scrollPositionRef.current <= 10; // Consider 10px threshold for "at top"

    if (isAtTop) {
      // Already at top, trigger refresh (like pull-to-refresh)
      // This will set isProcessingRef to true, preventing multiple calls
      handleRefresh();
    } else {
      // Scroll to top first, then user can click again to refresh
      // Use a ref to track if we're scrolling to top
      const wasScrollingToTop = isProcessingRef.current;
      isProcessingRef.current = true;

      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: 0,
          animated: true,
        });
        // Reset processing flag after scroll animation completes
        // This allows the next click to trigger refresh
        setTimeout(() => {
          scrollPositionRef.current = 0;
          isProcessingRef.current = false;
        }, 600); // Slightly longer to ensure scroll completes
      } else {
        isProcessingRef.current = false;
      }
    }
  }, [handleRefresh]);

  // Expose scroll/reload function via ref callback
  React.useEffect(() => {
    if (scrollTriggerRef) {
      scrollTriggerRef(scrollToTopOrReload);
    }
  }, [scrollTriggerRef, scrollToTopOrReload]);

  // Refresh user info when app comes to foreground
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && isLoggedIn && refreshUserInfo) {
        // App has come to the foreground, refresh user info to update email verification status
        refreshUserInfo();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [isLoggedIn, refreshUserInfo]);

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      Toast.show({
        type: "success",
        text1: t('home.resendVerificationSuccess'),
        text2:
          t('home.resendVerificationSuccessBody'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      setVerificationModalVisible(false);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t('common.error'),
        text2:
          error.message ||
          t('home.resendVerificationError'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const ResendVerificationModal = () => {
    return (
      <Modal
        visible={verificationModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVerificationModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setVerificationModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: theme.cardBackground,
                  borderRadius: 12,
                  padding: 20,
                  width: "85%",
                  maxWidth: 400,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 15,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "#FFF3CD",
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="mail-outline" size={24} color="#FFC107" />
                  </View>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: theme.text,
                      flex: 1,
                    }}
                  >
                    {t('home.verifyEmail')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setVerificationModalVisible(false)}
                    style={{ padding: 5 }}
                  >
                    <Ionicons name="close" size={24} color={theme.subText} />
                  </TouchableOpacity>
                </View>

                <Text
                  style={{
                    fontSize: 15,
                    color: theme.subText,
                    marginBottom: 15,
                    lineHeight: 22,
                  }}
                >
                  {t('home.useFullFeatures')}
                </Text>

                {userInfo?.email && (
                  <View
                    style={{
                      backgroundColor: isDarkMode ? "#1f2937" : "#F5F5F5",
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 15,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.subText,
                        marginBottom: 4,
                      }}
                    >
                      {t('home.yourEmail')}:
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        color: theme.text,
                        fontWeight: "500",
                      }}
                    >
                      {userInfo.email}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleResendVerification}
                  disabled={resendingVerification}
                  style={{
                    backgroundColor: resendingVerification ? "#CCC" : theme.primary,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  {resendingVerification ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text
                      style={{
                        color: "white",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      {t('home.resendVerificationEmail')}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setVerificationModalVisible(false)}
                  disabled={resendingVerification}
                  style={{
                    paddingVertical: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: theme.subText,
                      fontSize: 15,
                    }}
                  >
                    {t('common.close')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };



  const filteredFeed = useMemo(() => {
    if (feed === null) return null;
    // Guard against non-array feed values from unexpected server responses
    const safeFeed = Array.isArray(feed) ? feed : [];
    if (blockedUsers && blockedUsers.length > 0) {
      return safeFeed.filter((post) => !blockedUsers.includes(post.user?.username));
    }
    return safeFeed;
  }, [feed, blockedUsers]);

  const filteredStories = useMemo(() => {
    if (!userStories) return [];
    const filtered = blockedUsers && blockedUsers.length > 0
      ? userStories.filter((user) => !blockedUsers.includes(user.id))
      : userStories;

    return filtered.map((user) => ({
      ...user,
      stories: user.stories.map((story) => ({
        ...story,
        date: formatTime(story.created_at || story.created_at_human || ""),
        renderFooter: () => (
          <ReplyBar
            storyId={story.storyId}
            userId={story.userId}
            username={story.username}
            navigation={navigation}
            viewersCount={story.viewers_count || 0}
            onDismissStory={dismissStoryModal}
            storyRef={storyRef}
          />
        ),
      })),
    }));
  }, [userStories, blockedUsers, t, navigation]);



  return filteredFeed == null ? (
    <ScrollView
      contentContainerStyle={{
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.background,
        flexGrow: 1,
      }}
      alwaysBounceVertical
      bounces
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          tintColor="transparent"
          colors={["transparent"]}
          progressBackgroundColor="transparent"
          style={{ backgroundColor: "transparent" }}
          progressViewOffset={-1000}
          refreshing={refreshing}
          onRefresh={() => {
            if (!isProcessingRef.current) {
              handleRefresh();
            }
          }}
        />
      }
    >
      <LottieView
        source={require("../../../assets/refresh.json")}
        style={{
          width: 70,
          height: 70,
        }}
        loop
        autoPlay
      />
      <Text style={{ marginTop: 15, color: theme.text }}>{t('home.loadingFeed')}</Text>
    </ScrollView>
  ) : (
    <>
      <View style={{ backgroundColor: theme.background, flex: 1 }}>
        {refreshing && (
          <View
            style={{
              position: "absolute",
              top: 5,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <LottieView
              source={require("../../../assets/refresh.json")}
              style={{
                width: 40,
                height: 40,
              }}
              ref={lottieRef}
              loop
              autoPlay
            />
          </View>
        )}
        <FlatList
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
          ref={flatListRef}
          showsVerticalScrollIndicator={false}
          data={filteredFeed}
          extraData={{ t, theme, isDarkMode }}
          keyExtractor={(item, index) => `key-${item.id + "-" + index}`}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{
            paddingBottom: 110 + insets.bottom,
            backgroundColor: theme.background,
          }}
          renderItem={({ item, index }) => (
            <PostItem
              item={item}
              onExpand={() => handleExpandPost(index)}
              onVoteUpdate={handleVoteUpdate}
              onSaveUpdate={handleSaveUpdate}
              navigation={navigation}
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          refreshControl={
            <RefreshControl
              tintColor="transparent"
              colors={["transparent"]}
              progressBackgroundColor="transparent"
              style={{ backgroundColor: "transparent" }}
              progressViewOffset={-1000}
              refreshing={refreshing}
              onRefresh={() => {
                // When user pulls to refresh, also prevent multiple calls
                if (!isProcessingRef.current) {
                  handleRefresh();
                }
              }}
            />
          }
          ListFooterComponent={ListEndLoader}
          ListHeaderComponent={ListHeader}
        />

        <InstagramStories
          key={filteredStories.map(u => u.stories.length).join('-')}
          ref={storyRef}
          stories={filteredStories}
          hideAvatarList={true}
          showName={true}
          statusBarTranslucent={false}
          backgroundColor="#000000"
          mediaContainerStyle={{ backgroundColor: "#000000" }}
          imageProps={{ resizeMode: "cover" }}
          imageStyles={StyleSheet.absoluteFillObject}
          textStyle={{
            color: "#fff",
            textShadowColor: "rgba(0, 0, 0, 0.8)",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 1.5,
            fontWeight: "600",
          }}
          progressColor="#a4a4a4"
          closeIconColor="#c4c4c4"
          modalAnimationDuration={300}
          storyAnimationDuration={300}
          storyAvatarSize={30}
          onStoryHeaderPress={(userId) => {
            console.log("Global Story Header Pressed for:", userId);
            if (userId) {
              const username = userId; // In my transform, id IS the username
              dismissStoryModal();
              setTimeout(() => {
                navigation.navigate("ProfileScreen", {
                  username: username,
                });
              }, 300);
            }
          }}
          onMore={handleStoryOptions}
          onShow={handleStoryShow}
          onHide={handleStoryHide}
          onStoryStart={handleStoryStart}
          onStoryItemPress={(item, index) => {
            // item is the story object, find the actual story ID
            const user = userStories.find((u) =>
              u.stories.some((s) => s.id === item.id)
            );
            if (user) {
              const story = user.stories.find((s) => s.id === item.id);
              if (story) {
                setCurrentStory(story.storyId);
                setCurrentStoryUser({ id: user.uid, username: user.id });
              }
            }
          }}
          toast={<Toast topOffset={60} />}
        />
        <ResendVerificationModal />
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmit={handleReportSubmit}
        />
        <StoryOptionsModal
          actionSheetRef={actionSheetRef}
          storyRef={storyRef}
          setReportModalVisible={setReportModalVisible}
          currentStoryUserRef={currentStoryUserRef}
          currentStory={currentStory}
          currentStoryRef={currentStoryRef}
          userStories={userStories}
          dismissStoryModal={dismissStoryModal}
          fetchStories={fetchStories}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    height: 45,
    borderRadius: 25,
    paddingHorizontal: 15,
  },
  viewCountBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  viewCountButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewCountText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    paddingVertical: 10,
  },
});

export default HomeScreen;