import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useAuthContext } from "../../../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../../components/LiquidButton";
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
  const { theme, isDarkMode } = useTheme();
  const { isLoggedIn, userInfo, refreshUserInfo } = useAuthContext();
  const { t } = useTranslation();

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
  const scrollY = useRef(new Animated.Value(0)).current;

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
        text1: t("studyMaterial.loadDetailError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
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
    return material.is_free || material.price === 0
      ? t("studyMaterial.free")
      : t("studyMaterial.points", { value: material.price || 0 });
  }, [material, t]);

  const getCategoryLabel = (category) => {
    const rawName = (category?.name || "").toString().trim();
    const slug = (category?.slug || "").toString().trim();

    const normalize = (value) =>
      value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const candidates = [slug, rawName]
      .map((value) => normalize(value))
      .filter(Boolean);

    const directKey = candidates.find((candidate) => {
      const translated = t(`studyMaterial.categoriesList.${candidate}`, { defaultValue: "" });
      return Boolean(translated);
    });

    if (directKey) {
      return t(`studyMaterial.categoriesList.${directKey}`);
    }

    const aliasMap = {
      math: t("studyMaterial.categoriesList.mathematics"),
      "địa-lý": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "địa-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "dia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      geography: t("studyMaterial.categoriesList.geography"),
      maths: t("studyMaterial.categoriesList.mathematics"),
      mathematics: t("studyMaterial.categoriesList.mathematics"),
      toan: t("studyMaterial.categoriesList.mathematics"),
      "toan-hoc": t("studyMaterial.categoriesList.mathematics"),
      science: t("studyMaterial.categoriesList.science"),
      "khoa-hoc": t("studyMaterial.categoriesList.science"),
      literature: t("studyMaterial.categoriesList.literature"),
      "van-hoc": t("studyMaterial.categoriesList.literature"),
      "ngu-van": t("studyMaterial.categoriesList.literature"),
      "ngữ-văn": t("studyMaterial.categoriesList.literature"),
      history: t("studyMaterial.categoriesList.history"),
      "lich-su": t("studyMaterial.categoriesList.history"),
      english: t("studyMaterial.categoriesList.english"),
      "tieng-anh": t("studyMaterial.categoriesList.english"),
      "tieng-nga": t("studyMaterial.categoriesList.foreign-language"),
      "tiếng-nga": t("studyMaterial.categoriesList.foreign-language"),
      russian: t("studyMaterial.categoriesList.foreign-language"),
      geography: t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "đia-ly": t("studyMaterial.categoriesList.geography"),
      "dia-ly-1": t("studyMaterial.categoriesList.geography"),
      "đia-ly-1": t("studyMaterial.categoriesList.geography"),
      "dia-ly-2": t("studyMaterial.categoriesList.geography"),
      "đia-ly-2": t("studyMaterial.categoriesList.geography"),
      "dia-ly-3": t("studyMaterial.categoriesList.geography"),
      "đia-ly-3": t("studyMaterial.categoriesList.geography"),
      "dia-ly-4": t("studyMaterial.categoriesList.geography"),
      "đia-ly-4": t("studyMaterial.categoriesList.geography"),
      "diai-ly": t("studyMaterial.categoriesList.geography"),
      "đia-lyh": t("studyMaterial.categoriesList.geography"),
      "dia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "đia-ly-hoc": t("studyMaterial.categoriesList.geography"),
      "geography-1": t("studyMaterial.categoriesList.geography"),
      "địa-lý": t("studyMaterial.categoriesList.geography"),
      "địa lý": t("studyMaterial.categoriesList.geography"),
      "dia ly": t("studyMaterial.categoriesList.geography"),
      "đia lý": t("studyMaterial.categoriesList.geography"),
      exam: t("studyMaterial.categoriesList.exam"),
      "on-thi": t("studyMaterial.categoriesList.exam"),
      general: t("studyMaterial.categoriesList.general"),
      other: t("studyMaterial.categoriesList.other"),
      khac: t("studyMaterial.categoriesList.other"),
      khác: t("studyMaterial.categoriesList.other"),
      technology: t("studyMaterial.categoriesList.technology"),
      "cong-nghe": t("studyMaterial.categoriesList.technology"),
      physics: t("studyMaterial.categoriesList.physics"),
      "vat-ly": t("studyMaterial.categoriesList.physics"),
      chemistry: t("studyMaterial.categoriesList.chemistry"),
      "hoa-hoc": t("studyMaterial.categoriesList.chemistry"),
      biology: t("studyMaterial.categoriesList.biology"),
      "sinh-hoc": t("studyMaterial.categoriesList.biology"),
      geography: t("studyMaterial.categoriesList.geography"),
      "dia-ly": t("studyMaterial.categoriesList.geography"),
      "computer-science": t("studyMaterial.categoriesList.computer-science"),
      "tin-hoc": t("studyMaterial.categoriesList.computer-science"),
      "social-science": t("studyMaterial.categoriesList.social-science"),
      "khoa-hoc-xa-hoi": t("studyMaterial.categoriesList.social-science"),
      "foreign-language": t("studyMaterial.categoriesList.foreign-language"),
      "ngoai-ngu": t("studyMaterial.categoriesList.foreign-language"),
      economics: t("studyMaterial.categoriesList.economics"),
      "kinh-te": t("studyMaterial.categoriesList.economics"),
      business: t("studyMaterial.categoriesList.business"),
      "kinh-doanh": t("studyMaterial.categoriesList.business"),
      law: t("studyMaterial.categoriesList.law"),
      "luat": t("studyMaterial.categoriesList.law"),
      medicine: t("studyMaterial.categoriesList.medicine"),
      "y-hoc": t("studyMaterial.categoriesList.medicine"),
      engineering: t("studyMaterial.categoriesList.engineering"),
      "ky-thuat": t("studyMaterial.categoriesList.engineering"),
      art: t("studyMaterial.categoriesList.art"),
      "my-thuat": t("studyMaterial.categoriesList.art"),
    };

    const normalizedName = candidates[0] || "";
    return aliasMap[normalizedName] || rawName || t("studyMaterial.categoriesList.default");
  };

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

  const officePreviewExtensions = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const fileExtension = material?.file?.file_name?.split(".").pop()?.toLowerCase();
  const isPdf = fileExtension === "pdf";
  const isOfficePreviewable = officePreviewExtensions.includes(fileExtension);
  const previewBaseUrl = axiosInstance.defaults.baseURL || "https://api.chuyenbienhoa.com/";
  const directPreviewUrl = material?.file_url
    || (material?.file?.file_path
      ? `${previewBaseUrl.replace(/\/$/, "")}/storage/${material.file.file_path.replace(/^\/+/, "")}`
      : null);
  const officeViewerUrl = isOfficePreviewable && directPreviewUrl && (material?.is_free || material?.is_purchased)
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(directPreviewUrl)}`
    : null;
  const pdfViewerUrl = isPdf && directPreviewUrl && (material?.is_free || material?.is_purchased)
    ? directPreviewUrl
    : null;

  const handlePurchase = async () => {
    if (!isLoggedIn) {
      Toast.show({ type: "info", text1: t("studyMaterial.loginToBuy") });
      return;
    }

    if (!material) return;

    if (currentBalance < purchasePrice) {
      Toast.show({ type: "error", text1: t("studyMaterial.insufficientPoints") });
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
        text1: t("studyMaterial.purchaseSuccess"),
        text2: t("studyMaterial.remainingBalanceValue", { value: refreshedBalance }),
      });
      await loadMaterial();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("studyMaterial.purchaseError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRate = async () => {
    if (!material) return;

    if (!isLoggedIn) {
      Toast.show({ type: "info", text1: t("studyMaterial.loginToReview") });
      return;
    }

    if (ratingValue === 0) {
      Toast.show({ type: "info", text1: t("studyMaterial.selectRating") });
      return;
    }

    try {
      setSubmittingRate(true);
      await rateMaterial(materialId, { rating: ratingValue, comment: ratingComment });
      Toast.show({ type: "success", text1: t("studyMaterial.reviewSuccess") });
      await loadMaterial();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("studyMaterial.reviewError"),
        text2: error?.response?.data?.message || t("studyMaterial.tryAgain"),
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
          text1: t("studyMaterial.downloadSuccess"),
          text2: t("studyMaterial.downloadSuccessHint"),
        });

        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri, {
              dialogTitle: material?.title || t("studyMaterial.material"),
            });
          }
        } catch (shareError) {
          console.warn("Unable to launch share sheet", shareError);
        }
      } else {
        Toast.show({ type: "error", text1: t("studyMaterial.downloadError"), text2: t("studyMaterial.invalidFile") });
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("studyMaterial.downloadError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, { paddingTop: insets.top + 6, height: insets.top + 64 }]} pointerEvents="box-none">
        <LiquidButton size={44} scrollY={scrollY} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.primary} />
        </LiquidButton>
        <Animated.Text
          style={[
            styles.headerTitle,
            {
              color: theme.text,
              opacity: scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: "clamp" }),
            },
          ]}
          numberOfLines={1}
        >
          {t("studyMaterial.detailTitle")}
        </Animated.Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.subText }]}>{t("studyMaterial.loadingDetails")}</Text>
        </View>
      ) : !material ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: theme.text }]}>{t("studyMaterial.notFound")}</Text>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: 40 + insets.bottom }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.badge, { backgroundColor: theme.primary + "15" }]}> 
              <Text style={[styles.badgeText, { color: theme.primary }]}>{material?.category?.name ? getCategoryLabel(material.category) : t("studyMaterial.material")}</Text>
            </View>
            <Text style={[styles.titleText, { color: theme.text }]}>{material.title}</Text>
            <Text style={[styles.descriptionText, { color: theme.subText }]}>{material.description || t("studyMaterial.noDescription")}</Text>
            <View style={styles.rowBetween}>
              <Text style={[styles.metaText, { color: theme.primary }]}>{priceLabel}</Text>
              <Text style={[styles.metaText, { color: theme.subText }]}>⭐ {material.average_rating || 0}/5</Text>
            </View>
          </View>

          <View style={[styles.infoCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("studyMaterial.details")}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>{t("studyMaterial.author", { value: material?.author?.profile_name || material?.author?.username || t("studyMaterial.member") })}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="download-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>{t("studyMaterial.downloadCount", { value: material.download_count || 0 })}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="eye-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>{t("studyMaterial.viewCount", { value: material.view_count || 0 })}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={theme.primary} />
              <Text style={[styles.infoValue, { color: theme.subText }]}>{t("studyMaterial.createdAt", { value: new Date(material.created_at).toLocaleDateString() })}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {!material.is_purchased && !material.is_free && material.price > 0 ? (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => setShowPurchaseModal(true)} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("studyMaterial.buy")}</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={handleDownload} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("studyMaterial.download")}</Text>}
              </TouchableOpacity>
            )}
          </View>

          {pdfViewerUrl || officeViewerUrl ? (
            <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("studyMaterial.preview")}</Text>
              <View style={styles.webviewContainer}>
                <WebView
                  source={{ uri: pdfViewerUrl || officeViewerUrl }}
                  style={styles.webview}
                  startInLoadingState
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={["*"]}
                  allowsBackForwardNavigationGestures={false}
                  scrollEnabled={false}
                  nestedScrollEnabled={false}
                />
              </View>
            </View>
          ) : null}

          {material.preview_content ? (
            <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("studyMaterial.summary")}</Text>
              <Text style={[styles.previewText, { color: theme.subText }]}>{material.preview_content}</Text>
            </View>
          ) : null}

          <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("studyMaterial.reviews")}</Text>
            <Text style={[styles.helperText, { color: theme.subText }]}>{t("studyMaterial.reviewHint")}</Text>
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
              placeholder={t("studyMaterial.reviewPlaceholder")}
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
              {submittingRate ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("studyMaterial.submitReview")}</Text>}
            </TouchableOpacity>
            {userRating ? (
              <Text style={[styles.helperText, { color: theme.primary, marginTop: 8 }]}>{t("studyMaterial.reviewed", { value: userRating.rating })}</Text>
            ) : null}
          </View>

          {ratings.length > 0 ? (
            <View style={[styles.previewCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t("studyMaterial.communityReviews")}</Text>
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
                              {(item?.user?.profile?.profile_name || item?.user?.username || t("studyMaterial.member")).charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.ratingUserInfo}>
                          <Text style={[styles.ratingUser, { color: theme.text }]}>{item?.user?.profile?.profile_name || item?.user?.username || t("studyMaterial.member")}</Text>
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
        </Animated.ScrollView>
      )}

      <Modal
        transparent
        visible={showPurchaseModal}
        animationType="fade"
        onRequestClose={() => setShowPurchaseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}> 
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t("studyMaterial.purchaseTitle")}</Text>
            <Text style={[styles.modalText, { color: theme.subText }]}>{t("studyMaterial.purchaseMessage", { title: material?.title, price: purchasePrice })}</Text>
            <View style={[styles.balanceBox, { backgroundColor: theme.primary + "12" }]}> 
              <Text style={[styles.balanceLabel, { color: theme.subText }]}>{t("studyMaterial.currentBalance")}</Text>
              <Text style={[styles.balanceValue, { color: theme.primary }]}> 
                {balanceLoading ? t("studyMaterial.balanceLoading") : t("studyMaterial.points", { value: currentBalance })}
              </Text>
            </View>
            <View style={[styles.balanceBox, { backgroundColor: theme.background }]}> 
              <Text style={[styles.balanceLabel, { color: theme.subText }]}>{t("studyMaterial.remainingBalance")}</Text>
              <Text style={[styles.balanceValue, { color: theme.text }]}>{balanceLoading ? t("studyMaterial.balanceLoading") : t("studyMaterial.points", { value: remainingBalance })}</Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalSecondaryButton, { borderColor: theme.subText + "55" }]} onPress={() => setShowPurchaseModal(false)}>
                <Text style={[styles.modalSecondaryText, { color: theme.text }]}>{t("studyMaterial.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, { backgroundColor: currentBalance < purchasePrice ? "#9ca3af" : theme.primary }]}
                onPress={handlePurchase}
                disabled={processing || currentBalance < purchasePrice}
              >
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>{t("studyMaterial.buyNow")}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
  largeTitle: {
    fontSize: 30,
    fontWeight: "800",
    marginHorizontal: 16,
    marginBottom: 16,
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
    height: 320,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginTop: 8,
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
