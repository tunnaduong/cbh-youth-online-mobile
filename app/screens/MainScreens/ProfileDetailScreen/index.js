import React, { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "../../../components/FastImage";
import { AuthContext } from "../../../contexts/AuthContext";
import {
  getProfile,
  blockUser as blockUserApi,
  unblockUser as unblockUserApi,
  reportUser,
} from "../../../services/api/Api";
import ReportModal from "../../../components/ReportModal";
import { apiErrorMessage } from "../../../utils/apiMessage";
import CustomLoading from "../../../components/CustomLoading";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import UserNameRow from "../../../components/profile/UserNameRow";
import StyledUsername from "../../../components/profile/StyledUsername";
import { AvatarFrameWrap } from "../../../components/profile/AvatarFrame";

const ProfileDetailScreen = ({ navigation, route }) => {
  const {
    username: currentUsername,
    blockUser,
    unblockUser,
    blockedUsers,
  } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [profileUserId, setProfileUserId] = useState(route.params?.userId ?? null);
  const username = route.params?.username || currentUsername;
  const isCurrentUser = username === currentUsername;
  const insets = useSafeAreaInsets();
  const isBlocked = blockedUsers?.includes(username);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const { t, i18n } = useTranslation();

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 10, 60],
    outputRange: [0, 0, 0],
    extrapolate: "clamp",
  });
  // The header stays see-through for the glass buttons, but the strip behind
  // the status bar fills in once content scrolls under it - otherwise the
  // profile's text runs into the clock and battery icons (iOS).
  const statusBarBgOpacity = scrollY.interpolate({
    inputRange: [0, 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  useFocusEffect(
    React.useCallback(() => {
      // Fetch updated data for the profile when the screen comes into focus
      fetchProfileData();
    }, [username])
  );

  useEffect(() => {
    fetchProfileData();
  }, [username]);

  const fetchProfileData = async () => {
    try {
      const response = await getProfile(username);
      setProfileData(response.data.profile);
      if (response.data?.id) setProfileUserId(response.data.id);
    } catch (error) {
      console.error("Error fetching profile:", error);
      Toast.show({
        type: "error",
        text1: t('profile.errorTitle'),
        text2: t('profile.errorLoading'),
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, { paddingTop: insets.top, backgroundColor: theme.background }]}
      >
        
        <CustomLoading />
      </View>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return t('profile.notUpdated');
    const date = new Date(dateString);
    const locale = { vi: "vi-VN", en: "en-US", ru: "ru-RU" }[i18n.language?.split("-")[0]] || "vi-VN";
    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const renderInfoItem = (icon, label, value) => (
    <View style={styles.infoItem}>
      <View style={[styles.infoIconContainer, { backgroundColor: isDarkMode ? "#374151" : "#f0f0f0" }]}>
        <Ionicons name={icon} size={24} color={theme.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{value || t('profile.notUpdated')}</Text>
      </View>
    </View>
  );

  const handleBlockUser = () => {
    Alert.alert(
      t('profile.blockTitle'),
      t('profile.blockConfirm', { username }),
      [
        {
          text: t('profile.cancel'),
          style: "cancel",
        },
        {
          text: t('profile.blockAction'),
          style: "destructive",
          onPress: async () => {
            try {
              // The server is the source of truth for blocks - the local
              // context list only mirrors it for client-side filtering.
              if (profileUserId) await blockUserApi(profileUserId);
              await blockUser(username);
              Toast.show({
                type: "success",
                text1: t('profile.blockSuccessTitle'),
                text2: t('profile.blockSuccessMessage'),
              });
              navigation.goBack();
            } catch (e) {
              Toast.show({
                type: "error",
                text1: t('profile.errorTitle'),
                text2: e.response?.data?.message || e.message,
              });
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = () => {
    Alert.alert(
      t('profile.unblockTitle'),
      t('profile.unblockConfirm', { username }),
      [
        {
          text: t('profile.cancel'),
          style: "cancel",
        },
        {
          text: t('profile.unblockAction'),
          onPress: async () => {
            try {
              if (profileUserId) await unblockUserApi(profileUserId);
              await unblockUser(username);
              Toast.show({
                type: "success",
                text1: t('profile.unblockSuccessTitle'),
                text2: t('profile.unblockSuccessMessage'),
              });
            } catch (e) {
              Toast.show({
                type: "error",
                text1: t('profile.errorTitle'),
                text2: e.response?.data?.message || e.message,
              });
            }
          },
        },
      ]
    );
  };

  // Same flow as ProfileScreen: the reason is written in ReportModal and sent
  // to the API, so the report reaches the moderators.
  const handleReportUser = () => setReportModalVisible(true);

  const handleReportSubmit = async (reason) => {
    try {
      await reportUser({ reported_user_id: profileUserId, reason });
      Toast.show({
        type: "success",
        text1: t('profile.reportSuccessTitle'),
        text2: t('profile.reportSuccessMessage'),
      });
    } catch (e) {
      // An Alert, not a toast: ReportModal stays open on failure and a
      // toast would be drawn behind it.
      Alert.alert(t('common.error'), apiErrorMessage(e, t('post.reportError')));
      // Keeps ReportModal open so the reason can be sent again.
      throw e;
    }
  };

  const showOptions = () => {
    Alert.alert(
      t('profile.optionsTitle'),
      t('profile.optionsMessage', { username }),
      [
        {
          text: t('profile.reportTitle'),
          onPress: handleReportUser,
        },
        !isBlocked
          ? {
            text: t('profile.blockTitle'),
            onPress: handleBlockUser,
            style: "destructive",
          }
          : {
            text: t('profile.unblockTitle'),
            onPress: handleUnblockUser,
          },
        {
          text: t('profile.cancel'),
          style: "cancel",
        },
      ].filter(Boolean)
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Floating Header */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: theme.background,
            opacity: headerBgOpacity,
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: insets.top,
            backgroundColor: theme.background,
            opacity: statusBarBgOpacity,
          }}
        />
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 64 + insets.top, justifyContent: 'space-between' }}>
          <LiquidButton providerId="ProfileDetailScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text
            style={[styles.headerTitle, {
              color: theme.primary,
              flex: 1,
              textAlign: 'center',
              opacity: headerTitleOpacity,
            }]}
            numberOfLines={1}
          >
            {t('profile.title')}
          </Animated.Text>
          {isCurrentUser ? (
            <LiquidButton providerId="ProfileDetailScreen" size={44} scrollY={scrollY} onPress={() => navigation.navigate("EditProfileScreen")}>
              <Ionicons name="create-outline" size={24} color={theme.primary} />
            </LiquidButton>
          ) : (
            <LiquidButton providerId="ProfileDetailScreen" size={44} scrollY={scrollY} onPress={showOptions}>
              <Ionicons name="ellipsis-vertical" size={24} color={theme.primary} />
            </LiquidButton>
          )}
        </View>
      </View>

      <AndroidGlassBackdrop providerId="ProfileDetailScreen" style={{ flex: 1 }}>
      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 16 }}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <AvatarFrameWrap theme={profileData?.theme} size={100} style={{ marginBottom: 8 }}>
            <FastImage
              source={{
                uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={[styles.avatar, { marginBottom: 0 }]}
            />
          </AvatarFrameWrap>
          <UserNameRow
            name={profileData?.profile_name}
            theme={profileData?.theme}
            variant="full"
            verified={!!profileData?.verified}
            verifiedSize={22}
            verifiedColor={theme.primary}
            style={[styles.profileName, { color: theme.text, marginBottom: 0 }]}
            containerStyle={{ maxWidth: "100%", paddingHorizontal: 16, marginBottom: 4 }}
          />
          <StyledUsername
            theme={profileData?.theme}
            username={username}
            variant="full"
            style={[styles.username, { color: theme.subText }]}
            numberOfLines={1}
          />
        </View>

        {/* Bio Section */}
        {profileData?.bio && (
          <View style={[styles.bioSection, { borderColor: theme.border }]}>
            <Text style={[styles.bioText, { color: theme.text }]}>{profileData.bio}</Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          {renderInfoItem(
            "calendar-outline",
            t('profile.birthday'),
            formatDate(profileData?.birthday_raw)
          )}
          {renderInfoItem("location-outline", t('profile.address'), profileData?.location)}
          {renderInfoItem("school-outline", t('profile.class'), profileData?.class_name)}
          {renderInfoItem(
            "person-outline",
            t('profile.gender'),
            profileData?.gender
              ? profileData.gender === "Male"
                ? t('profile.male')
                : t('profile.female')
              : t('profile.notUpdated')
          )}
          {renderInfoItem("mail-outline", t('profile.email'), profileData?.email)}
          {renderInfoItem("time-outline", t('profile.joined'), profileData?.joined_at)}
        </View>
      </Animated.ScrollView>
      </AndroidGlassBackdrop>
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReportSubmit}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  username: {
    fontSize: 16,
    textAlign: "center",
  },
  bioSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoSection: {
    padding: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
  },
});

export default ProfileDetailScreen;
