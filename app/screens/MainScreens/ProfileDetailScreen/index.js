import React, { useContext, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastImage from "react-native-fast-image";
import { AuthContext } from "../../../contexts/AuthContext";
import { getProfile } from "../../../services/api/Api";
import CustomLoading from "../../../components/CustomLoading";
import Toast from "react-native-toast-message";
import { useFocusEffect } from "@react-navigation/native";

const ProfileDetailScreen = ({ navigation, route }) => {
  const { username: currentUsername } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const username = route.params?.username || currentUsername;
  const isCurrentUser = username === currentUsername;

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
    } catch (error) {
      console.error("Error fetching profile:", error);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể tải thông tin cá nhân",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <CustomLoading />
      </SafeAreaView>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return "Chưa cập nhật";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const renderInfoItem = (icon, label, value) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIconContainer}>
        <Ionicons name={icon} size={24} color="#319527" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "Chưa cập nhật"}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#319527" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
        {isCurrentUser ? (
          <TouchableOpacity
            onPress={() => navigation.navigate("EditProfileScreen")}
          >
            <Ionicons name="create-outline" size={24} color="#319527" />
          </TouchableOpacity>
        ) : (
          <View className="w-6 h-6"></View>
        )}
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <FastImage
            source={{
              uri: `https://api.chuyenbienhoa.com/v1.0/users/${username}/avatar`,
            }}
            style={styles.avatar}
          />
          <Text style={styles.profileName}>{profileData?.profile_name}</Text>
          <Text style={styles.username}>@{username}</Text>
        </View>

        {/* Bio Section */}
        {profileData?.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{profileData.bio}</Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          {renderInfoItem(
            "calendar-outline",
            "Ngày sinh",
            formatDate(profileData?.birthday_raw)
          )}
          {renderInfoItem("location-outline", "Địa chỉ", profileData?.location)}
          {renderInfoItem("school-outline", "Lớp", profileData?.class_name)}
          {renderInfoItem(
            "person-outline",
            "Giới tính",
            profileData?.gender === "Male" ? "Nam" : "Nữ"
          )}
          {renderInfoItem("mail-outline", "Email", profileData?.email)}
          {renderInfoItem("time-outline", "Tham gia", profileData?.joined_at)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: "#666",
  },
  bioSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  bioText: {
    fontSize: 16,
    color: "#333",
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
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
});

export default ProfileDetailScreen;
