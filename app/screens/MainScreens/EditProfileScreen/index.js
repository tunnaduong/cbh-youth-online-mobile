import React, { useState, useContext, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import {
  getProfile,
  updateProfile,
  uploadFile,
} from "../../../services/api/Api";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import CustomLoading from "../../../components/CustomLoading";
import DatePicker from "react-native-date-picker";
import RadioGroup from "react-native-radio-buttons-group";
import FastImage from "../../../components/FastImage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";

const EditProfileScreen = ({ navigation }) => {
  const { username, userInfo, setUserInfo, bumpAvatarVersion } = useContext(AuthContext);
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
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

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date());
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
      setDate(new Date(profile.birthday_raw));
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
    let cdnCoverId = null;
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

      // Handle cover image upload if selected
      if (selectedCoverImage) {
        const coverFormData = new FormData();
        coverFormData.append("file", {
          uri: selectedCoverImage,
          type: selectedCoverImage.endsWith(".png")
            ? "image/png"
            : "image/jpeg",
          name: selectedCoverImage.endsWith(".png") ? "cover.png" : "cover.jpg",
        });
        coverFormData.append("uid", userInfo.id);

        // Call the cover upload API
        const response = await uploadFile(coverFormData);
        cdnCoverId = response.data.id;
      }

      // then update the profileData with gender and birthday
      const updatedProfileData = {
        ...profileData,
        gender: selectedId === "1" ? "Male" : "Female",
        birthday: date.toISOString().split("T")[0],
        profile_picture: cdnId,
      };

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
      console.error("Error updating profile:", error.response.data);
      Toast.show({
        type: "error",
        text1: t('profile.errorTitle'),
        text2: t('editProfile.errorUpdate'),
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
    });

    if (!result.canceled) {
      setSelectedCoverImage(result.assets[0].uri);
      setTimeout(() => {
        Toast.show({
          type: "info",
          text1: t('editProfile.coverDev'),
        });
      }, 1000);
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={"padding"} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>{t('settings.editProfile')}</Text>
          <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
            <Text
              style={[styles.saveButton, { color: theme.primary }, loading && styles.saveButtonDisabled]}
            >
              {loading ? t('editProfile.saving') : t('settings.save')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ backgroundColor: theme.background, paddingBottom: insets.bottom + 16 }}
        >
          <Text style={[styles.updateAvatarText, { color: theme.text }]}>{t('editProfile.updateAvatar')}</Text>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <FastImage
              source={{
                uri: selectedImage
                  ? selectedImage
                  : `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
              }}
              style={styles.avatar}
            />
            <TouchableOpacity
              onPress={pickImage}
              style={[styles.changeAvatarButton, { borderColor: theme.primary }]}
            >
              <Ionicons name="camera-outline" size={20} color={theme.text} />
              <Text style={[styles.changeAvatarText, { color: theme.text }]}>{t('editProfile.changeAvatar')}</Text>
            </TouchableOpacity>
            <FastImage
              source={{
                uri: selectedCoverImage
                  ? selectedCoverImage
                  : `https://api.chuyenbienhoa.com/v1.0/users/${username}/cover`,
              }}
              style={styles.coverImage}
            />
            <TouchableOpacity
              onPress={pickCoverImage}
              style={[styles.changeAvatarButton, { borderColor: theme.primary }]}
            >
              <Ionicons name="pencil-outline" size={20} color={theme.text} />
              <Text style={[styles.changeAvatarText, { color: theme.text }]}>{t('editProfile.changeCover')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.updateAvatarText, { color: theme.text }]}>{t('editProfile.updateInfo')}</Text>
          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>{t('editProfile.displayName')}</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardBackground }]}
                value={profileData.profile_name}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, profile_name: text }))
                }
                placeholder={t('editProfile.displayNamePlaceholder')}
                placeholderTextColor={theme.subText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>{t('editProfile.bio')}</Text>
              <TextInput
                style={[styles.input, styles.bioInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardBackground }]}
                value={profileData.bio}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, bio: text }))
                }
                placeholder={t('editProfile.bioPlaceholder')}
                placeholderTextColor={theme.subText}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>{t('profile.class')}</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardBackground }]}
                value={profileData.class_name}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, class_name: text }))
                }
                placeholder={t('editProfile.classPlaceholder')}
                placeholderTextColor={theme.subText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>{t('profile.address')}</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.cardBackground }]}
                value={profileData.location}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, location: text }))
                }
                placeholder={t('editProfile.addressPlaceholder')}
                placeholderTextColor={theme.subText}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>{t('profile.birthday')}</Text>
              <TouchableOpacity
                onPress={() => setOpen(true)}
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBackground, justifyContent: "center" }]}
              >
                <Text style={{ color: profileData.birthday ? theme.text : theme.subText }}>
                  {profileData.birthday
                    ? formatDateToLocale(date)
                    : t('editProfile.selectBirthday')}
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
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                onConfirm={(selectedDate) => {
                  setOpen(false);
                  setDate(selectedDate);
                  setProfileData((prev) => ({
                    ...prev,
                    birthday: formatDateToLocale(selectedDate),
                  }));
                }}
                onCancel={() => {
                  setOpen(false);
                }}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.primary }]}>{t('profile.gender')}</Text>
              <RadioGroup
                radioButtons={radioButtons}
                onPress={setSelectedId}
                selectedId={selectedId}
                layout="row"
                containerStyle={{
                  marginLeft: -10,
                }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  updateAvatarText: {
    fontSize: 22,
    fontWeight: "600",
    marginHorizontal: 16,
    marginTop: 20,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  changeAvatarButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#319527",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  changeAvatarText: {
    color: "#404040",
    fontSize: 15,
    fontWeight: "600",
  },
  coverImage: {
    width: "70%",
    height: 130,
    borderRadius: 13,
    backgroundColor: "#c4c4c4",
    marginTop: 20,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#319527",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    height: 44,
    color: "#000",
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
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
