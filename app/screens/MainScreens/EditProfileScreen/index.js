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
import { SafeAreaView } from "react-native-safe-area-context";
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
import FastImage from "react-native-fast-image";

const EditProfileScreen = ({ navigation }) => {
  const { username, userInfo, setUserInfo } = useContext(AuthContext);
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
      id: "1", // acts as primary key, should be unique and non-empty string
      label: "Nam",
      value: "male",
      borderColor: "#319527",
      color: "#319527",
      size: 22,
    },
    {
      id: "2",
      label: "Nữ",
      value: "female",
      borderColor: "#319527",
      color: "#319527",
      size: 22,
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
        text1: "Lỗi",
        text2: "Không thể tải thông tin cá nhân",
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

      FastImage.clearDiskCache();
      FastImage.clearMemoryCache();

      Toast.show({
        type: "success",
        text1: "Thành công",
        text2: "Cập nhật thông tin thành công",
        autoHide: true,
        visibilityTime: 5000,
        topOffset: 60,
      });
      navigation.goBack();
    } catch (error) {
      console.error("Error updating profile:", error.response.data);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể cập nhật thông tin",
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
    });

    if (!result.canceled) {
      setSelectedCoverImage(result.assets[0].uri);
    }
  };

  const formatDateToVietnamese = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day} Tháng ${month} ${year}`;
  };

  if (loadingFirst) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <CustomLoading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={"padding"} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#319527" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chỉnh sửa trang cá nhân</Text>
          <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
            <Text
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              {loading ? "Đang lưu..." : "Lưu"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          scrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ backgroundColor: "white" }}
        >
          <Text style={styles.updateAvatarText}>Cập nhật ảnh</Text>
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
              style={styles.changeAvatarButton}
            >
              <Ionicons name="camera-outline" size={20} color="#404040" />
              <Text style={styles.changeAvatarText}>Thay đổi ảnh đại diện</Text>
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
              style={styles.changeAvatarButton}
            >
              <Ionicons name="pencil-outline" size={20} color="#404040" />
              <Text style={styles.changeAvatarText}>Thay đổi ảnh bìa</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.updateAvatarText}>Cập nhật thông tin</Text>
          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên hiển thị</Text>
              <TextInput
                style={styles.input}
                value={profileData.profile_name}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, profile_name: text }))
                }
                placeholder="Nhập tên hiển thị"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tiểu sử</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={profileData.bio}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, bio: text }))
                }
                placeholder="Thêm tiểu sử"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Lớp</Text>
              <TextInput
                style={styles.input}
                value={profileData.class_name}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, class_name: text }))
                }
                placeholder="Nhập lớp của bạn"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput
                style={styles.input}
                value={profileData.location}
                onChangeText={(text) =>
                  setProfileData((prev) => ({ ...prev, location: text }))
                }
                placeholder="Nhập địa chỉ"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ngày sinh</Text>
              <TouchableOpacity
                onPress={() => setOpen(true)}
                style={[styles.input, { justifyContent: "center" }]}
              >
                <Text style={{ color: profileData.birthday ? "#000" : "#999" }}>
                  {profileData.birthday
                    ? formatDateToVietnamese(date)
                    : "Chọn ngày sinh"}
                </Text>
              </TouchableOpacity>

              <DatePicker
                modal
                open={open}
                date={date}
                mode="date"
                locale="vi"
                title="Chọn ngày sinh"
                confirmText="Xác nhận"
                cancelText="Huỷ"
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                onConfirm={(selectedDate) => {
                  setOpen(false);
                  setDate(selectedDate);
                  setProfileData((prev) => ({
                    ...prev,
                    birthday: formatDateToVietnamese(selectedDate),
                  }));
                }}
                onCancel={() => {
                  setOpen(false);
                }}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Giới tính</Text>
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
});

export default EditProfileScreen;
