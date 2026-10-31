import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import dayjs from "dayjs";
import { useTheme } from "../../contexts/ThemeContext";
import { downloadAndApplyUpdate, reloadApp, OTA_CHANNELS, getNativeBuildNumber } from "../../services/ota/otaService";

const STATUS = {
  PROMPT: "prompt",
  DOWNLOADING: "downloading",
  RESTARTING: "restarting",
  BASE_OUTDATED: "base_outdated",
  ERROR: "error",
};

export default function UpdatePromptModal({
  visible,
  updateInfo,
  onDismiss,
}) {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const [status, setStatus] = useState(STATUS.PROMPT);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (visible) {
      if (updateInfo?.isBaseOutdated) {
        setStatus(STATUS.BASE_OUTDATED);
      } else {
        setStatus(STATUS.PROMPT);
      }
      setErrorMessage("");
    }
  }, [visible, updateInfo]);

  const handleUpdateNow = async () => {
    setStatus(STATUS.DOWNLOADING);
    setErrorMessage("");

    try {
      const channel = updateInfo?.channel;
      const res = await downloadAndApplyUpdate(channel, updateInfo);

      if (res.status === "downloaded") {
        setStatus(STATUS.RESTARTING);

        // Allow UI to render the restarting state before invoking native reload
        setTimeout(async () => {
          try {
            await reloadApp();
          } catch (e) {
            console.warn("[OTA Modal] reloadApp error:", e?.message);
          }
        }, 800);

        // Safety fallback: if app does not terminate within 3s, dismiss modal safely
        setTimeout(() => {
          onDismiss?.();
          Toast.show({
            type: "success",
            text1: t("ota.updateSuccessTitle", "Cập nhật thành công!"),
            text2: t("ota.updateAppliedNotice", "Bản cập nhật đã được áp dụng vĩnh viễn."),
          });
        }, 3200);
      } else {
        setStatus(STATUS.ERROR);
        setErrorMessage(res.error || t("ota.updateFailed", "Không thể tải bản cập nhật."));
      }
    } catch (err) {
      setStatus(STATUS.ERROR);
      setErrorMessage(err?.message || t("ota.updateFailed", "Không thể tải bản cập nhật."));
    }
  };

  const handleClose = () => {
    if (status === STATUS.DOWNLOADING || status === STATUS.RESTARTING) {
      return;
    }
    setStatus(STATUS.PROMPT);
    onDismiss?.();
  };

  if (!visible) return null;

  const isPreview = updateInfo?.channel === OTA_CHANNELS.PREVIEW;
  const channelBadgeLabel = isPreview
    ? t("about.channelPreviewShort", "Preview (dhphuc)")
    : t("about.channelProductionShort", "Production (main)");

  const channelBadgeBg = isPreview
    ? isDarkMode ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.15)"
    : isDarkMode ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)";
  const channelBadgeText = isPreview ? "#f59e0b" : "#3b82f6";

  const formattedDate = updateInfo?.createdAt
    ? dayjs(updateInfo.createdAt).format("DD/MM/YYYY HH:mm")
    : null;

  const buildNumberDisplay = updateInfo?.buildNumber
    ? ` · Build ${updateInfo.buildNumber}`
    : "";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              {/* Header Icon */}
              <View style={styles.headerIconRow}>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor:
                        status === STATUS.ERROR || status === STATUS.BASE_OUTDATED
                          ? isDarkMode ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.12)"
                          : theme.iconBackground,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      status === STATUS.ERROR || status === STATUS.BASE_OUTDATED
                        ? "alert-circle"
                        : status === STATUS.RESTARTING
                        ? "refresh-circle"
                        : "cloud-download"
                    }
                    size={32}
                    color={status === STATUS.ERROR || status === STATUS.BASE_OUTDATED ? "#ef4444" : theme.primary}
                  />
                </View>
              </View>

              {/* Title & Channel badge */}
              <Text style={[styles.title, { color: theme.text }]}>
                {status === STATUS.DOWNLOADING
                  ? t("ota.downloadingTitle", "Đang cập nhật...")
                  : status === STATUS.RESTARTING
                  ? t("ota.reloadingTitle", "Đang khởi động lại...")
                  : status === STATUS.BASE_OUTDATED
                  ? t("ota.baseUpdateRequiredTitle", "Yêu cầu bản cài đặt mới")
                  : status === STATUS.ERROR
                  ? t("ota.updateFailedTitle", "Cập nhật không thành công")
                  : t("ota.updateAvailableTitle", "Có bản cập nhật mới!")}
              </Text>

              <View style={[styles.channelBadge, { backgroundColor: channelBadgeBg }]}>
                <Ionicons
                  name={isPreview ? "git-branch-outline" : "shield-checkmark-outline"}
                  size={14}
                  color={channelBadgeText}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.channelBadgeText, { color: channelBadgeText }]}>
                  {channelBadgeLabel}{buildNumberDisplay}
                </Text>
              </View>

              {/* Content Body */}
              {status === STATUS.PROMPT && (
                <>
                  <View style={[styles.infoBox, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
                    <Text style={[styles.infoLabel, { color: theme.subText }]}>
                      {t("ota.changelogTitle", "Thông tin bản cập nhật")}:
                    </Text>
                    <Text style={[styles.changelogText, { color: theme.text }]} numberOfLines={4}>
                      {updateInfo?.message || t("ota.defaultUpdateMessage", "Bản cập nhật mới với nhiều cải tiến và sửa lỗi.")}
                    </Text>
                    {formattedDate ? (
                      <Text style={[styles.dateText, { color: theme.subText }]}>
                        {t("ota.publishedAt", "Phát hành lúc")}: {formattedDate}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.subNotice, { color: theme.subText }]}>
                    {t("ota.smoothUpdateNotice", "Bản cập nhật sẽ được lưu vĩnh viễn và áp dụng ngay cả khi khởi động lại ứng dụng.")}
                  </Text>
                </>
              )}

              {status === STATUS.BASE_OUTDATED && (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorDesc, { color: theme.subText }]}>
                    {t(
                      "ota.baseUpdateRequiredBuild",
                      "Bản cập nhật yêu cầu phiên bản ứng dụng Build {{min}} trở lên (bạn đang ở Build {{current}}). Vui lòng cài đặt file APK mới để tiếp tục.",
                      {
                        min: updateInfo?.minNativeBuild || 1008,
                        current: updateInfo?.currentNativeBuild || getNativeBuildNumber() || 1018,
                      }
                    )}
                  </Text>
                </View>
              )}

              {status === STATUS.DOWNLOADING && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 16 }} />
                  <Text style={[styles.loadingDesc, { color: theme.subText }]}>
                    {t("ota.downloadingDesc", "Đang tải dữ liệu bản cập nhật mới. Vui lòng giữ ứng dụng mở trong giây lát...")}
                  </Text>
                </View>
              )}

              {status === STATUS.RESTARTING && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 16 }} />
                  <Text style={[styles.loadingDesc, { color: theme.subText }]}>
                    {t("ota.reloadingDesc", "Đã lưu bản cập nhật. Đang khởi động lại ứng dụng...")}
                  </Text>
                </View>
              )}

              {status === STATUS.ERROR && (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorDesc, { color: theme.subText }]}>
                    {errorMessage || t("ota.genericError", "Đã xảy ra sự cố khi tải bản cập nhật.")}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {status === STATUS.PROMPT && (
                  <>
                    <TouchableOpacity
                      style={[styles.dismissButton, { borderColor: theme.border }]}
                      onPress={handleClose}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dismissButtonText, { color: theme.subText }]}>
                        {t("about.later", "Để sau")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.updateButton, { backgroundColor: theme.primary }]}
                      onPress={handleUpdateNow}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="download-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.updateButtonText}>
                        {t("ota.updateNow", "Cập nhật ngay")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {status === STATUS.BASE_OUTDATED && (
                  <TouchableOpacity
                    style={[styles.updateButton, { backgroundColor: theme.primary, flex: 1 }]}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.updateButtonText}>
                      {t("common.understand", "Đã hiểu")}
                    </Text>
                  </TouchableOpacity>
                )}

                {status === STATUS.ERROR && (
                  <>
                    <TouchableOpacity
                      style={[styles.dismissButton, { borderColor: theme.border }]}
                      onPress={handleClose}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dismissButtonText, { color: theme.subText }]}>
                        {t("common.close", "Đóng")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.updateButton, { backgroundColor: theme.primary }]}
                      onPress={handleUpdateNow}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="reload-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.updateButtonText}>
                        {t("common.retry", "Thử lại")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  headerIconRow: {
    marginBottom: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  channelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 16,
  },
  channelBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  infoBox: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  changelogText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 11,
  },
  subNotice: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
  },
  loadingDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
  },
  errorDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  dismissButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  updateButton: {
    flex: 1.4,
    height: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  updateButtonText: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
});
