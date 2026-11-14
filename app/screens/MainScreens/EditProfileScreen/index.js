import React, { useState, useContext, useEffect } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import {
  getProfile,
  updateProfile,
  uploadFile,
  uploadCoverPhoto,
} from "../../../services/api/Api";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import CustomLoading from "../../../components/CustomLoading";
import DatePicker from "react-native-date-picker";
import RadioGroup from "react-native-radio-buttons-group";
import FastImage from "../../../components/FastImage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { SectionHeader, ACCENT, tint, useLook } from "../../../components/settings/SettingsUI";

// One labelled form row: round accent icon on the left, label + input stacked.
const Field = ({ icon, color, label, children, last, rowBorder, theme, isDarkMode }) => (
  <View style={[styles.fieldRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: rowBorder }]}>
    <View style={[styles.fieldIcon, { backgroundColor: tint(color, isDarkMode) }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={[styles.label, { color: theme.subText }]}>{label}</Text>
      {children}
    </View>
  </View>
);

const EditProfileScreen = ({ navigation }) => {
  const { username, userInfo, setUserInfo, bumpAvatarVersion, bumpCoverVersion, getCoverUrl, refreshUserInfo } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { cardBorder, rowBorder } = useLook();
  const { t, i18n } = useTranslation();

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 10, 60],
    outputRange: [0, 0, 0],
    extrapolate: "clamp",
  });
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const [loading, setLoading] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedCoverImage, setSelectedCoverImage] = useState(null);
  const [profileData, setProfileData] = useState({
    profile_name: "",
    bio: "",
    location: "",
    class_name: "",
    birthday: "",
    profile_picture: "",
  });

  // Emoji and decorative letters in the display name are a Pro perk
  // (`theme_editor.fancy_name` = { required_points, unlocked }; null when an
  // older API doesn't send it). `nameError` is set when the API refused the
  // name for that reason.
  const [fancyName, setFancyName] = useState(null);
  const [nameError, setNameError] = useState(false);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date());
  const [birthdayChanged, setBirthdayChanged] = useState(false);
  const [selectedId, setSelectedId] = useState();

  const radioButtons = [
    {
      id: "1",
      label: t('profile.male'),
      value: "male",
      borderColor: theme.primary,
      color: theme.primary,
      size: 22,
      labelStyle: { color: theme.text },
    },
    {
      id: "2",
      label: t('profile.female'),
      value: "female",
      borderColor: theme.primary,
      color: theme.primary,
      size: 22,
      labelStyle: { color: theme.text },
    },
  ];

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const response = await getProfile(username);
      const { profile } = response.data;
      console.log(profile);
      setProfileData({
        profile_name: profile.profile_name || "",
        bio: profile.bio || "",
        location: profile.location || "",
        class_name: profile.class_name || "",
        birthday: profile.birthday_raw || "",
        gender: profile.gender || "",
      });
      setFancyName(profile.theme_editor?.fancy_name || null);
      // profile.birthday_raw is null when the user never set a birthday -
      // new Date(null) coerces to new Date(0) (1970-01-01) instead of an
      // "unset" state, which then got silently resubmitted on every save.
      if (profile.birthday_raw) {
        setDate(new Date(profile.birthday_raw));
      }
      setSelectedId(profile.gender == "Male" ? "1" : "2");
    } catch (error) {
      console.error("Error fetching profile:", error);
      Toast.show({
        type: "error",
        text1: t('profile.errorTitle'),
        text2: t('profile.errorLoading'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setLoadingFirst(false);
    }
  };

  useEffect(() => {
    console.log(profileData);
    console.log(JSON.stringify(userInfo, null, 2));
  }, [profileData, userInfo]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    let cdnId = null;
    try {
      // First handle avatar upload if there's a selected image
      if (selectedImage) {
        const imageFormData = new FormData();
        imageFormData.append("file", {
          uri: selectedImage,
          type: selectedImage.endsWith(".png") ? "image/png" : "image/jpeg",
          name: selectedImage.endsWith(".png") ? "avatar.png" : "avatar.jpg",
        });
        imageFormData.append("uid", userInfo.id);

        // Call the avatar upload API
        const response = await uploadFile(imageFormData);
        cdnId = response.data.id;
      }

      // Handle cover image upload if selected (dedicated cover endpoint)
      if (selectedCoverImage) {
        const coverFormData = new FormData();
        coverFormData.append("cover_photo", {
          uri: selectedCoverImage,
          type: selectedCoverImage.endsWith(".png")
            ? "image/png"
            : "image/jpeg",
          name: selectedCoverImage.endsWith(".png") ? "cover.png" : "cover.jpg",
        });

        await uploadCoverPhoto(username, coverFormData);
        bumpCoverVersion();
      }

      // then update the profileData with gender and birthday
      const updatedProfileData = {
        ...profileData,
        gender: selectedId === "1" ? "Male" : "Female",
        profile_picture: cdnId,
      };
      // Only send a birthday if the user actually has one set or just picked
      // one - otherwise this always resubmitted `date`'s default (1970-01-01
      // when no birthday existed) on every profile save, including plain
      // avatar-only updates.
      if (birthdayChanged || profileData.birthday) {
        updatedProfileData.birthday = date.toISOString().split("T")[0];
      }

      // Then create formData with the updated data
      const formData = new FormData();

      Object.keys(updatedProfileData).forEach((key) => {
        if (updatedProfileData[key]) {
          formData.append(key, updatedProfileData[key]);
        }
      });

      await updateProfile(username, formData);

      // Bust the avatar cache so all screens immediately show the new photo
      bumpAvatarVersion();

      // Refresh the cached user_info (profile_name, bio, etc.) so screens
      // reading it from AuthContext/AsyncStorage (e.g. Sidebar) show the
      // change immediately instead of only after the next login/app restart.
      await refreshUserInfo();

      Toast.show({
        type: "success",
        text1: t('editProfile.successTitle'),
        text2: t('editProfile.successMessage'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      navigation.goBack();
    } catch (error) {
      console.error("Error updating profile:", error?.response?.data || error?.message);
      // The name was refused (emoji / special characters below the tier):
      // say so in the app's language, under the field and in the toast.
      const nameRefused =
        error?.response?.status === 422 && !!error.response.data?.errors?.profile_name;
      setNameError(nameRefused);
      Toast.show({
        type: "error",
        text1: t('profile.errorTitle'),
        text2: nameRefused
          ? t('editProfile.nameFancyLocked', { points: fancyName?.required_points ?? 2000 })
          : t('editProfile.errorUpdate'),
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedCoverImage(result.assets[0].uri);
    }
  };

  const formatDateToLocale = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return t('editProfile.birthdayFormat', { day, month, year });
  };

  if (loadingFirst) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <CustomLoading />
        <Text style={[styles.loadingText, { color: theme.subText }]}>
          {t("home.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top ambient green glow */}
      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 140,
          zIndex: 0,
        }}
        pointerEvents="none"
      />
      <KeyboardAvoidingView behavior={"padding"} style={{ flex: 1 }}>
        <FloatingScreenHeader
          icon="close"
          title={t('settings.editProfile')}
          onBack={() => navigation.goBack()}
          scrollY={scrollY}
          right={
            <LiquidButton providerId="EditProfileScreen" size={44} scrollY={scrollY} onPress={handleUpdateProfile} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="checkmark" size={24} color={theme.primary} />
              )}
            </LiquidButton>
          }
        />

        <AndroidGlassBackdrop providerId="EditProfileScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: insets.bottom + 16 }}
        >
          {/* Photos card: cover banner with the avatar overlapping it */}
          <SectionHeader icon="image-outline" color={ACCENT.profileTheme} title={t('editProfile.updateAvatar')} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: cardBorder, marginBottom: 24 }]}>
            <TouchableOpacity activeOpacity={0.85} onPress={pickCoverImage}>
              <FastImage
                source={{ uri: selectedCoverImage ? selectedCoverImage : getCoverUrl(username) }}
                style={styles.coverImage}
              />
              <View style={styles.coverBadge}>
                <Ionicons name="pencil" size={13} color="#fff" />
                <Text style={styles.coverBadgeText}>{t('editProfile.changeCover')}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.avatarRow}>
              <TouchableOpacity activeOpacity={0.85} onPress={pickImage}>
                <FastImage
                  source={{ uri: selectedImage ? selectedImage : `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar` }}
                  style={[styles.avatar, { borderColor: theme.surface }]}
                />
                <View style={[styles.avatarCamera, { backgroundColor: ACCENT.profile, borderColor: theme.surface }]}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickImage}
                activeOpacity={0.7}
                style={[styles.pill, { backgroundColor: tint(ACCENT.profile, isDarkMode) }]}
              >
                <Ionicons name="camera-outline" size={16} color={ACCENT.profile} />
                <Text style={[styles.pillText, { color: ACCENT.profile }]}>{t('editProfile.changeAvatar')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <SectionHeader icon="person-circle-outline" color={ACCENT.profile} title={t('editProfile.updateInfo')} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: cardBorder, marginBottom: 24 }]}>
            <Field icon="person-outline" color={ACCENT.profile} label={t('editProfile.displayName')} rowBorder={rowBorder} theme={theme} isDarkMode={isDarkMode}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={profileData.profile_name}
                onChangeText={(text) => {
                  setNameError(false);
                  setProfileData((prev) => ({ ...prev, profile_name: text }));
                }}
                placeholder={t('editProfile.displayNamePlaceholder')}
                placeholderTextColor={theme.subText}
              />
              {nameError ? (
                <Text style={styles.fieldError}>
                  {t('editProfile.nameFancyLocked', { points: fancyName?.required_points ?? 2000 })}
                </Text>
              ) : fancyName && !fancyName.unlocked ? (
                <View style={styles.fieldHintRow}>
                  <Ionicons name="lock-closed" size={12} color={theme.subText} />
                  <Text style={[styles.fieldHint, { color: theme.subText }]}>
                    {t('editProfile.nameFancyHint', { points: fancyName.required_points ?? 2000 })}
                  </Text>
                </View>
              ) : null}
            </Field>
            <Field icon="document-text-outline" color={ACCENT.aiTranslate} label={t('editProfile.bio')} rowBorder={rowBorder} theme={theme} isDarkMode={isDarkMode}>
              <TextInput
                style={[styles.input, styles.bioInput, { color: theme.text }]}
                value={profileData.bio}
                onChangeText={(text) => setProfileData((prev) => ({ ...prev, bio: text }))}
                placeholder={t('editProfile.bioPlaceholder')}
                placeholderTextColor={theme.subText}
                multiline
                numberOfLines={3}
              />
            </Field>
            <Field icon="school-outline" color={ACCENT.verification} label={t('profile.class')} rowBorder={rowBorder} theme={theme} isDarkMode={isDarkMode}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={profileData.class_name}
                onChangeText={(text) => setProfileData((prev) => ({ ...prev, class_name: text }))}
                placeholder={t('editProfile.classPlaceholder')}
                placeholderTextColor={theme.subText}
              />
            </Field>
            <Field icon="location-outline" color={ACCENT.notifications} label={t('profile.address')} rowBorder={rowBorder} theme={theme} isDarkMode={isDarkMode}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={profileData.location}
                onChangeText={(text) => setProfileData((prev) => ({ ...prev, location: text }))}
                placeholder={t('editProfile.addressPlaceholder')}
                placeholderTextColor={theme.subText}
              />
            </Field>
            <Field icon="calendar-outline" color={ACCENT.theme} label={t('profile.birthday')} rowBorder={rowBorder} theme={theme} isDarkMode={isDarkMode}>
              <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7} style={styles.input}>
                <Text style={{ fontSize: 16, color: profileData.birthday ? theme.text : theme.subText }}>
                  {profileData.birthday ? formatDateToLocale(date) : t('editProfile.selectBirthday')}
                </Text>
              </TouchableOpacity>
              <DatePicker
                modal
                open={open}
                date={date}
                mode="date"
                locale={i18n.language}
                title={t('editProfile.selectBirthday')}
                confirmText={t('editProfile.confirm')}
                cancelText={t('profile.cancel')}
                maximumDate={new Date(Date.now() - 24 * 60 * 60 * 1000)}
                minimumDate={new Date(1900, 0, 1)}
                onConfirm={(selectedDate) => {
                  setOpen(false);
                  setDate(selectedDate);
                  setBirthdayChanged(true);
                  setProfileData((prev) => ({
                    ...prev,
                    birthday: formatDateToLocale(selectedDate),
                  }));
                }}
                onCancel={() => {
                  setOpen(false);
                }}
              />
            </Field>
            <Field icon="male-female-outline" color={ACCENT.glass} label={t('profile.gender')} last rowBorder={rowBorder} theme={theme} isDarkMode={isDarkMode}>
              <RadioGroup
                radioButtons={radioButtons}
                onPress={setSelectedId}
                selectedId={selectedId}
                layout="row"
                containerStyle={{ marginLeft: -10, alignSelf: "flex-start" }}
              />
            </Field>
          </View>
        </Animated.ScrollView>
        </AndroidGlassBackdrop>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    height: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#319527",
  },
  saveButton: {
    color: "#319527",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  card: { marginHorizontal: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  coverImage: { width: "100%", height: 130, backgroundColor: "#c4c4c4" },
  coverBadge: {
    position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  coverBadgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  avatarRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingBottom: 14, marginTop: -34 },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 4 },
  avatarCamera: {
    position: "absolute", right: 0, bottom: 2, width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginLeft: 14, marginBottom: 6 },
  pillText: { fontSize: 14, fontWeight: "600" },
  fieldRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 16 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 2 },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 2 },
  fieldHintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  fieldHint: { flex: 1, fontSize: 13 },
  fieldError: { fontSize: 14, color: "#FF3B30", marginTop: 4 },
  input: { fontSize: 16, minHeight: 28, paddingVertical: 4, paddingHorizontal: 0 },
  bioInput: { minHeight: 72, textAlignVertical: "top" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "500",
  },
});

export default EditProfileScreen;
