import React, { useEffect, useMemo, useRef, useState } from "react";
import FloatingScreenHeader from "../../../../components/FloatingScreenHeader";
import FastImage from "../../../../components/FastImage";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
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
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useAuthContext } from "../../../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import LiquidButton from "../../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../../components/GlassModules";
import { useStatusBarStyle } from "../../../../hooks/useStatusBarUpdate";
import axiosInstance from "../../../../services/api/axiosInstance";
import WebView from "react-native-webview";
import BannerWatermark from "../../../../components/BannerWatermark";
import { tint } from "../../../../components/settings/SettingsUI";

// Title of a card: tinted round icon holder + title.
const CardTitle = ({ icon, color, title, theme, isDarkMode }) => (
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: tint(color, isDarkMode), alignItems: "center", justifyContent: "center", marginRight: 10 }}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
    <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text, flex: 1 }}>{title}</Text>
  </View>
);

const InfoLine = ({ icon, color, text, last, theme, isDarkMode, border }) => (
  <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: border }}>
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: tint(color, isDarkMode), alignItems: "center", justifyContent: "center", marginRight: 12 }}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={{ fontSize: 14, fontWeight: "500", color: theme.text, flex: 1 }}>{text}</Text>
  </View>
);
import {
  getCurrentPoints,
  getMaterialRatings,
  getStudyMaterial,
  purchaseMaterial,
  rateMaterial,
  viewMaterial,
  isRequestCanceled,
} from "../../../../services/api/Api";

const StudyMaterialDetailScreen = ({ route, navigation }) => {
  const { materialId } = route.params || {};
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useTheme();
  const { isLoggedIn, userInfo, refreshUserInfo } = useAuthContext();
  const { t, i18n } = useTranslation();
  useStatusBarStyle(isDarkMode ? "light-content" : "dark-content", "transparent");

  const [material, setMaterial] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [ratingsPage, setRatingsPage] = useState(1);
  const [ratingsHasMore, setRatingsHasMore] = useState(false);
  const [loadingMoreRatings, setLoadingMoreRatings] = useState(false);
  const [userRating, setUserRating] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadPercent, setDownloadPercent] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [submittingRate, setSubmittingRate] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const detailAbortRef = useRef(null);
  const ratingsAbortRef = useRef(null);
  const balanceAbortRef = useRef(null);
  const isFetchingRatingsRef = useRef(false);

  const loadMaterial = async () => {
    if (detailAbortRef.current) {
      detailAbortRef.current.abort();
    }
    const controller = new AbortController();
    detailAbortRef.current = controller;

    try {
      setLoading(true);
      const response = await getStudyMaterial(materialId, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const detail = response?.data || null;
      setMaterial(detail);
      setUserRating(detail?.user_rating || null);
      setRatingValue(detail?.user_rating?.rating || 0);
      setRatingComment(detail?.user_rating?.comment || "");
      viewMaterial(materialId).catch(() => null);
      try {
        const ratingsResponse = await getMaterialRatings(materialId, 1, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const ratingsList = ratingsResponse?.data?.data || [];
        const currentPage = Number(ratingsResponse?.data?.current_page) || 1;
        const lastPage = Number(ratingsResponse?.data?.last_page) || 1;
        setRatings(ratingsList);
        setRatingsPage(currentPage);
        setRatingsHasMore(Boolean(ratingsResponse?.data?.next_page_url || currentPage < lastPage));
      } catch (ratingsError) {
        if (!isRequestCanceled(ratingsError)) {
          console.warn("Unable to load ratings", ratingsError);
        }
      }
    } catch (error) {
      if (isRequestCanceled(error) || controller.signal.aborted) return;
      Toast.show({
        type: "error",
        text1: t("studyMaterial.loadDetailError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const loadMoreRatings = async () => {
    if (isFetchingRatingsRef.current || !ratingsHasMore || !materialId) return;
    if (ratingsAbortRef.current) {
      ratingsAbortRef.current.abort();
    }
    const controller = new AbortController();
    ratingsAbortRef.current = controller;
    isFetchingRatingsRef.current = true;
    setLoadingMoreRatings(true);

    try {
      const nextPage = ratingsPage + 1;
      const ratingsResponse = await getMaterialRatings(materialId, nextPage, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const newRatings = ratingsResponse?.data?.data || [];
      const currentPage = Number(ratingsResponse?.data?.current_page) || nextPage;
      const lastPage = Number(ratingsResponse?.data?.last_page) || currentPage;
      setRatings((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        return [...prev, ...newRatings.filter((r) => !existingIds.has(r.id))];
      });
      setRatingsPage(currentPage);
      setRatingsHasMore(Boolean(ratingsResponse?.data?.next_page_url || currentPage < lastPage));
    } catch (error) {
      if (!isRequestCanceled(error) && !controller.signal.aborted) {
        console.warn("Unable to load more ratings", error);
      }
    } finally {
      if (!controller.signal.aborted) {
        isFetchingRatingsRef.current = false;
        setLoadingMoreRatings(false);
      }
    }
  };

  useEffect(() => {
    if (materialId) {
      loadMaterial();
    }
    return () => {
      if (detailAbortRef.current) detailAbortRef.current.abort();
      if (ratingsAbortRef.current) ratingsAbortRef.current.abort();
      if (balanceAbortRef.current) balanceAbortRef.current.abort();
    };
  }, [materialId]);

  useEffect(() => {
    if (isLoggedIn) {
      loadUserBalance();
    } else {
      setCurrentBalance(0);
    }
  }, [isLoggedIn]);

  const cardBorder = isDarkMode ? "#282B34" : "#E2E8F0";
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
  // Android's WebView treats a raw .pdf URL as a download and drops the file in
  // the device's Downloads folder, so there the PDF is shown through an
  // embedded viewer page instead. iOS renders PDFs natively.
  const pdfViewerUrl = isPdf && directPreviewUrl && (material?.is_free || material?.is_purchased)
    ? Platform.OS === "android"
      ? `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(directPreviewUrl)}`
      : directPreviewUrl
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
      const fileUri = `${FileSystem.cacheDirectory}${materialId}-${safeName}`;

      // Re-download from scratch: iOS fails when a file already sits at the
      // destination. The file lives in the app cache, not the Downloads folder.
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

      Toast.show({ type: "info", text1: t("studyMaterial.downloadStarted"), text2: material?.title });
      setDownloadPercent(0);

      const resumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: "application/octet-stream",
          },
        },
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDownloadPercent(Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100));
          }
        }
      );
      const result = await resumable.downloadAsync();

      console.log("[Download] downloadAsync result", { status: result?.status, uri: result?.uri });

      if (result?.status === 200) {
        if (Platform.OS === "ios") {
          // iOS sandboxes documentDirectory — a file saved there is invisible
          // to the user unless it's routed through the share sheet (or the
          // app declares file-sharing entitlements). Treat the share step as
          // the actual delivery of the file, not a best-effort extra: report
          // failure to the user instead of silently swallowing it.
          try {
            const shareAvailable = await Sharing.isAvailableAsync();
            console.log("[Download] iOS Sharing.isAvailableAsync", shareAvailable);
            if (!shareAvailable) {
              Toast.show({
                type: "error",
                text1: t("studyMaterial.downloadError"),
                text2: t("studyMaterial.shareUnavailable", {
                  defaultValue: "Sharing isn't available on this device (Simulator doesn't support it).",
                }),
              });
              return;
            }

            await Sharing.shareAsync(result.uri, {
              dialogTitle: material?.title || t("studyMaterial.material"),
            });
            console.log("[Download] iOS share sheet presented");

            Toast.show({
              type: "success",
              text1: t("studyMaterial.downloadSuccess"),
              text2: t("studyMaterial.downloadSuccessHint"),
            });
          } catch (shareError) {
            console.error("[Download] iOS share sheet failed", shareError);
            Toast.show({
              type: "error",
              text1: t("studyMaterial.downloadError"),
              text2: shareError?.message || t("studyMaterial.tryAgain"),
            });
          }
        } else {
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
            console.warn("[Download] Android share sheet failed (non-fatal)", shareError);
          }
        }
      } else {
        console.warn("[Download] unexpected status", result?.status);
        Toast.show({ type: "error", text1: t("studyMaterial.downloadError"), text2: t("studyMaterial.invalidFile") });
      }
    } catch (error) {
      console.error("[Download] failed", { code: error?.code, message: error?.message, error });
      Toast.show({
        type: "error",
        text1: t("studyMaterial.downloadError"),
        text2: error?.message || t("studyMaterial.tryAgain"),
      });
    } finally {
      setProcessing(false);
      setDownloadPercent(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FloatingScreenHeader title={t("studyMaterial.detailTitle")} onBack={() => navigation.goBack()} scrollY={scrollY} />

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
        <AndroidGlassBackdrop providerId="StudyMaterialDetailScreen" style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={{ paddingTop: 64 + insets.top, paddingBottom: 40 + insets.bottom }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
          >
            <BannerWatermark icon="document-text" size={140} />
            <View style={[styles.badge, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
              <Ionicons name="pricetag" size={11} color={theme.primary} style={{ marginRight: 5 }} />
              <Text style={[styles.badgeText, { color: theme.primary }]}>{material?.category?.name ? getCategoryLabel(material.category) : t("studyMaterial.material")}</Text>
            </View>
            <Text style={[styles.titleText, { color: theme.text }]}>{material.title}</Text>
            <Text style={[styles.descriptionText, { color: theme.subText }]}>{material.description || t("studyMaterial.noDescription")}</Text>
            <View style={styles.chipsRow}>
              <View style={[styles.heroChip, { backgroundColor: tint("#F59E0B", isDarkMode) }]}>
                <Ionicons name="wallet-outline" size={14} color="#F59E0B" />
                <Text style={[styles.heroChipText, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>{priceLabel}</Text>
              </View>
              <View style={[styles.heroChip, { backgroundColor: tint("#F59E0B", isDarkMode) }]}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.heroChipText, { color: isDarkMode ? "#FBBF24" : "#B45309" }]}>{material.average_rating || 0}/5</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.infoCard, { borderColor: cardBorder, backgroundColor: theme.surface }]}>
            <CardTitle icon="information-circle" color="#3B82F6" title={t("studyMaterial.details")} theme={theme} isDarkMode={isDarkMode} />
            <InfoLine icon="person" color="#3B82F6" theme={theme} isDarkMode={isDarkMode} border={cardBorder}
              text={t("studyMaterial.author", { value: material?.author?.profile_name || material?.author?.username || t("studyMaterial.member") })} />
            <InfoLine icon="download" color="#10B981" theme={theme} isDarkMode={isDarkMode} border={cardBorder}
              text={t("studyMaterial.downloadCount", { value: material.download_count || 0 })} />
            <InfoLine icon="eye" color="#8B5CF6" theme={theme} isDarkMode={isDarkMode} border={cardBorder}
              text={t("studyMaterial.viewCount", { value: material.view_count || 0 })} />
            <InfoLine icon="calendar" color="#F59E0B" last theme={theme} isDarkMode={isDarkMode} border={cardBorder}
              text={t("studyMaterial.createdAt", { value: new Date(material.created_at).toLocaleDateString({ vi: "vi-VN", en: "en-US", ru: "ru-RU" }[i18n.language?.split("-")[0]] || "vi-VN") })} />
          </View>

          <View style={styles.actionRow}>
            {!material.is_purchased && !material.is_free && material.price > 0 ? (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={() => setShowPurchaseModal(true)} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : (
                  <View style={styles.buttonRow}>
                    <Ionicons name="cart" size={18} color="#fff" />
                    <Text style={styles.buttonText}>{t("studyMaterial.buy")}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={handleDownload} disabled={processing}>
                {processing ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color="#fff" />
                    {downloadPercent != null ? <Text style={styles.buttonText}>{t("studyMaterial.downloading", { percent: downloadPercent })}</Text> : null}
                  </View>
                ) : (
                  <View style={styles.buttonRow}>
                    <Ionicons name="download" size={18} color="#fff" />
                    <Text style={styles.buttonText}>{t("studyMaterial.download")}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {pdfViewerUrl || officeViewerUrl ? (
            <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: cardBorder }]}>
              <CardTitle icon="eye" color="#0EA5E9" title={t("studyMaterial.preview")} theme={theme} isDarkMode={isDarkMode} />
              <View style={[styles.webviewContainer, { borderColor: cardBorder }]}>
                <WebView
                  source={{ uri: pdfViewerUrl || officeViewerUrl }}
                  style={styles.webview}
                  startInLoadingState
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={["*"]}
                  allowsBackForwardNavigationGestures={false}
                  // This box is a fixed 320px window onto a document that's
                  // almost always taller - it needs its own internal scroll
                  // to see the rest of it. scrollEnabled/nestedScrollEnabled
                  // were both false, which killed that entirely: nothing
                  // inside this WebView could ever scroll. nestedScrollEnabled
                  // (Android) lets it properly hand the gesture off to/from
                  // the surrounding page ScrollView instead of one blocking
                  // the other.
                  scrollEnabled
                  nestedScrollEnabled
                />
              </View>
            </View>
          ) : material?.preview_path ? (
            <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: cardBorder }]}>
              <CardTitle icon="eye" color="#0EA5E9" title={t("studyMaterial.preview")} theme={theme} isDarkMode={isDarkMode} />
              <View style={[styles.webviewContainer, { borderColor: theme.border, height: 320, backgroundColor: isDarkMode ? "#18181B" : "#F3F4F6", overflow: "hidden" }]}>
                <FastImage
                  source={{ uri: material.preview_path.startsWith("http") ? material.preview_path : `https://api.chuyenbienhoa.com/storage/${material.preview_path.replace(/^\/+/, "")}` }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              </View>
            </View>
          ) : null}

          {material.preview_content ? (
            <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: cardBorder }]}>
              <CardTitle icon="reader" color="#8B5CF6" title={t("studyMaterial.summary")} theme={theme} isDarkMode={isDarkMode} />
              <Text style={[styles.previewText, { color: theme.subText }]}>{material.preview_content}</Text>
            </View>
          ) : null}

          <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: cardBorder }]}>
            <CardTitle icon="star" color="#F59E0B" title={t("studyMaterial.reviews")} theme={theme} isDarkMode={isDarkMode} />
            <Text style={[styles.helperText, { color: theme.subText }]}>{t("studyMaterial.reviewHint")}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingValue(star)} disabled={submittingRate}>
                  <Ionicons name={star <= ratingValue ? "star" : "star-outline"} size={28} color="#f59e0b" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: cardBorder, backgroundColor: theme.background }]}
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
            <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: cardBorder }]}>
              <CardTitle icon="chatbubbles" color="#EC4899" title={t("studyMaterial.communityReviews")} theme={theme} isDarkMode={isDarkMode} />
              {ratings.map((item) => {
                const avatarUrl = item?.user?.username
                  ? `${axiosInstance.defaults.baseURL?.replace(/\/$/, "")}/v1.0/users/${item.user.username}/avatar`
                  : null;

                return (
                  <View key={item.id} style={[styles.ratingItem, { borderTopColor: cardBorder }]}>
                    <View style={styles.ratingHeader}>
                      <View style={styles.ratingUserRow}>
                        {avatarUrl ? (
                          <FastImage source={{ uri: avatarUrl }} style={styles.avatar} />
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
              {ratingsHasMore ? (
                <TouchableOpacity
                  onPress={loadMoreRatings}
                  disabled={loadingMoreRatings}
                  style={{ paddingVertical: 12, alignItems: "center" }}
                >
                  {loadingMoreRatings ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 13 }}>
                      {t("profile.loadMorePosts", "Tải thêm")}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </Animated.ScrollView>
        </AndroidGlassBackdrop>
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
    zIndex: 100,
    elevation: 10,
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
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    overflow: "hidden",
  },
  chipsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroChipText: { fontSize: 13, fontWeight: "700" },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  titleText: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  descriptionText: { fontSize: 14, lineHeight: 21 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  metaText: { fontSize: 13, fontWeight: "700" },
  infoCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  previewCard: {
    margin: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 24,
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
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalSecondaryText: { fontWeight: "600" },
  modalPrimaryButton: {
    borderRadius: 999,
    paddingHorizontal: 18,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    marginBottom: 12,
  },
  rateButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  webviewContainer: {
    height: 320,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: "#fff",
  },
  ratingItem: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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
