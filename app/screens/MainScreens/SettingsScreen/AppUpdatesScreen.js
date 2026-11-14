import React, { useState, useEffect } from "react";
import FloatingScreenHeader from "../../../components/FloatingScreenHeader";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Application from "expo-application";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import axiosInstance from "../../../services/api/axiosInstance";
import {
  getRunningUpdateInfo,
  checkUpdateAvailable,
  reloadApp,
  getOtaChannel,
  setOtaChannel,
  OTA_CHANNELS,
  isOtaEnabled,
  setOtaEnabled,
  isStartupCheckEnabled,
  setStartupCheckEnabled,
} from "../../../services/ota/otaService";
import UpdatePromptModal from "../../../components/ota/UpdatePromptModal";

import { SettingSection, tint } from "../../../components/settings/SettingsUI";
import BannerWatermark from "../../../components/BannerWatermark";

// SettingSection clips its content to the rounded card and adds no padding, so
// the rows here touched/were cut by the corners: pad them inside the card.
const Section = ({ children, ...props }) => (
  <SettingSection {...props}>
    <View style={{ padding: 16 }}>{children}</View>
  </SettingSection>
);

export default function AppUpdatesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [selectedChannel, setSelectedChannel] = useState(() => getOtaChannel());
  const [otaEnabled, setOtaEnabledState] = useState(() => isOtaEnabled());
  const [startupCheckEnabled, setStartupCheckEnabledState] = useState(() => isStartupCheckEnabled());
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(null);
  const [promptUpdateInfo, setPromptUpdateInfo] = useState(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [remoteForceOta, setRemoteForceOta] = useState(null);
  const [runningUpdate, setRunningUpdate] = useState(() => getRunningUpdateInfo());

  useFocusEffect(
    React.useCallback(() => {
      setRunningUpdate(getRunningUpdateInfo());
      setSelectedChannel(getOtaChannel());
      setOtaEnabledState(isOtaEnabled());
      setStartupCheckEnabledState(isStartupCheckEnabled());
    }, [])
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await axiosInstance.get("/v1.0/app/config", { timeout: 3000 });
        if (isMounted && res?.data?.ota_update?.force) {
          setRemoteForceOta(res.data.ota_update);
        }
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleOta = (val) => {
    setOtaEnabled(val);
    setOtaEnabledState(val);
    Toast.show({
      type: "info",
      text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
      text2: val
        ? t("about.otaEnabledToast", "Đã bật cập nhật OTA.")
        : t("about.otaDisabledToast", "Đã tắt cập nhật OTA."),
    });
  };

  const handleToggleStartupCheck = (val) => {
    setStartupCheckEnabled(val);
    setStartupCheckEnabledState(val);
    Toast.show({
      type: "info",
      text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
      text2: val
        ? t("about.startupCheckEnabledToast", "Đã bật kiểm tra cập nhật khi khởi động.")
        : t("about.startupCheckDisabledToast", "Đã tắt kiểm tra cập nhật khi khởi động."),
    });
  };

  const handleSelectChannel = (channelKey) => {
    if (selectedChannel === channelKey) return;
    const newCh = setOtaChannel(channelKey);
    setSelectedChannel(newCh);
    console.log(`[OTA Screen] Switched channel to "${newCh}"`);

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
    if (!otaEnabled && !remoteForceOta?.force) {
      console.log("[OTA Screen] Check aborted: OTA is disabled in settings.");
      Toast.show({
        type: "info",
        text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
        text2: t("about.otaTurnedOffNotice", "Tính năng cập nhật OTA đang tắt. Vui lòng bật để kiểm tra."),
      });
      return;
    }
    setIsCheckingUpdate(true);
    console.log(`[OTA Screen] Manual check triggered for channel "${selectedChannel}"`);
    try {
      const result = await checkUpdateAvailable(selectedChannel, true);
      setLastCheckTime(new Date());
      console.log(`[OTA Screen] Check completed: status="${result.status}", isAvailable=${result.isAvailable}`);

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
      } else if (result.status === "native_base_outdated" && result.updateInfo) {
        setPromptUpdateInfo({
          ...result.updateInfo,
          isBaseOutdated: true,
          minNativeBuild: result.minNativeRequired,
          currentNativeBuild: result.currentNativeBuild,
        });
        setShowPromptModal(true);
      } else if (result.status === "disabled") {
        Toast.show({
          type: "info",
          text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
          text2: t("about.updatesDisabledNotice", "Bản cài đặt này không hỗ trợ cập nhật OTA tự động."),
        });
      } else {
        console.error("[OTA Screen] Check returned error status:", result.error);
        Toast.show({
          type: "error",
          text1: t("about.updatesTitle", "Cập nhật ứng dụng"),
          text2: result.error || t("about.errorCheck", "Không thể kiểm tra cập nhật. Vui lòng thử lại sau."),
        });
      }
    } catch (checkErr) {
      console.error("[OTA Screen] Exception during manual check:", checkErr?.message || checkErr);
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
      <FloatingScreenHeader title={t("about.updatesTitle", "Cập nhật ứng dụng")} onBack={() => navigation.goBack()} scrollY={scrollY} />

      <LinearGradient
        colors={
          isDarkMode
            ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
            : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140, zIndex: 0 }}
        pointerEvents="none"
      />

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
          {/* Hero banner */}
          <LinearGradient
            colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
          >
            <BannerWatermark icon="cloud-download" size={150} />
            <View style={[styles.heroIconWrap, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <Ionicons name="cloud-download" size={32} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>CBH Online</Text>
              <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
                {t("about.appVersion", "Phiên bản ứng dụng")} {Application.nativeApplicationVersion || "6.7.4"} ({Application.nativeBuildVersion || "1103"})
              </Text>
              <View style={[styles.heroChip, { backgroundColor: tint(runningUpdate.isOtaActive ? "#22C55E" : "#64748B", isDarkMode) }]}>
                <Ionicons
                  name={runningUpdate.isOtaActive ? "flash" : "cube"}
                  size={12}
                  color={runningUpdate.isOtaActive ? theme.primary : theme.subText}
                />
                <Text style={{ fontSize: 12, fontWeight: "700", color: runningUpdate.isOtaActive ? theme.primary : theme.subText }}>
                  {runningUpdate.isOtaActive && runningUpdate.activeBuildNumber
                    ? `Build ${runningUpdate.activeBuildNumber} (OTA)`
                    : t("about.embeddedBuild", "Bản cài gốc (Embedded)")}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Forced OTA Banner (when remote server mandates an update) */}
          {remoteForceOta?.force && (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 16,
                padding: 16,
                borderRadius: 20,
                backgroundColor: isDarkMode ? "rgba(220, 38, 38, 0.15)" : "#FEF2F2",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDarkMode ? "rgba(220, 38, 38, 0.35)" : "#FECACA",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Ionicons name="alert-circle" size={26} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: isDarkMode ? "#FCA5A5" : "#991B1B",
                  }}
                >
                  {t("ota.forceUpdateTitle", "Yêu cầu cập nhật bắt buộc")}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDarkMode ? "#F87171" : "#B91C1C",
                    marginTop: 3,
                    lineHeight: 17,
                  }}
                >
                  {remoteForceOta.message ||
                    t(
                      "ota.forceUpdateActiveBanner",
                      "Quản trị viên đang yêu cầu cập nhật bắt buộc trên toàn hệ thống."
                    )}
                </Text>
                {(remoteForceOta.channel || remoteForceOta.min_version || remoteForceOta.max_version || remoteForceOta.min_build || remoteForceOta.max_build) && (
                  <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {remoteForceOta.channel && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: isDarkMode ? "rgba(239,68,68,0.2)" : "#FEE2E2" }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: isDarkMode ? "#FCA5A5" : "#991B1B" }}>
                          {remoteForceOta.channel === "all" ? "Tất cả các nhánh" : `Nhánh: ${remoteForceOta.channel}`}
                        </Text>
                      </View>
                    )}
                    {(remoteForceOta.min_version || remoteForceOta.min_build) && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: isDarkMode ? "rgba(239,68,68,0.2)" : "#FEE2E2" }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: isDarkMode ? "#FCA5A5" : "#991B1B" }}>
                          ≥ {remoteForceOta.min_version || remoteForceOta.min_build}
                        </Text>
                      </View>
                    )}
                    {(remoteForceOta.max_version || remoteForceOta.max_build) && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: isDarkMode ? "rgba(239,68,68,0.2)" : "#FEE2E2" }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: isDarkMode ? "#FCA5A5" : "#991B1B" }}>
                          ≤ {remoteForceOta.max_version || remoteForceOta.max_build}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Update Settings Section */}
          <Section icon="settings" color="#6366F1" title={t("about.updateSettings", "Cài đặt cập nhật")} theme={theme}>
            <View style={styles.toggleRow}>
              <View style={[styles.channelIconWrap, { backgroundColor: tint(otaEnabled ? "#10B981" : "#64748B", isDarkMode) }]}>
                <Ionicons
                  name={otaEnabled ? "cloud-done" : "cloud-offline-outline"}
                  size={20}
                  color={otaEnabled ? "#10B981" : theme.subText}
                />
              </View>
              <View style={styles.toggleContent}>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>
                  {t("about.enableOta", "Bật cập nhật OTA")}
                </Text>
                <Text style={[styles.toggleDesc, { color: theme.subText }]}>
                  {t("about.enableOtaDesc", "Tự động nhận các tính năng mới và bản sửa lỗi nhanh chóng.")}
                </Text>
              </View>
              <Switch
                value={otaEnabled}
                onValueChange={handleToggleOta}
                trackColor={{ true: "#10B981" }}
              />
            </View>

            <View style={[styles.channelDivider, { backgroundColor: theme.border }]} />

            <View style={[styles.toggleRow, !otaEnabled && { opacity: 0.5 }]}>
              <View style={[styles.channelIconWrap, { backgroundColor: tint(startupCheckEnabled && otaEnabled ? "#6366F1" : "#64748B", isDarkMode) }]}>
                <Ionicons
                  name="play-forward"
                  size={20}
                  color={startupCheckEnabled && otaEnabled ? "#6366F1" : theme.subText}
                />
              </View>
              <View style={styles.toggleContent}>
                <Text style={[styles.toggleTitle, { color: theme.text }]}>
                  {t("about.startupCheck", "Kiểm tra khi khởi động")}
                </Text>
                <Text style={[styles.toggleDesc, { color: theme.subText }]}>
                  {t("about.startupCheckDesc", "Tự động kiểm tra bản cập nhật mới mỗi khi mở ứng dụng.")}
                </Text>
              </View>
              <Switch
                value={startupCheckEnabled}
                onValueChange={handleToggleStartupCheck}
                disabled={!otaEnabled}
                trackColor={{ true: "#6366F1" }}
              />
            </View>
          </Section>

          {/* Update Channel Selector */}
          <View style={!otaEnabled && { opacity: 0.5 }} pointerEvents={otaEnabled ? "auto" : "none"}>
            <Section icon="git-branch" color="#8B5CF6" title={t("about.updateChannel", "Kênh cập nhật")} theme={theme}>
            <TouchableOpacity
              style={styles.channelRow}
              onPress={() => handleSelectChannel(OTA_CHANNELS.PRODUCTION)}
              activeOpacity={0.7}
            >
              <View style={[styles.channelIconWrap, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
                <Ionicons
                  name={selectedChannel === OTA_CHANNELS.PRODUCTION ? "shield-checkmark" : "shield-checkmark-outline"}
                  size={20}
                  color="#22C55E"
                />
              </View>
              <View style={styles.channelContent}>
                <View style={styles.channelTitleRow}>
                  <Text style={[styles.channelTitle, { color: theme.text }]}>
                    {t("about.channelProduction", "Chính thức (Production)")}
                  </Text>
                  <View style={[styles.channelBadge, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
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
              <View style={[styles.channelIconWrap, { backgroundColor: tint("#F59E0B", isDarkMode) }]}>
                <Ionicons
                  name={selectedChannel === OTA_CHANNELS.PREVIEW ? "flask" : "flask-outline"}
                  size={20}
                  color="#F59E0B"
                />
              </View>
              <View style={styles.channelContent}>
                <View style={styles.channelTitleRow}>
                  <Text style={[styles.channelTitle, { color: theme.text }]}>
                    {t("about.channelPreview", "Thử nghiệm (Preview)")}
                  </Text>
                  <View style={[styles.channelBadge, { backgroundColor: tint("#F59E0B", isDarkMode) }]}>
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
          </View>

          {/* Version Info Section */}
          <Section icon="information-circle" color="#3B82F6" title={t("about.versionDetails", "Thông tin phiên bản")} theme={theme}>
            <View style={styles.updateRow}>
              <View style={[styles.rowIcon, { backgroundColor: tint("#3B82F6", isDarkMode) }]}><Ionicons name="cube" size={16} color="#3B82F6" /></View>
              <Text style={[styles.updateLabel, { color: theme.subText, flex: 1 }]}>
                {t("about.baseAppVersion", "Phiên bản gốc (Base)")}
              </Text>
              <Text style={[styles.updateValue, { color: theme.text }]}>
                {Application.nativeApplicationVersion || "6.7.4"} (Build {Application.nativeBuildVersion || "1103"})
              </Text>
            </View>

            <View style={[styles.updateRow, { marginTop: 14 }]}>
              <View style={[styles.rowIcon, { backgroundColor: tint("#10B981", isDarkMode) }]}><Ionicons name="flash" size={16} color="#10B981" /></View>
              <Text style={[styles.updateLabel, { color: theme.subText, flex: 1 }]}>
                {t("about.realOtaVersion", "Bản cập nhật OTA")}
              </Text>
              <Text style={[styles.updateValue, { color: theme.text }]}>
                {runningUpdate.isOtaActive && runningUpdate.activeBuildNumber
                  ? `Build ${runningUpdate.activeBuildNumber} (OTA)`
                  : t("about.embeddedBuild", "Bản cài gốc (Embedded)")}
              </Text>
            </View>

            <View style={[styles.updateRow, { marginTop: 14 }]}>
              <View style={[styles.rowIcon, { backgroundColor: tint("#8B5CF6", isDarkMode) }]}><Ionicons name="git-branch" size={16} color="#8B5CF6" /></View>
              <Text style={[styles.updateLabel, { color: theme.subText, flex: 1 }]}>
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
                <View style={[styles.rowIcon, { backgroundColor: tint("#F59E0B", isDarkMode) }]}><Ionicons name="time" size={16} color="#F59E0B" /></View>
                <Text style={[styles.updateLabel, { color: theme.subText, flex: 1 }]}>
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
          <View style={[styles.noteWrapper, { backgroundColor: tint("#3B82F6", isDarkMode) }]}>
            <Ionicons name="information-circle" size={18} color="#3B82F6" style={{ marginTop: 1 }} />
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
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 20,
    overflow: "hidden",
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionWrapper: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  toggleContent: {
    flex: 1,
    marginRight: 10,
  },
  toggleTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  toggleDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  channelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    lineHeight: 20,
    fontWeight: "600",
  },
  channelBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  channelBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  channelDesc: {
    fontSize: 12,
    lineHeight: 17,
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
    lineHeight: 20,
  },
  updateValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  checkUpdateButton: {
    marginTop: 20,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 999,
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
    lineHeight: 20,
    fontWeight: "600",
  },
  noteWrapper: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 12,
    borderRadius: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
