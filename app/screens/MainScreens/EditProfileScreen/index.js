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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../../contexts/AuthContext";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { getProfile, uploadFile } from "../../../services/api/Api";

const EditProfileScreen = ({ navigation }) => {
  const { username } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    profile_name: "",
    bio: "",
    location: "",
    class_name: "",
    birthday: "",
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const response = await getProfile(username);
      const { profile } = response.data;
      setProfileData({
        profile_name: profile.profile_name || "",
        bio: profile.bio || "",
        location: profile.location || "",
        class_name: profile.class_name || "",
        birthday: profile.birthday || "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể tải thông tin cá nhân",
      });
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      Object.keys(profileData).forEach((key) => {
        if (profileData[key]) {
          formData.append(key, profileData[key]);
        }
      });

      await uploadFile(formData);
      Toast.show({
        type: "success",
        text1: "Thành công",
        text2: "Cập nhật thông tin thành công",
      });
      navigation.goBack();
    } catch (error) {
      console.error("Error updating profile:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể cập nhật thông tin",
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
      const formData = new FormData();
      formData.append("avatar", {
        uri: result.assets[0].uri,
        type: "image/jpeg",
        name: "avatar.jpg",
      });

      try {
        await uploadFile(formData);
        Toast.show({
          type: "success",
          text1: "Thành công",
          text2: "Cập nhật ảnh đại diện thành công",
        });
      } catch (error) {
        console.error("Error uploading avatar:", error);
        Toast.show({
          type: "error",
          text1: "Lỗi",
          text2: "Không thể cập nhật ảnh đại diện",
        });
      }
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chỉnh sửa trang cá nhân</Text>
            <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
              <Text
                style={[
                  styles.saveButton,
                  loading && styles.saveButtonDisabled,
                ]}
              >
                {loading ? "Đang lưu..." : "Lưu"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <Image
                source={{
                  uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
                }}
                style={styles.avatar}
              />
              <TouchableOpacity
                onPress={pickImage}
                style={styles.changeAvatarButton}
              >
                <Text style={styles.changeAvatarText}>
                  Thay đổi ảnh đại diện
                </Text>
              </TouchableOpacity>
            </View>

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
                <TextInput
                  style={styles.input}
                  value={profileData.birthday}
                  onChangeText={(text) =>
                    setProfileData((prev) => ({ ...prev, birthday: text }))
                  }
                  placeholder="DD/MM/YYYY"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  saveButton: {
    color: "#319527",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButtonDisabled: {
    opacity: 0.5,
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
  },
  changeAvatarText: {
    color: "#319527",
    fontSize: 16,
    fontWeight: "600",
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: "top",
  },
});

export default EditProfileScreen;
