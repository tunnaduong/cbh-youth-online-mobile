import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import { PRESET_APP_ICONS, saveCustomAppIcon } from "../../../utils/appIcons";

export default function AppIconScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode, appIcon, setAppIcon, customAppIconUri, setCustomAppIcon, appIconSource } = useTheme();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const handleSelectPreset = (key) => {
    setAppIcon(key);
    Toast.show({
      type: "success",
      text1: t("appIcon.updatedTitle", "Đã đổi biểu tượng"),
      text2: t("appIcon.updatedDesc", "Biểu tượng ứng dụng đã được cập nhật."),
      visibilityTime: 2000,
    });
  };

  const handlePickCustomImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          t("common.error", "Lỗi"),
          t("appIcon.permissionDenied", "Ứng dụng cần quyền truy cập ảnh để chọn biểu tượng.")
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets || !result.assets[0]?.uri) {
        return;
      }

      setUploading(true);
      const savedUri = await saveCustomAppIcon(result.assets[0].uri);
      setCustomAppIcon(savedUri);

      Toast.show({
        type: "success",
        text1: t("appIcon.customSetTitle", "Đã áp dụng biểu tượng tùy chỉnh"),
        text2: t("appIcon.customSetDesc", "Biểu tượng vuông 1:1 đã được lưu thành công."),
        visibilityTime: 2500,
      });
    } catch (error) {
      console.error("Error setting custom icon:", error);
      Toast.show({
        type: "error",
        text1: t("common.error", "Lỗi"),
        text2: t("appIcon.cropFailed", "Không thể cắt và lưu biểu tượng. Vui lòng thử lại."),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveCustomIcon = () => {
    Alert.alert(
      t("appIcon.removeConfirmTitle", "Xóa biểu tượng tùy chỉnh?"),
      t("appIcon.removeConfirmDesc", "Ứng dụng sẽ quay về biểu tượng mặc định ban đầu."),
      [
        { text: t("common.cancel", "Hủy"), style: "cancel" },
        {
          text: t("common.delete", "Xóa"),
          style: "destructive",
          onPress: () => {
            setCustomAppIcon(null);
            Toast.show({
              type: "info",
              text1: t("appIcon.removedTitle", "Đã xóa biểu tượng tùy chỉnh"),
            });
          },
        },
      ]
    );
  };

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

      {/* Floating Header */}
      <View pointerEvents="box-none" style={[styles.floatingHeader, { height: 64 + insets.top }]}>
        <View style={{ paddingTop: insets.top, paddingBottom: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 64 + insets.top }}>
          <View style={{ width: 44 }}>
            <LiquidButton providerId="AppIconScreen" size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {t("appIcon.title", "Biểu tượng ứng dụng")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="AppIconScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: 68 + insets.top,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* Current Icon Active Hero Banner */}
          <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.iconPreviewWrap}>
              <Image source={appIconSource} style={styles.heroIconImage} resizeMode="cover" />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {appIcon === "custom"
                  ? t("appIcon.custom", "Biểu tượng tùy chỉnh")
                  : t(
                      PRESET_APP_ICONS.find((i) => i.key === appIcon)?.nameKey || "appIcon.preset.default",
                      "Ếch CYO mặc định"
                    )}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
                {t("appIcon.activeBadge", "Đang được kích hoạt")}
              </Text>
            </View>
          </View>

          {/* Section: Custom Upload */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              {t("appIcon.customSection", "Tự tải lên")}
            </Text>
          </View>

          <View style={[styles.customCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.customCardRow}>
              <View style={[styles.customIconContainer, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                {customAppIconUri ? (
                  <Image source={{ uri: customAppIconUri }} style={styles.customThumbImage} />
                ) : (
                  <Ionicons name="image-outline" size={28} color={theme.subText} />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.customCardTitle, { color: theme.text }]}>
                  {customAppIconUri
                    ? t("appIcon.yourCustomIcon", "Ảnh tùy chỉnh của bạn")
                    : t("appIcon.noCustomYet", "Chưa có biểu tượng tải lên")}
                </Text>
                <Text style={[styles.customCardDesc, { color: theme.subText }]}>
                  {t("appIcon.cropNote", "Ảnh sẽ tự động cắt theo tỉ lệ vuông 1:1")}
                </Text>
              </View>
            </View>

            <View style={styles.customActionsRow}>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                onPress={handlePickCustomImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.uploadButtonText}>
                      {customAppIconUri
                        ? t("appIcon.changeCustom", "Đổi ảnh khác")
                        : t("appIcon.upload", "Tải lên ảnh mới")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {customAppIconUri ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.selectCustomButton,
                      {
                        borderColor: appIcon === "custom" ? theme.primary : theme.border,
                        backgroundColor: appIcon === "custom" ? (isDarkMode ? "#064e3b" : "#F3FDF1") : "transparent",
                      },
                    ]}
                    onPress={() => setAppIcon("custom")}
                  >
                    <Ionicons
                      name={appIcon === "custom" ? "checkmark-circle" : "ellipse-outline"}
                      size={18}
                      color={appIcon === "custom" ? theme.primary : theme.subText}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.selectCustomText, { color: appIcon === "custom" ? theme.primary : theme.text }]}>
                      {appIcon === "custom" ? t("common.active", "Đang dùng") : t("common.apply", "Áp dụng")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteCustomButton} onPress={handleRemoveCustomIcon}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>

          {/* Section: Presets Grid */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              {t("appIcon.presets", "Bộ sưu tập mặc định")}
            </Text>
          </View>

          <View style={styles.grid}>
            {PRESET_APP_ICONS.map((item) => {
              const isSelected = appIcon === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.gridItem,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelectPreset(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.gridIconWrap}>
                    <Image source={item.source} style={styles.gridIconImage} resizeMode="cover" />
                    {isSelected && (
                      <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.gridItemTitle, { color: isSelected ? theme.primary : theme.text }]} numberOfLines={1}>
                    {t(item.nameKey, item.tag)}
                  </Text>
                  <Text style={[styles.gridItemTag, { color: theme.subText }]} numberOfLines={1}>
                    {item.tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  iconPreviewWrap: {
    width: 68,
    height: 68,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  heroIconImage: {
    width: "100%",
    height: "100%",
  },
  heroTextWrap: {
    marginLeft: 16,
    flex: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  customCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 24,
  },
  customCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  customThumbImage: {
    width: "100%",
    height: "100%",
  },
  customCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  customCardDesc: {
    fontSize: 12,
  },
  customActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  uploadButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  selectCustomButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectCustomText: {
    fontSize: 13,
    fontWeight: "600",
  },
  deleteCustomButton: {
    padding: 9,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  gridItem: {
    width: "48%",
    padding: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  gridIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 15,
    overflow: "hidden",
    marginBottom: 10,
    position: "relative",
  },
  gridIconImage: {
    width: "100%",
    height: "100%",
  },
  checkBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  gridItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
  },
  gridItemTag: {
    fontSize: 11,
    textAlign: "center",
  },
});
