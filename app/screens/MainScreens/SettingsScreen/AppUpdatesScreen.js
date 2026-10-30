import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Application from "expo-application";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import {
  getRunningUpdateInfo,
  checkUpdateAvailable,
  reloadApp,
  getOtaChannel,
  setOtaChannel,
  OTA_CHANNELS,
} from "../../../services/ota/otaService";
import UpdatePromptModal from "../../../components/ota/UpdatePromptModal";

const Section = ({ title, children, theme }) => (
  <View style={styles.sectionWrapper}>
    {title ? <Text style={[styles.sectionTitle, { color: theme.primary }]}>{title}</Text> : null}
    <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {children}
    </View>
  </View>
);

export default function AppUpdatesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();

  const [selectedChannel, setSelectedChannel] = useState(() => getOtaChannel());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [promptUpdateInfo, setPromptUpdateInfo] = useState(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const runningUpdate = getRunningUpdateInfo();

  const handleSelectChannel = (channelKey) => {
    if (selectedChannel === channelKey) return;
    const newCh = setOtaChannel(channelKey);
    setSelectedChannel(newCh);

    const channelName =
      newCh === OTA_CHANNELS.PREVIEW
        ? t("about.channelPreviewShort", "Preview (dhphuc)")
        : t("about.channelProductionShort", "Production (main)");

    Toast.show({
      type: "info",
      text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
      text2: t("about.channelChanged", "Đã đổi kênh cập nhật sang {{channel}}.", { channel: channelName }),
    });
  };

  const handleCheckUpdate = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    try {
      const result = await checkUpdateAvailable(selectedChannel);
      setLastCheckTime(new Date());

      if (result.status === "dev_mode") {
        Toast.show({
          type: "info",
          text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
          text2: t("about.devModeNotice", "Đang ở chế độ phát triển (Dev), tính năng cập nhật OTA bị tắt."),
        });
      } else if (result.status === "up_to_date") {
        Toast.show({
          type: "success",
          text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
          text2: t("about.upToDate", "Ứng dụng đang ở bản mới nhất."),
        });
      } else if (result.status === "available" && result.updateInfo) {
        setPromptUpdateInfo(result.updateInfo);
        setShowPromptModal(true);
      } else if (result.status === "disabled") {
        Toast.show({
          type: "info",
          text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
          text2: t("about.updatesDisabledNotice", "Bản cài đặt này không hỗ trợ cập nhật OTA tự động."),
        });
      } else {
        Toast.show({
          type: "error",
          text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
          text2: result.error || t("about.errorCheck", "Không thể kiểm tra cập nhật. Vui lòng thử lại sau."),
        });
      }
    } catch {
      Toast.show({
        type: "error",
        text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
        text2: t("about.errorCheck", "Không thể kiểm tra cập nhật. Vui lòng thử lại sau."),
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.background,
            opacity: headerBgOpacity,
          }}
        />
        <View
          style={{
            paddingTop: insets.top,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 64 + insets.top,
          }}
        >
          <View style={{ width: 44 }}>
            <LiquidButton size={44} scrollY={scrollY} providerId="AppUpdatesScreen" onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={24} color={theme.primary} />
            </LiquidButton>
          </View>
          <Animated.Text
            style={[
              styles.headerTitle,
              {
                color: theme.primary,
                flex: 1,
                textAlign: "center",
                opacity: headerTitleOpacity,
              },
            ]}
            numberOfLines={1}
          >
            {t("about.updatesTitle", "Cập nhật ứng dụng")}
          </Animated.Text>
          <View style={{ width: 44 }} />
        </View>
      </View>

      <AndroidGlassBackdrop providerId="AppUpdatesScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          contentContainerStyle={{
            paddingTop: 80 + insets.top,
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* Hero Icon */}
          <View style={styles.heroSection}>
            <View style={[styles.heroIconWrap, { backgroundColor: theme.iconBackground }]}>
              <Ionicons name="cloud-download" size={48} color={theme.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: theme.text }]}>CBH Online</Text>
            <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
              {t("about.appVersion", "Phiên bản ứng dụng")} {Application.nativeApplicationVersion || "6.0.1"} ({Application.nativeBuildVersion || "992"})
            </Text>
          </View>

          {/* Update Channel Selector */}
          <Section title={t("about.updateChannel", "Kênh cập nhật")} theme={theme}>
            <TouchableOpacity
              style={styles.channelRow}
              onPress={() => handleSelectChannel(OTA_CHANNELS.PRODUCTION)}
              activeOpacity={0.7}
            >
              <View style={[styles.channelIconWrap, { backgroundColor: theme.iconBackground }]}>
                <Ionicons
                  name={selectedChannel === OTA_CHANNELS.PRODUCTION ? "checkmark-circle" : "shield-checkmark-outline"}
                  size={20}
                  color={selectedChannel === OTA_CHANNELS.PRODUCTION ? theme.primary : theme.subText}
                />
              </View>
              <View style={styles.channelContent}>
                <View style={styles.channelTitleRow}>
                  <Text style={[styles.channelTitle, { color: theme.text }]}>
                    {t("about.channelProduction", "Chính thức (Production)")}
                  </Text>
                  <View style={[styles.channelBadge, { backgroundColor: theme.primary + "18" }]}>
                    <Text style={[styles.channelBadgeText, { color: theme.primary }]}>
                      {t("about.channelDefaultBadge", "Mặc định")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.channelDesc, { color: theme.subText }]}>
                  {t("about.channelProductionDesc", "Bản ổn định nhất được kiểm thử kỹ lưỡng từ nhánh chính.")}
                </Text>
              </View>
              <Ionicons
                name={selectedChannel === OTA_CHANNELS.PRODUCTION ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={selectedChannel === OTA_CHANNELS.PRODUCTION ? theme.primary : theme.border}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>

            <View style={[styles.channelDivider, { backgroundColor: theme.border }]} />

            <TouchableOpacity
              style={styles.channelRow}
              onPress={() => handleSelectChannel(OTA_CHANNELS.PREVIEW)}
              activeOpacity={0.7}
            >
              <View style={[styles.channelIconWrap, { backgroundColor: theme.iconBackground }]}>
                <Ionicons
                  name={selectedChannel === OTA_CHANNELS.PREVIEW ? "flask" : "flask-outline"}
                  size={20}
                  color={selectedChannel === OTA_CHANNELS.PREVIEW ? theme.primary : theme.subText}
                />
              </View>
              <View style={styles.channelContent}>
                <View style={styles.channelTitleRow}>
                  <Text style={[styles.channelTitle, { color: theme.text }]}>
                    {t("about.channelPreview", "Thử nghiệm (Preview)")}
                  </Text>
                  <View style={[styles.channelBadge, { backgroundColor: "#f59e0b20" }]}>
                    <Text style={[styles.channelBadgeText, { color: "#f59e0b" }]}>
                      dhphuc
                    </Text>
                  </View>
                </View>
                <Text style={[styles.channelDesc, { color: theme.subText }]}>
                  {t("about.channelPreviewDesc", "Cập nhật sớm các tính năng mới nhất trực tiếp từ nhánh dhphuc.")}
                </Text>
              </View>
              <Ionicons
                name={selectedChannel === OTA_CHANNELS.PREVIEW ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={selectedChannel === OTA_CHANNELS.PREVIEW ? theme.primary : theme.border}
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </Section>

          {/* Version Info Section */}
          <Section title={t("about.versionDetails", "Thông tin phiên bản")} theme={theme}>
            <View style={styles.updateRow}>
              <Text style={[styles.updateLabel, { color: theme.subText }]}>
                {t("about.appVersion", "Phiên bản ứng dụng")}
              </Text>
              <Text style={[styles.updateValue, { color: theme.text }]}>
                {Application.nativeApplicationVersion || "6.0.1"} ({Application.nativeBuildVersion || "992"})
              </Text>
            </View>

            <View style={[styles.updateRow, { marginTop: 14 }]}>
              <Text style={[styles.updateLabel, { color: theme.subText }]}>
                {t("about.otaUpdate", "Bản cập nhật OTA")}
              </Text>
              <Text style={[styles.updateValue, { color: theme.text }]}>
                {runningUpdate.updateId ? `${runningUpdate.updateId.slice(0, 8)}...` : t("about.embeddedBuild", "Bản cài gốc")}
              </Text>
            </View>

            <View style={[styles.updateRow, { marginTop: 14 }]}>
              <Text style={[styles.updateLabel, { color: theme.subText }]}>
                {t("about.updateChannel", "Kênh cập nhật")}
              </Text>
              <Text style={[styles.updateValue, { color: theme.text }]}>
                {selectedChannel === OTA_CHANNELS.PREVIEW
                  ? t("about.channelPreviewShort", "Preview (dhphuc)")
                  : t("about.channelProductionShort", "Production (main)")}
              </Text>
            </View>

            {lastCheckTime ? (
              <View style={[styles.updateRow, { marginTop: 14 }]}>
                <Text style={[styles.updateLabel, { color: theme.subText }]}>
                  {t("about.lastChecked", "Lần kiểm tra gần nhất")}
                </Text>
                <Text style={[styles.updateValue, { color: theme.subText, fontSize: 13 }]}>
                  {lastCheckTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.checkUpdateButton, { backgroundColor: theme.primary }]}
              onPress={handleCheckUpdate}
              disabled={isCheckingUpdate}
              activeOpacity={0.8}
            >
              {isCheckingUpdate ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.buttonInner}>
                  <Ionicons name="cloud-download-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.checkUpdateButtonText}>{t("about.checkUpdates", "Kiểm tra bản cập nhật")}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Section>

          {/* Explanation note */}
          <View style={styles.noteWrapper}>
            <Text style={[styles.noteText, { color: theme.subText }]}>
              {t("about.otaExplanation", "Bản cập nhật OTA (Over-The-Air) cho phép bạn nhanh chóng nhận các tính năng mới và bản sửa lỗi ngay khi khởi động ứng dụng mà không cần cài đặt lại từ đầu.")}
            </Text>
          </View>
        </Animated.ScrollView>
      </AndroidGlassBackdrop>
      <UpdatePromptModal
        visible={showPromptModal}
        updateInfo={promptUpdateInfo}
        onDismiss={() => setShowPromptModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  heroIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
  },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  settingSection: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    padding: 18,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  channelIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  channelContent: {
    flex: 1,
  },
  channelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  channelTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  channelBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  channelBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  channelDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  channelDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  updateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  updateLabel: {
    fontSize: 14,
  },
  updateValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  checkUpdateButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  checkUpdateButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  noteWrapper: {
    marginHorizontal: 20,
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
