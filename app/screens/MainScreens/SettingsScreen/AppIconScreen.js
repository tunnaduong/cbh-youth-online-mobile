import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../contexts/ThemeContext";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  LAUNCHER_APP_ICONS,
  getActiveIconDisplay,
  applyLauncherIcon,
} from "../../../utils/appIcons";

export default function AppIconScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    theme,
    isDarkMode,
    launcherIconKey,
    setLauncherIconKey,
  } = useTheme();
  const { t } = useTranslation();
  const [switching, setSwitching] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const isDefault = !launcherIconKey || launcherIconKey === "default";
  const activeIconItem = getActiveIconDisplay(launcherIconKey);

  const handleSelectIcon = async (key) => {
    if (key === launcherIconKey || switching) return;

    setSwitching(true);
    try {
      const res = await applyLauncherIcon(key);
      setLauncherIconKey(key);

      if (res?.nativeApplied || key === "default") {
        Toast.show({
          type: "success",
          text1: t("appIcon.updatedTitle", "Đã đổi biểu tượng ứng dụng"),
          text2: t("appIcon.updatedDesc", "Biểu tượng màn hình chính và khởi động đã được cập nhật."),
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: "info",
          text1: t("appIcon.updatedTitle", "Đã chọn biểu tượng"),
          text2: t("appIcon.nativeBuildNotice", "Biểu tượng đã lưu trong ứng dụng và sẽ kích hoạt trên launcher ở bản build native tiếp theo."),
          visibilityTime: 3500,
        });
      }
    } catch (err) {
      console.warn("[AppIcon] Switch error:", err);
      Toast.show({
        type: "info",
        text1: t("appIcon.updatedTitle", "Đã đổi biểu tượng"),
        text2: t("appIcon.appliedStorage", "Đã lưu lựa chọn biểu tượng màn hình chính."),
      });
    } finally {
      setSwitching(false);
    }
  };

  const handleResetToDefault = () => {
    if (isDefault) return;
    handleSelectIcon("default");
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
          <View style={{ width: 44 }}>
            {!isDefault && (
              <LiquidButton providerId="AppIconScreenDefault" size={44} onPress={handleResetToDefault}>
                <Ionicons name="refresh-outline" size={20} color={theme.primary} />
              </LiquidButton>
            )}
          </View>
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
          {/* Current Active Icon Hero Banner */}
          <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.iconPreviewWrap}>
              <Image
                key={activeIconItem.key}
                source={activeIconItem.source}
                style={styles.heroIconImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.heroTextWrap}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {t(activeIconItem.nameKey, activeIconItem.tag)}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
                {isDefault
                  ? t("appIcon.activeDefaultDesc", "Đang dùng biểu tượng mặc định")
                  : t("appIcon.activeBadge", "Đang dùng trên màn hình chính")}
              </Text>
              {isDefault ? (
                <View style={[styles.resetButton, { borderColor: theme.border, opacity: 0.6 }]}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={theme.subText} style={{ marginRight: 4 }} />
                  <Text style={[styles.resetButtonText, { color: theme.subText }]}>
                    {t("appIcon.alreadyDefault", "Đang là mặc định")}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.resetButton, { borderColor: theme.primary }]}
                  onPress={handleResetToDefault}
                  disabled={switching}
                >
                  <Ionicons name="reload-outline" size={14} color={theme.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.resetButtonText, { color: theme.primary }]}>
                    {t("appIcon.resetDefault", "Đặt lại mặc định")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Section: Presets Grid (NO separate default card) */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              {t("appIcon.presets", "Bộ sưu tập biểu tượng")}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.subText }]}>
              {t("appIcon.launcherNotice", "Chọn biểu tượng hiển thị trên màn hình chính của thiết bị.")}
            </Text>
          </View>

          <View style={styles.grid}>
            {LAUNCHER_APP_ICONS.map((item) => {
              const isSelected = launcherIconKey === item.key;
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
                  onPress={() => handleSelectIcon(item.key)}
                  activeOpacity={0.7}
                  disabled={switching}
                >
                  <View style={styles.gridIconWrap}>
                    <Image
                      key={item.key}
                      source={item.source}
                      style={styles.gridIconImage}
                      resizeMode="cover"
                    />
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
    width: 72,
    height: 72,
    borderRadius: 18,
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
    flex: 1,
    marginLeft: 14,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 13,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    width: 60,
    height: 60,
    borderRadius: 15,
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
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
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
    gap: 12,
    marginTop: 4,
  },
  gridItem: {
    width: "48%",
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  gridIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 16,
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
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
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
