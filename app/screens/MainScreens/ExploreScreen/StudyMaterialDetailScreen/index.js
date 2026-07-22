import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Share,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useAuthContext } from "../../../../contexts/AuthContext";
import axiosInstance from "../../../../services/api/axiosInstance";
import WebView from "react-native-webview";
import {
  getCurrentPoints,
  getMaterialRatings,
  getStudyMaterial,
  purchaseMaterial,
  rateMaterial,
  viewMaterial,
} from "../../../../services/api/Api";

const StudyMaterialDetailScreen = ({ route, navigation }) => {
  const { materialId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isLoggedIn, userInfo, refreshUserInfo } = useAuthContext();

  const [material, setMaterial] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [userRating, setUserRating] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [submittingRate, setSubmittingRate] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadMaterial = async () => {
    try {
      setLoading(true);
      const response = await getStudyMaterial(materialId);
      const detail = response?.data || null;
      setMaterial(detail);
      setUserRating(detail?.user_rating || null);
      setRatingValue(detail?.user_rating?.rating || 0);
      setRatingComment(detail?.user_rating?.comment || "");
      viewMaterial(materialId).catch(() => null);
      try {
        const ratingsResponse = await getMaterialRatings(materialId);
        setRatings(ratingsResponse?.data?.data || []);
      } catch (ratingsError) {
        console.warn("Unable to load ratings", ratingsError);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Không thể tải chi tiết tài liệu",
        text2: error?.message || "Vui lòng thử lại",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (materialId) {
      loadMaterial();
    }
  }, [materialId]);

  useEffect(() => {
    if (isLoggedIn) {
      loadUserBalance();
    } else {
      setCurrentBalance(0);
    }
  }, [isLoggedIn]);

  const priceLabel = useMemo(() => {
    if (!material) return "";
    return material.is_free || material.price === 0 ? "Miễn phí" : `${material.price || 0} điểm`;
  }, [material]);

  const loadUserBalance = async (shouldRefreshContext = true) => {
    if (!isLoggedIn) {
      setCurrentBalance(0);
      return 0;
    }

    try {
      setBalanceLoading(true);
      const response = await getCurrentPoints();
      const user = response?.data || null;
      const balance = Number(
        user?.current_points ??
          user?.total_points ??
          user?.stats?.activity_points ??
          user?.activity_points ??
          user?.points ??
          userInfo?.stats?.activity_points ??
          userInfo?.activity_points ??
          userInfo?.points ??
          0
      );
      setCurrentBalance(balance);

      if (shouldRefreshContext && user) {
        await refreshUserInfo();
      }
      return balance;
    } catch (error) {
      console.warn("Unable to load user balance", error);
      const fallbackBalance = Number(
        userInfo?.stats?.activity_points ??
          userInfo?.activity_points ??
          userInfo?.points ??
          0
      );
      setCurrentBalance(fallbackBalance);
      return fallbackBalance;
    } finally {
      setBalanceLoading(false);
    }
  };

  const purchasePrice = Number(material?.price || 0);
  const remainingBalance = Math.max(0, currentBalance - purchasePrice);

  const officePreviewExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const fileExtension = material?.file?.file_name?.split(".").pop()?.toLowerCase();
  const isOfficePreviewable = officePreviewExtensions.includes(fileExtension);
  const previewBaseUrl = axiosInstance.defaults.baseURL || "https://api.chuyenbienhoa.com/";
  const documentViewUrl = material?.id && material?.preview_key
    ? `${previewBaseUrl.replace(/\/$/, "")}/v1.0/study-materials/documents/view?id=${material.id}&key=${material.preview_key}`
    : null;
  const officeViewerUrl = isOfficePreviewable && documentViewUrl && (material?.is_free || material?.is_purchased)
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(documentViewUrl)}`
    : null;

  const handlePurchase = async () => {
    if (!isLoggedIn) {
      Toast.show({ type: "info", text1: "Vui lòng đăng nhập để mua tài liệu" });
      return;
    }

    if (!material) return;

    if (currentBalance < purchasePrice) {
      Toast.show({ type: "error", text1: "Không đủ điểm để mua tài liệu" });
      setShowPurchaseModal(false);
      return;
    }

    try {
      setProcessing(true);
      setShowPurchaseModal(false);
      await purchaseMaterial(materialId);
      const refreshedBalance = await loadUserBalance(true);

      Toast.show({
        type: "success",
        text1: "Mua tài liệu thành công",
        text2: `Số dư còn lại: ${refreshedBalance} điểm`,
      });
      await loadMaterial();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Mua tài liệu thất bại",
        text2: error?.message || "Vui lòng thử lại",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRate = async () => {
    if (!material) return;

    if (!isLoggedIn) {
      Toast.show({ type: "info", text1: "Vui lòng đăng nhập để đánh giá tài liệu" });
      return;
    }

    if (ratingValue === 0) {
      Toast.show({ type: "info", text1: "Vui lòng chọn số sao" });
      return;
    }

    try {
      setSubmittingRate(true);
      await rateMaterial(materialId, { rating: ratingValue, comment: ratingComment });
      Toast.show({ type: "success", text1: "Cảm ơn bạn đã đánh giá" });
      await loadMaterial();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Đánh giá thất bại",
        text2: error?.message || "Vui lòng thử lại",
      });
    } finally {
      setSubmittingRate(false);
    }
  };

  const handleDownload = async () => {
    if (!material) return;

    try {
      setProcessing(true);

      const token = await AsyncStorage.getItem("auth_token");
      const baseUrl = (axiosInstance.defaults.baseURL || "https://api.chuyenbienhoa.com/").replace(/\/$/, "");
      const downloadUrl = `${baseUrl}/v1.0/study-materials/${materialId}/download`;
      const proposedName = material?.file?.file_name || `${material?.title || "study-material"}.pdf`;
      const safeName = proposedName.replace(/[\\/:*?"<>|]/g, "_");
      const fileUri = `${FileSystem.documentDirectory}${safeName}`;

      const result = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          Accept: "application/octet-stream",
        },
      });

      if (result?.status === 200) {
        Toast.show({
          type: "success",
          text1: "Đã tải xuống thành công",
          text2: "Bạn có thể lưu vào Files hoặc chia sẻ ngay bây giờ",
        });

        try {
          await Share.share({
            url: result.uri,
            title: material?.title || "Study material",
            message: `Tài liệu: ${material?.title || "study material"}`,
          });
        } catch (shareError) {
          console.warn("Unable to launch share sheet", shareError);
        }
      } else {
        Toast.show({ type: "error", text1: "Tải tài liệu thất bại", text2: "Không nhận được file hợp lệ" });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Tải tài liệu thất bại",
        text2: error?.message || "Vui lòng thử lại",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.header, { paddingTop: 8 }]}> 
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Chi tiết tài liệu</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subText }]}>Đang tải thông tin...</Text>
        </View>
      ) : !material ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: theme.text }]}>Không tìm thấy tài liệu</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
          <View style={[styles.heroCard, { backgroundColor: theme.cardBackground }]}> 
            <View style={[styles.badge, { backgroundColor: theme.primary + "15" }]}> 
              <Text style={[styles.badgeText, { color: theme.primary }]}>{material?.category?.name || "Tài liệu"}</Text>
            </View>
            <Text style={[styles.titleText, { color: theme.text }]}>{material.title}</Text>
            <Text style={[styles.descriptionText, { color: theme.subText }]}>{material.description || "Không có mô tả"}</Text>
            <View style={styles.rowBetween}>
              <Text style={[styles.metaText, { color: theme.primary }]}>{priceLabel}</Text>
              <Text style={[styles.metaText, { color: theme.subText }]}>⭐ {material.average_rating || 0}/5</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Thông tin chi tiết</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>Tác giả: {material?.author?.profile_name || material?.author?.username || "Thành viên"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="download-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>Lượt tải: {material.download_count || 0}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="eye-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>Lượt xem: {material.view_count || 0}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>Ngày đăng: {new Date(material.created_at).toLocaleDateString("vi-VN")}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {!material.is_purchased && !material.is_free && material.price > 0 ? (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => setShowPurchaseModal(true)} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Mua tài liệu</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={handleDownload} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tải xuống</Text>}
              </TouchableOpacity>
            )}
          </View>

          {officeViewerUrl ? (
            <View style={[styles.previewCard, { backgroundColor: theme.cardBackground }]}> 
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Xem trước tài liệu</Text>
              <View style={styles.webviewContainer}>
                <WebView
                  source={{ uri: officeViewerUrl }}
                  style={styles.webview}
                  startInLoadingState
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={["*"]}
                />
              </View>
            </View>
          ) : null}

          {material.preview_content ? (
            <View style={[styles.previewCard, { backgroundColor: theme.cardBackground }]}> 
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Tóm tắt nội dung</Text>
              <Text style={[styles.previewText, { color: theme.subText }]}>{material.preview_content}</Text>
            </View>
          ) : null}

          <View style={[styles.previewCard, { backgroundColor: theme.cardBackground }]}> 
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Đánh giá tài liệu</Text>
            <Text style={[styles.helperText, { color: theme.subText }]}>Chọn số sao và để lại nhận xét cho tài liệu này.</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingValue(star)} disabled={submittingRate}>
                  <Ionicons name={star <= ratingValue ? "star" : "star-outline"} size={28} color="#f59e0b" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.subText + "55" }]}
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="Nhận xét của bạn..."
              placeholderTextColor={theme.subText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.rateButton, { backgroundColor: theme.primary }]}
              onPress={handleRate}
              disabled={submittingRate || ratingValue === 0}
            >
              {submittingRate ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Gửi đánh giá</Text>}
            </TouchableOpacity>
            {userRating ? (
              <Text style={[styles.helperText, { color: theme.primary, marginTop: 8 }]}>Bạn đã đánh giá {userRating.rating}/5 sao.</Text>
            ) : null}
          </View>

          {ratings.length > 0 ? (
            <View style={[styles.previewCard, { backgroundColor: theme.cardBackground }]}> 
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Nhận xét từ cộng đồng</Text>
              {ratings.map((item) => {
                const avatarUrl = item?.user?.username
                  ? `${axiosInstance.defaults.baseURL?.replace(/\/$/, "")}/v1.0/users/${item.user.username}/avatar`
                  : null;

                return (
                  <View key={item.id} style={styles.ratingItem}>
                    <View style={styles.ratingHeader}>
                      <View style={styles.ratingUserRow}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatarFallback, { backgroundColor: theme.primary + "20" }]}> 
                            <Text style={[styles.avatarFallbackText, { color: theme.primary }]}>
                              {(item?.user?.profile?.profile_name || item?.user?.username || "U").charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.ratingUserInfo}>
                          <Text style={[styles.ratingUser, { color: theme.text }]}>{item?.user?.profile?.profile_name || item?.user?.username || "Người dùng"}</Text>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons key={star} name={star <= (item?.rating || 0) ? "star" : "star-outline"} size={14} color="#f59e0b" />
                            ))}
                          </View>
                        </View>
                      </View>
                    </View>
                    {item?.comment ? <Text style={[styles.previewText, { color: theme.subText }]}>{item.comment}</Text> : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        transparent
        visible={showPurchaseModal}
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}> 
            <Text style={[styles.modalTitle, { color: theme.text }]}>Xác nhận mua tài liệu</Text>
            <Text style={[styles.modalText, { color: theme.subText }]}>Bạn có chắc muốn mua tài liệu <Text style={{ fontWeight: "700", color: theme.text }}>{material?.title}</Text> với giá <Text style={{ fontWeight: "700", color: theme.primary }}>{purchasePrice} điểm</Text>?</Text>
            <View style={[styles.balanceBox, { backgroundColor: theme.primary + "12" }]}> 
              <Text style={[styles.balanceLabel, { color: theme.subText }]}>Số dư hiện tại</Text>
              <Text style={[styles.balanceValue, { color: theme.primary }]}> 
                {balanceLoading ? "Đang tải..." : `${currentBalance} điểm`}
              </Text>
            </View>
            <View style={[styles.balanceBox, { backgroundColor: theme.background }]}> 
              <Text style={[styles.balanceLabel, { color: theme.subText }]}>Số dư còn lại sau khi mua</Text>
              <Text style={[styles.balanceValue, { color: theme.text }]}>{balanceLoading ? "Đang tải..." : `${remainingBalance} điểm`}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalSecondaryButton, { borderColor: theme.subText + "55" }]} onPress={() => setShowPurchaseModal(false)}>
                <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, { backgroundColor: currentBalance < purchasePrice ? "#9ca3af" : theme.primary }]}
                onPress={handlePurchase}
                disabled={processing || currentBalance < purchasePrice}
              >
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Mua ngay</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 10 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  heroCard: {
    margin: 16,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  titleText: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  descriptionText: { fontSize: 13, lineHeight: 20 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  metaText: { fontSize: 13, fontWeight: "700" },
  infoCard: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoValue: { fontSize: 13, flex: 1 },
  actionRow: { marginHorizontal: 16, marginTop: 16 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  previewCard: {
    margin: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  previewText: { fontSize: 13, lineHeight: 20 },
  helperText: { fontSize: 12, marginBottom: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalText: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  balanceBox: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  balanceLabel: { fontSize: 12, marginBottom: 2 },
  balanceValue: { fontSize: 16, fontWeight: "700" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  modalSecondaryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalSecondaryText: { fontWeight: "600" },
  modalPrimaryButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalPrimaryText: { color: "#fff", fontWeight: "700" },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
    marginBottom: 12,
  },
  rateButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  webviewContainer: {
    height: 420,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff",
  },
  ratingItem: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    marginTop: 10,
  },
  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ratingUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { fontSize: 15, fontWeight: "700" },
  ratingUserInfo: {
    flex: 1,
  },
  ratingUser: { fontSize: 13, fontWeight: "700" },
});

export default StudyMaterialDetailScreen;
