import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  StyleSheet,
  TouchableHighlight,
  Keyboard,
  Platform,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  BackHandler,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Slider from "@react-native-community/slider";
import { captureRef } from "react-native-view-shot";
import { createStory } from "../../../services/api/Api";
import { useTranslation } from "react-i18next";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { compressVideoForUpload } from "../../../utils/mediaCompression";
import { startUpload, STORY_POSTED_EVENT } from "../../../services/uploadQueue";
import Video from "react-native-video";
import { useTheme } from "../../../contexts/ThemeContext";
import { useStatusBarStyle } from "../../../hooks/useStatusBarUpdate";
import LiquidButton from "../../../components/LiquidButton";
import { AndroidGlassBackdrop } from "../../../components/GlassModules";
import BannerWatermark from "../../../components/BannerWatermark";
import { tint } from "../../../components/settings/SettingsUI";
import DrawingCanvas from "./DrawingCanvas";
import MoveableItem from "./MoveableItem";
import PinchableStoryImage from "./PinchableStoryImage";
import TextEditorOverlay from "./TextEditorOverlay";
import FilterCarousel from "./FilterCarousel";
import StickerSheet from "./StickerSheet";
import MentionSheet from "./MentionSheet";
import LinkSheet from "./LinkSheet";
import MusicSheet from "./MusicSheet";
import { StoryOverlayItemContent } from "../../../components/StoryOverlays/StoryOverlayLayer";
import StoryFilterTint from "../../../components/StoryOverlays/StoryFilterTint";
import StoryMusicPlayer from "../../../components/StoryOverlays/StoryMusicPlayer";
import {
  OVERLAY_TYPES,
  getContainedCanvasSize,
  normalizeOverlayItem,
} from "../../../components/StoryOverlays/storyOverlayModel";
import { bakeFilterIntoImage, getStoryFilter } from "../../../components/StoryOverlays/storyFilters";
import { toStoryMusicPayload, STORY_MUSIC_CLIP_MS } from "../../../services/musicSearch";

const { width } = Dimensions.get("window");

const GRADIENTS = [
  { colors: ["#FF6B6B", "#4ECDC4"], nameKey: "sunset" },
  { colors: ["#8E2DE2", "#4A00E0"], nameKey: "royalIndigo" },
  { colors: ["#FF416C", "#FF4B2B"], nameKey: "crimsonAlert" },
  { colors: ["#11998E", "#38EF7D"], nameKey: "emeraldAurora" },
  { colors: ["#0F2027", "#203A43", "#2C5364"], nameKey: "obsidianNight" },
  { colors: ["#F9D423", "#FF4E50"], nameKey: "goldenHour" },
  { colors: ["#00c6ff", "#0072ff"], nameKey: "skyBlue" },
];

const DRAWING_COLORS = [
  "#FFFFFF",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
];

const ColorPicker = ({ strokeColor, setStrokeColor }) => (
  <View style={styles.colorPicker} pointerEvents="box-none">
    {DRAWING_COLORS.map((color) => (
      <TouchableOpacity
        key={color}
        style={[
          styles.colorButton,
          { backgroundColor: color },
          strokeColor === color && styles.selectedColor,
        ]}
        onPress={() => setStrokeColor(color)}
      />
    ))}
  </View>
);

const BrushSizePicker = ({ strokeWidth, setStrokeWidth, showBrushSize, t }) => {
  const [sliderValue, setSliderValue] = useState(strokeWidth);

  useEffect(() => {
    setSliderValue(strokeWidth);
  }, [strokeWidth]);

  if (!showBrushSize) return null;

  return (
    <View style={styles.brushSizeSlider}>
      <Text style={styles.brushSizeLabel}>{t("story.brushSize", { size: sliderValue })}</Text>
      <Slider
        style={styles.slider}
        minimumValue={2}
        maximumValue={20}
        value={sliderValue}
        step={1}
        onValueChange={setSliderValue}
        onSlidingComplete={setStrokeWidth}
        minimumTrackTintColor="#FFFFFF"
        maximumTrackTintColor="rgba(255,255,255,0.3)"
        thumbStyle={styles.sliderThumb}
      />
    </View>
  );
};

const DrawingTools = ({ drawingRef, isEraser, setIsEraser, showBrushSize, setShowBrushSize }) => (
  <View style={styles.drawingTools}>
    <TouchableOpacity
      style={[styles.toolButton, !isEraser && styles.activeToolButton]}
      onPress={() => setIsEraser(false)}
    >
      <Ionicons name="brush" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.toolButton, isEraser && styles.activeToolButton]}
      onPress={() => setIsEraser(true)}
    >
      <Image source={require("../../../assets/eraser.png")} style={{ width: 24, height: 24 }} />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.toolButton, showBrushSize && styles.activeToolButton]}
      onPress={() => setShowBrushSize(!showBrushSize)}
    >
      <Ionicons name="resize" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolButton} onPress={() => drawingRef.current?.handleUndo()}>
      <Ionicons name="arrow-undo" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolButton} onPress={() => drawingRef.current?.handleClear()}>
      <Ionicons name="trash" size={24} color="#fff" />
    </TouchableOpacity>
  </View>
);

const TrashZone = memo(({ visible, isOver, t }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [visible, scaleAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.trashZone,
        {
          transform: [{ scale: scaleAnim }],
          backgroundColor: isOver ? "rgba(255,59,48,0.9)" : "rgba(0,0,0,0.6)",
        },
      ]}
    >
      <Ionicons name={isOver ? "trash" : "trash-outline"} size={isOver ? 36 : 28} color="#fff" />
      <Text style={[styles.trashZoneText, isOver && { fontWeight: "700" }]}>
        {isOver ? t("story.dropToDelete") : t("story.dragHereToDelete")}
      </Text>
    </Animated.View>
  );
});

/**
 * Editing toolbar down the right-hand side of the canvas, Instagram style.
 */
const ToolsBar = ({
  onAddText,
  onOpenStickers,
  onToggleDrawing,
  onToggleFilters,
  onOpenMusic,
  isDrawing,
  filtersVisible,
  hasMusic,
  selectedMediaType,
  isMuted,
  toggleMute,
  isTextOnly,
  onCycleGradient,
}) => (
  <View style={styles.toolsContainer}>
    <TouchableOpacity
      style={styles.toolButton}
      onPress={onAddText}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="text" size={22} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.toolButton}
      onPress={onOpenStickers}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="happy-outline" size={22} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.toolButton, hasMusic && styles.activeToolButton]}
      onPress={onOpenMusic}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="musical-notes" size={22} color={hasMusic ? "#4ADE80" : "#fff"} />
      {hasMusic && <View style={styles.activeDot} />}
    </TouchableOpacity>
    {!isTextOnly && (
      <>
        <TouchableOpacity
          style={[styles.toolButton, isDrawing && styles.activeToolButton]}
          onPress={onToggleDrawing}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="brush" size={22} color={isDrawing ? "#4ADE80" : "#fff"} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolButton, filtersVisible && styles.activeToolButton]}
          onPress={onToggleFilters}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="color-filter-outline" size={22} color={filtersVisible ? "#4ADE80" : "#fff"} />
        </TouchableOpacity>
      </>
    )}
    {isTextOnly && (
      <TouchableOpacity
        style={styles.toolButton}
        onPress={onCycleGradient}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="color-palette-outline" size={22} color="#fff" />
      </TouchableOpacity>
    )}
    {selectedMediaType === "video" && (
      <TouchableOpacity
        style={[styles.toolButton, isMuted && styles.activeToolButton]}
        onPress={toggleMute}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name={isMuted ? "volume-mute-outline" : "volume-high-outline"}
          size={22}
          color={isMuted ? "#EF4444" : "#fff"}
        />
      </TouchableOpacity>
    )}
  </View>
);

const CreateStoryScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Media
  const [originalImage, setOriginalImage] = useState(null);
  const [displayImage, setDisplayImage] = useState(null);
  const [selectedMediaType, setSelectedMediaType] = useState(null);
  const [selectedMediaAsset, setSelectedMediaAsset] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isTextOnly, setIsTextOnly] = useState(false);
  const [textBackground, setTextBackground] = useState(GRADIENTS[0].colors);

  const hasContent = Boolean(originalImage || isTextOnly);

  // Status bar: light text over black in editor mode, themed in picker mode
  useStatusBarStyle(
    hasContent ? "light-content" : (isDarkMode ? "light-content" : "dark-content"),
    hasContent ? "#000000" : theme.background
  );

  // Overlays
  const [items, setItems] = useState([]);
  const [editingText, setEditingText] = useState(null); // { id?, ...textProps }
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [music, setMusic] = useState(null);
  const [filterId, setFilterId] = useState("none");
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeSheet, setActiveSheet] = useState(null);

  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#FFFFFF");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [showBrushSize, setShowBrushSize] = useState(false);
  const [savedDrawingData, setSavedDrawingData] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  const [contentAreaHeight, setContentAreaHeight] = useState(0);

  const drawingRef = useRef(null);
  const imageWithOverlaysRef = useRef(null);
  const pinchableImageRef = useRef(null);
  const itemIdCounter = useRef(0);

  /**
   * The story canvas is always 9:16 - letterboxed inside whatever space the
   * screen leaves, so the editor shows exactly the frame that gets posted.
   */
  const captureDims = useMemo(() => {
    const extraTopPad = Platform.OS === "android" ? 4 : 0;
    const availableHeight = contentAreaHeight > 0 ? contentAreaHeight - extraTopPad : 0;
    const size = getContainedCanvasSize(width, availableHeight);

    return { w: size.width, h: size.height };
  }, [contentAreaHeight]);

  const isVideo = selectedMediaType === "video";

  /**
   * Size and position the photo on the 9:16 canvas like Instagram / Facebook:
   * - Portrait photos near 9:16 cover the canvas by default.
   * - Square / landscape photos fit across the canvas width so no part of the
   *   photo is cut off initially, while exposing `coverScale` so a double-tap
   *   or two-finger pinch can fill or shrink the frame freely.
   */
  const mediaLayout = useMemo(() => {
    const canvasWidth = captureDims.w;
    const canvasHeight = captureDims.h;

    if (!canvasWidth || !canvasHeight) return null;

    const assetWidth = selectedMediaAsset?.width;
    const assetHeight = selectedMediaAsset?.height;
    const aspect =
      assetWidth && assetHeight ? assetWidth / assetHeight : canvasWidth / canvasHeight;

    let mediaWidth = canvasWidth;
    let mediaHeight = canvasWidth / aspect;

    // Portrait photos close to 9:16 cover the frame; wider photos fit cleanly.
    if (aspect <= 0.65 && mediaHeight < canvasHeight) {
      mediaHeight = canvasHeight;
      mediaWidth = canvasHeight * aspect;
    }

    const coverScale =
      mediaHeight < canvasHeight
        ? canvasHeight / mediaHeight
        : mediaWidth < canvasWidth
        ? canvasWidth / mediaWidth
        : 1;

    return {
      style: {
        position: "absolute",
        left: (canvasWidth - mediaWidth) / 2,
        top: (canvasHeight - mediaHeight) / 2,
        width: mediaWidth,
        height: mediaHeight,
      },
      coverScale,
    };
  }, [captureDims.w, captureDims.h, selectedMediaAsset]);
  const mediaCoverStyle = mediaLayout?.style || null;

  /**
   * Photo filters are baked with Skia as soon as they are picked rather than
   * at share time: React Native's own `filter` style is behind a feature flag
   * on iOS, and baking keeps the preview and the upload identical.
   */
  useEffect(() => {
    let cancelled = false;

    if (!originalImage || isVideo) {
      return undefined;
    }

    const filter = getStoryFilter(filterId);

    if (!filter?.matrix) {
      setDisplayImage(originalImage);
      return undefined;
    }

    setIsApplyingFilter(true);

    bakeFilterIntoImage(originalImage, filterId)
      .then((uri) => {
        if (!cancelled) setDisplayImage(uri);
      })
      .finally(() => {
        if (!cancelled) setIsApplyingFilter(false);
      });

    return () => {
      cancelled = true;
    };
  }, [originalImage, filterId, isVideo]);

  // --- overlay items -------------------------------------------------------

  const nextItemId = () => `item_${itemIdCounter.current++}`;

  const addItem = useCallback((item) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const updateItemTransform = useCallback((id, transform) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...transform } : item))
    );
  }, []);

  const removeItem = useCallback(
    (id) => {
      // Dropping the music sticker is how you remove the soundtrack.
      if (items.find((item) => item.id === id)?.type === OVERLAY_TYPES.MUSIC) {
        setMusic(null);
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [items]
  );

  const handleItemDragStart = useCallback(() => {
    setIsDraggingItem(true);
    setIsOverTrash(false);
  }, []);

  const handleItemDragging = useCallback((moveY) => {
    setIsOverTrash(moveY > Dimensions.get("window").height * 0.82);
  }, []);

  const handleItemDragEnd = useCallback(
    (id, wasOverTrash) => {
      if (wasOverTrash) removeItem(id);
      setIsDraggingItem(false);
      setIsOverTrash(false);
    },
    [removeItem]
  );

  const handleItemTap = useCallback(
    (id) => {
      const target = items.find((item) => item.id === id);

      if (target?.type === OVERLAY_TYPES.TEXT) {
        setEditingText(target);
      }
    },
    [items]
  );

  const openTextEditor = useCallback(() => {
    setEditingText({
      id: null,
      text: "",
      color: "#FFFFFF",
      font: "classic",
      effect: "shadow",
      align: "center",
      fontSize: Math.round(captureDims.w * 0.09),
    });
  }, [captureDims.w]);

  const handleTextEditorDone = useCallback(
    (values) => {
      const editingId = editingText?.id;

      if (editingId) {
        setItems((prev) =>
          prev.map((item) => (item.id === editingId ? { ...item, ...values } : item))
        );
      } else {
        const boxWidth = captureDims.w * 0.86;

        addItem({
          id: nextItemId(),
          type: OVERLAY_TYPES.TEXT,
          x: (captureDims.w - boxWidth) / 2,
          y: captureDims.h * 0.4,
          scale: 1,
          rotation: 0,
          width: boxWidth,
          ...values,
        });
      }

      setEditingText(null);
    },
    [editingText, addItem, captureDims.w, captureDims.h]
  );

  const addSticker = useCallback(
    (emoji) => {
      const size = captureDims.w * 0.22;

      addItem({
        id: nextItemId(),
        type: OVERLAY_TYPES.STICKER,
        emoji,
        x: (captureDims.w - size) / 2,
        y: captureDims.h * 0.42,
        scale: 1,
        rotation: 0,
        width: size,
      });
      setActiveSheet(null);
    },
    [addItem, captureDims.w, captureDims.h]
  );

  const addMention = useCallback(
    (user) => {
      addItem({
        id: nextItemId(),
        type: OVERLAY_TYPES.MENTION,
        username: user.username,
        userId: user.id,
        style: "light",
        x: captureDims.w * 0.25,
        y: captureDims.h * 0.5,
        scale: 1,
        rotation: 0,
        width: captureDims.w * 0.5,
      });
      setActiveSheet(null);
    },
    [addItem, captureDims.w, captureDims.h]
  );

  const addLink = useCallback(
    ({ url, label }) => {
      addItem({
        id: nextItemId(),
        type: OVERLAY_TYPES.LINK,
        url,
        label,
        style: "light",
        x: captureDims.w * 0.2,
        y: captureDims.h * 0.62,
        scale: 1,
        rotation: 0,
        width: captureDims.w * 0.6,
      });
      setActiveSheet(null);
    },
    [addItem, captureDims.w, captureDims.h]
  );

  const addMusic = useCallback(
    (track) => {
      setMusic(track);

      // A video's own audio would fight the soundtrack, so mute it - the same
      // thing Instagram does when you add music to a video.
      if (selectedMediaType === "video") {
        setIsMuted(true);
      }

      setItems((prev) => {
        const withoutMusic = prev.filter((item) => item.type !== OVERLAY_TYPES.MUSIC);

        return [
          ...withoutMusic,
          {
            id: nextItemId(),
            type: OVERLAY_TYPES.MUSIC,
            title: track.title,
            artist: track.artist,
            artworkUrl: track.artworkUrl,
            style: "light",
            x: captureDims.w * 0.18,
            y: captureDims.h * 0.12,
            scale: 1,
            rotation: 0,
            width: captureDims.w * 0.64,
          },
        ];
      });
      setActiveSheet(null);
    },
    [captureDims.w, captureDims.h, selectedMediaType]
  );

  // --- media ---------------------------------------------------------------

  const applyPickedAsset = (asset) => {
    const mediaType = asset?.type === "video" ? "video" : "image";

    setSelectedMediaType(mediaType);
    setSelectedMediaAsset(asset);
    setOriginalImage(asset.uri);
    setDisplayImage(asset.uri);
    setFilterId("none");
    setIsMuted(false);

    // Reset pinch-zoom transform whenever a new image is loaded.
    pinchableImageRef.current?.reset();
  };

  /**
   * The picker does not always hand back the dimensions (and iOS' own editor
   * reports the pre-crop ones), so fall back to asking the image itself.
   */
  const resolveImageSize = (asset) =>
    new Promise((resolve) => {
      if (asset?.width && asset?.height) {
        resolve({ width: asset.width, height: asset.height });
        return;
      }

      if (!asset?.uri) {
        resolve(null);
        return;
      }

      Image.getSize(
        asset.uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null)
      );
    });

  /**
   * Resolve image dimensions without cropping so the user can freely pinch to
   * resize, zoom in/out, rotate, and reposition the full photo inside the 9:16
   * story canvas just like Instagram and Facebook.
   */
  const forceStoryAspect = async (asset) => {
    const size = await resolveImageSize(asset);

    if (!size?.width || !size?.height) return asset;

    return {
      ...asset,
      width: size.width,
      height: size.height,
    };
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
      // iOS exports video as 720p H.264 (ignored on Android).
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });

    if (result.canceled) return;

    let asset = result.assets?.[0];
    if (!asset?.uri) return;

    if (asset.type !== "video") {
      asset = await forceStoryAspect(asset);
    }

    applyPickedAsset(asset);
  };

  const handleCameraPress = async () => {
    const { status } = await ImagePicker.getCameraPermissionsAsync();

    if (status !== "granted") {
      const { status: newStatus } = await ImagePicker.requestCameraPermissionsAsync();

      if (newStatus !== "granted") {
        Toast.show({ type: "error", text1: t("story.cameraPermissionDenied") });
        return;
      }
    }

    const openCameraPicker = async (preferredType = "image") => {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:
          preferredType === "video"
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      });

      if (result.canceled) return;

      let asset = result.assets?.[0];
      if (!asset?.uri) return;

      if (asset.type !== "video") {
        asset = await forceStoryAspect(asset);
      }

      applyPickedAsset(asset);
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("story.takePhoto"), t("story.recordVideo"), t("common.cancel")],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) openCameraPicker("image");
          else if (buttonIndex === 1) openCameraPicker("video");
        }
      );
      return;
    }

    Alert.alert(t("story.chooseMedia"), t("story.chooseMediaDesc"), [
      { text: t("story.takePhoto"), onPress: () => openCameraPicker("image") },
      { text: t("story.recordVideo"), onPress: () => openCameraPicker("video") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const handleTextOnlyStory = () => {
    setOriginalImage(null);
    setDisplayImage(null);
    setSelectedMediaType(null);
    setSelectedMediaAsset(null);
    setIsMuted(false);
    setIsTextOnly(true);
    setFilterId("none");
    setTextBackground(GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)].colors);
    // Drop straight into the composer, like the "Create" tab does elsewhere.
    setTimeout(openTextEditor, 120);
  };

  const cycleGradient = () => {
    const currentIndex = GRADIENTS.findIndex(
      (gradient) => JSON.stringify(gradient.colors) === JSON.stringify(textBackground)
    );

    setTextBackground(GRADIENTS[(currentIndex + 1) % GRADIENTS.length].colors);
  };

  // --- drawing -------------------------------------------------------------

  const saveDrawing = async () => {
    try {
      const currentDrawingData = drawingRef.current?.getDrawingData?.();

      if (!currentDrawingData) {
        throw new Error(t("story.noDrawingData"));
      }

      const imageBase64 = await drawingRef.current?.makeImageSnapshot();

      if (!imageBase64) {
        throw new Error(t("story.captureDrawingError"));
      }

      setSavedDrawingData({
        ...currentDrawingData,
        imageBase64: `data:image/png;base64,${imageBase64}`,
      });

      Toast.show({
        type: "success",
        text1: t("story.drawingSaved"),
        text2: t("story.drawingUpdated"),
      });

      setIsDrawing(false);
      setShowBrushSize(false);
    } catch (error) {
      console.error("Error saving drawing:", error.message);
      Toast.show({
        type: "error",
        text1: t("story.saveDrawingError"),
        text2: t("story.saveDrawingErrorDesc"),
      });
    }
  };

  // --- upload --------------------------------------------------------------

  const onViewLayout = useCallback(() => setViewReady(true), []);

  const captureImageWithOverlays = useCallback(async () => {
    if (!imageWithOverlaysRef.current || !viewReady) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!imageWithOverlaysRef.current) {
        throw new Error("Image reference still not available after waiting");
      }
    }

    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    return captureRef(imageWithOverlaysRef.current, {
      format: "jpg",
      // This file is the upload: 0.9 keeps text overlays crisp at a fraction
      // of the size of a maximum-quality JPEG.
      quality: 0.9,
      result: "file",
    });
  }, [viewReady]);

  const buildOverlaysPayload = useCallback(
    (flattened) => {
      const normalized = items.map((item) =>
        normalizeOverlayItem(item, captureDims.w, captureDims.h)
      );

      if (!normalized.length && filterId === "none") return null;

      return {
        version: 1,
        flattened,
        filter: filterId,
        items: normalized,
      };
    },
    [items, captureDims.w, captureDims.h, filterId]
  );

  const uploadStory = async () => {
    const textItems = items.filter((item) => item.type === OVERLAY_TYPES.TEXT);

    if (isTextOnly && textItems.length === 0) {
      Toast.show({
        type: "error",
        text1: t("common.error"),
        text2: t("story.emptyTextError"),
      });
      return;
    }

    // Only the snapshot of the canvas needs this screen. Compressing and
    // uploading then run in the background (services/uploadQueue): the
    // editor closes and the upload bar / notification report the progress.
    let mediaUri = null;
    let overlays = null;
    try {
      setIsUploading(true);

      if (isVideo) {
        mediaUri = originalImage;
      } else {
        // Freeze the canvas exactly as it looks before snapshotting it.
        Keyboard.dismiss();
        setEditingText(null);
        setShowFilters(false);
        await new Promise((resolve) => setTimeout(resolve, 150));

        mediaUri = await captureImageWithOverlays();

        if (!mediaUri) {
          throw new Error("Failed to capture story content");
        }
      }

      // Overlays are always sent: for photos they only carry the tap targets
      // for mentions/links (the look is already flattened into the picture),
      // for videos they are what the viewer draws on top.
      overlays = buildOverlaysPayload(!isVideo);
    } catch (error) {
      console.error("[CreateStory] failed to prepare story", { message: error?.message });
      Toast.show({
        type: "error",
        text1: t("story.postError"),
        text2: t("story.postErrorDesc"),
      });
      return;
    } finally {
      setIsUploading(false);
    }

    // Read once, so the task (and a retry of it) doesn't depend on this
    // screen's state.
    const story = {
      mediaUri,
      overlays,
      isVideo,
      isTextOnly,
      isMuted,
      music,
      textBackground,
      asset: selectedMediaAsset,
      contentText: textItems
        .map((item) => item.text)
        .join("\n")
        .trim(),
    };

    startUpload({
      kind: "story",
      task: async (report) => {
        const formData = new FormData();

        if (story.contentText) {
          formData.append("content", story.contentText);
        }

        if (story.isVideo) {
          // Compressed on the device to 720p H.264 (the API no longer does
          // it): first half of the bar, the upload is the second half.
          report("compressingVideo", { progress: 0 });
          const compressed = await compressVideoForUpload(story.mediaUri, (ratio) =>
            report.progress("compressingVideo", { progress: ratio * 0.5 }),
          );
          const storyFile = {
            uri: compressed.uri,
            // The compressor always writes an MP4.
            type: compressed.compressed ? "video/mp4" : story.asset?.mimeType || "video/mp4",
            name: compressed.compressed ? "story_video.mp4" : story.asset?.fileName || "story_video.mp4",
          };

          formData.append("media_type", "video");
          formData.append("media_file", storyFile);
          formData.append("file", storyFile);
          formData.append("is_muted", story.isMuted ? "true" : "false");
        } else {
          const storyFile = {
            uri: story.mediaUri,
            type: "image/jpeg",
            name: story.isTextOnly ? "story_text.jpg" : "story_image.jpg",
          };

          formData.append("media_type", story.isTextOnly ? "text" : "image");
          formData.append("media_file", storyFile);
          formData.append("file", storyFile);

          if (story.isTextOnly && story.textBackground?.length >= 2) {
            formData.append("background_color", JSON.stringify(story.textBackground));
          }

          // Give a photo long enough on screen for its soundtrack to be worth
          // playing, instead of the default 10 seconds.
          if (story.music) {
            formData.append("duration", String(Math.round(STORY_MUSIC_CLIP_MS / 1000)));
          }
        }

        if (story.overlays) {
          formData.append("overlays", JSON.stringify(story.overlays));
        }

        if (story.music) {
          formData.append("music", JSON.stringify(toStoryMusicPayload(story.music)));
        }

        formData.append("privacy", "public");

        const base = story.isVideo ? 0.5 : 0;
        const stage = story.isVideo ? "uploadingVideo" : "uploading";
        report(stage, { progress: base });
        try {
          const response = await createStory(formData, {
            onUploadProgress: (progressEvent) => {
              if (!progressEvent.total) return;
              report.progress(stage, {
                progress: base + (progressEvent.loaded / progressEvent.total) * (1 - base),
              });
            },
          });

          // A story with a photo or video waits for a moderator before
          // anyone else sees it - say so, or its author wonders why nobody
          // has viewed it.
          if (response?.data?.moderation?.status === "pending") {
            Toast.show({
              type: "info",
              text1: t("story.pendingReviewTitle"),
              text2: t("story.pendingReviewBody"),
              visibilityTime: 6000,
            });
          }
        } catch (error) {
          // Refused by moderation: our own words (not the API's), and no
          // "retry" - the same story would be refused again.
          if (
            error?.response?.status === 422 &&
            error.response.data?.moderation?.status === "rejected"
          ) {
            const refused = new Error("story rejected by moderation");
            refused.userMessage = t("story.rejectedBody");
            refused.noRetry = true;
            throw refused;
          }
          console.error("[CreateStory] failed to post story", {
            message: error?.message,
            status: error?.response?.status,
            data: error?.response?.data,
          });
          throw error;
        }

        // The home screen reloads its story row (it may not be mounted the
        // same way it was when the editor closed, so no navigation here).
        DeviceEventEmitter.emit(STORY_POSTED_EVENT);
      },
    });

    navigation.reset({
      index: 0,
      routes: [
        {
          name: "MainScreens",
          params: { screen: "Home" },
        },
      ],
    });
  };

  // --- exit ----------------------------------------------------------------

  const resetEditor = (type) => {
    if (type === "drawing") {
      setIsDrawing(false);
      return;
    }

    setOriginalImage(null);
    setDisplayImage(null);
    setSelectedMediaType(null);
    setSelectedMediaAsset(null);
    setIsMuted(false);
    setIsTextOnly(false);
    setItems([]);
    setEditingText(null);
    setMusic(null);
    setFilterId("none");
    setSavedDrawingData(null);
    setShowFilters(false);
  };

  const handleExitIOS = (type) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          type === "drawing" ? t("story.discardDrawing") : t("story.discardStory"),
          t("story.continueEditing"),
        ],
        destructiveButtonIndex: 0,
        userInterfaceStyle: "dark",
      },
      (buttonIndex) => {
        if (buttonIndex === 0) resetEditor(type);
      }
    );
  };

  const handleExitAndroid = (type) => {
    Alert.alert(t("story.exitConfirm"), t("story.exitConfirmDesc"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("story.exit"), onPress: () => resetEditor(type) },
    ]);
  };

  const handleBackPress = useCallback(() => {
    if (isDrawing) {
      Platform.OS === "ios" ? handleExitIOS("drawing") : handleExitAndroid("drawing");
    } else if (hasContent) {
      Platform.OS === "ios" ? handleExitIOS("content") : handleExitAndroid("content");
    } else {
      navigation.goBack();
    }
  }, [isDrawing, hasContent, navigation, t]);

  useEffect(() => {
    const onHardwareBackPress = () => {
      handleBackPress();
      return true;
    };

    const backHandlerSub = BackHandler.addEventListener(
      "hardwareBackPress",
      onHardwareBackPress
    );

    return () => backHandlerSub.remove();
  }, [handleBackPress]);

  const headerRightButton = (
    <TouchableOpacity
      style={{ position: "absolute", right: 10 }}
      onPress={() => (isDrawing ? saveDrawing() : uploadStory())}
      disabled={!hasContent || isUploading}
    >
      <Text
        style={{
          color: hasContent && !isUploading ? theme.primary : `${theme.primary}80`,
        }}
        className="text-base font-semibold"
      >
        {isDrawing ? t("story.done") : isUploading ? t("story.posting") : t("story.share")}
      </Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: hasContent ? "#000" : theme.background }}>
        {/* Top Header */}
        {hasContent ? (
          <View
            style={{
              paddingTop: insets.top,
              height: 56 + insets.top,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          >
            <TouchableOpacity
              style={styles.headerCloseButton}
              onPress={handleBackPress}
              disabled={isUploading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenterPill}>
              <Text style={styles.headerCenterText}>
                {isDrawing
                  ? t("story.draw")
                  : isTextOnly
                  ? t("story.textContent")
                  : t("story.edit")}
              </Text>
            </View>

            {isDrawing ? (
              <TouchableOpacity
                style={[
                  styles.headerActionPill,
                  { backgroundColor: "rgba(255,255,255,0.2)" }
                ]}
                onPress={saveDrawing}
              >
                <Text style={styles.headerActionText}>{t("story.done")}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
        ) : null}

        {hasContent ? (
          <View style={{ flex: 1 }}>
            <View
              style={{ flex: 1 }}
              onLayout={(event) => setContentAreaHeight(event.nativeEvent.layout.height)}
            >
              <View style={styles.aspectRatioContainer}>
                {/* The snapshot is taken of this plain, exactly-sized View.
                    A ScrollView cannot be the capture target: React Native
                    gives it flexGrow, so it silently stretched to fill the
                    screen and the posted picture came out taller than 9:16
                    with a black band underneath - which then pulled every
                    tap target in the viewer out from under its sticker. */}
                <View
                  ref={imageWithOverlaysRef}
                  collapsable={false}
                  onLayout={onViewLayout}
                  style={{
                    width: captureDims.w,
                    height: captureDims.h,
                    overflow: "hidden",
                    backgroundColor: "#000",
                  }}
                >
                <ScrollView
                  style={{
                    width: captureDims.w,
                    height: captureDims.h,
                    flexGrow: 0,
                    flexShrink: 0,
                    backgroundColor: "#000",
                  }}
                  scrollEnabled={false}
                  contentContainerStyle={{ width: captureDims.w, height: captureDims.h }}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                >
                  {isTextOnly ? (
                    <LinearGradient
                      colors={textBackground}
                      style={[StyleSheet.absoluteFill, styles.gradientContainer]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  ) : isVideo ? (
                    <View style={[StyleSheet.absoluteFill, styles.mediaPreviewContainer]}>
                      <Video
                        source={{ uri: originalImage }}
                        style={styles.videoPreview}
                        // Videos are uploaded untouched, so preview them the
                        // way the viewer shows them: letterboxed inside the
                        // 9:16 frame rather than cropped to fill it.
                        resizeMode="contain"
                        repeat
                        paused={false}
                        muted={isMuted}
                      />
                      <StoryFilterTint filterId={filterId} />
                    </View>
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.mediaPreviewContainer]}>
                      <PinchableStoryImage
                        ref={pinchableImageRef}
                        uri={displayImage || originalImage}
                        baseStyle={mediaCoverStyle || StyleSheet.absoluteFill}
                        coverScale={mediaLayout?.coverScale || 1}
                        canvasWidth={captureDims.w}
                        canvasHeight={captureDims.h}
                        disabled={Boolean(isDrawing || editingText)}
                      />
                    </View>
                  )}

                  {savedDrawingData && !isDrawing && (
                    <Image
                      source={{ uri: savedDrawingData.imageBase64 }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  )}

                  {isDrawing && (
                    <DrawingCanvas
                      ref={drawingRef}
                      color={strokeColor}
                      strokeWidth={strokeWidth}
                      isEraser={isEraser}
                      savedDrawingData={savedDrawingData}
                      width={captureDims.w}
                      height={captureDims.h}
                    />
                  )}

                  {!isDrawing &&
                    items
                      // The item being edited lives in the text composer
                      // instead, so it is not drawn twice.
                      .filter((item) => item.id !== editingText?.id)
                      .map((item) => (
                      <MoveableItem
                        key={item.id}
                        item={item}
                        onChange={updateItemTransform}
                        onTap={handleItemTap}
                        onDragStart={handleItemDragStart}
                        onDragging={handleItemDragging}
                        onDragEnd={handleItemDragEnd}
                        disabled={Boolean(editingText)}
                      >
                        <StoryOverlayItemContent item={item} canvasWidth={captureDims.w} />
                      </MoveableItem>
                    ))}
                </ScrollView>
                </View>

                {isApplyingFilter && (
                  <View style={styles.filterLoading} pointerEvents="none">
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </View>

              {isDrawing ? (
                <View style={styles.overlayTools} pointerEvents="box-none">
                  <ColorPicker strokeColor={strokeColor} setStrokeColor={setStrokeColor} />
                  <BrushSizePicker
                    strokeWidth={strokeWidth}
                    setStrokeWidth={setStrokeWidth}
                    showBrushSize={showBrushSize}
                    t={t}
                  />
                  <DrawingTools
                    drawingRef={drawingRef}
                    isEraser={isEraser}
                    setIsEraser={setIsEraser}
                    showBrushSize={showBrushSize}
                    setShowBrushSize={setShowBrushSize}
                  />
                </View>
              ) : editingText ? null : (
                <>
                  <ToolsBar
                    onAddText={openTextEditor}
                    onOpenStickers={() => setActiveSheet("sticker")}
                    onToggleDrawing={() => setIsDrawing(true)}
                    onToggleFilters={() => setShowFilters((prev) => !prev)}
                    onOpenMusic={() => setActiveSheet("music")}
                    isDrawing={isDrawing}
                    filtersVisible={showFilters}
                    hasMusic={Boolean(music)}
                    selectedMediaType={selectedMediaType}
                    isMuted={isMuted}
                    toggleMute={() => setIsMuted((prev) => !prev)}
                    isTextOnly={isTextOnly}
                    onCycleGradient={cycleGradient}
                  />

                  {showFilters && !isTextOnly && (
                    <FilterCarousel
                      mediaUri={originalImage}
                      isVideo={isVideo}
                      selectedFilter={filterId}
                      onSelect={setFilterId}
                    />
                  )}

                  <TrashZone visible={isDraggingItem} isOver={isOverTrash} t={t} />
                </>
              )}
            </View>

            {/* Bottom Share Button (Non-overlapping footer) */}
            {!isDrawing && !showFilters && !isDraggingItem && (
              <View
                style={[
                  styles.bottomActionBar,
                  { paddingBottom: Math.max(insets.bottom, 12) }
                ]}
                pointerEvents="box-none"
              >
                <TouchableOpacity
                  style={[styles.bottomShareButton, { backgroundColor: theme.primary }]}
                  onPress={uploadStory}
                  disabled={isUploading}
                  activeOpacity={0.85}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.bottomShareText}>{t("story.shareStory")}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View
            style={{ flex: 1 }}
            onLayout={(event) => setContentAreaHeight(event.nativeEvent.layout.height)}
          >
            <LinearGradient
              colors={
                isDarkMode
                  ? ["rgba(20, 83, 45, 0.40)", "rgba(15, 23, 42, 0)"]
                  : ["#E8F8EA", "rgba(240, 253, 244, 0.35)", "transparent"]
              }
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 140 }}
              pointerEvents="none"
            />
            <AndroidGlassBackdrop style={{ flex: 1 }}>
            <Animated.ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: insets.top + (Platform.OS === "ios" ? 4 : 8),
                paddingBottom: insets.bottom + 28,
              }}
              showsVerticalScrollIndicator={false}
            >
              {/* Top header, same as the Home feed: round tinted button, big
                  green title with the sparkle, grey subtitle, and the frog
                  mascot on the right. */}
              <View style={styles.pickerHeaderRow}>
                <TouchableOpacity
                  style={[
                    styles.pickerHeaderButton,
                    { backgroundColor: isDarkMode ? "rgba(34, 197, 94, 0.16)" : "rgba(34, 197, 94, 0.12)" },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.back", "Quay lại")}
                >
                  <Ionicons name="chevron-back" size={22} color={isDarkMode ? "#4ADE80" : "#15803D"} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={[styles.pickerBrandTitle, { color: isDarkMode ? "#4ADE80" : "#15803D" }]} numberOfLines={1}>
                      {t("story.createStory")}
                    </Text>
                    <Text style={styles.pickerSparkle}>✦</Text>
                  </View>
                  <Text style={[styles.pickerBrandSubtitle, { color: isDarkMode ? "#9CA3AF" : "#6B7280" }]} numberOfLines={1}>
                    {t("story.heroHours")}
                  </Text>
                </View>
                <Image source={require("../../../assets/logo.png")} style={styles.pickerMascot} resizeMode="contain" />
              </View>

              {/* Header Hero Banner */}
              <LinearGradient
                colors={isDarkMode ? ["#133321", "#0E2418"] : ["#EAF8EC", "#E0F5E3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.heroBanner, { borderColor: isDarkMode ? "#1B472C" : "#D5EBD7" }]}
              >
                <BannerWatermark icon="images" size={150} />
                <View style={[styles.heroBadge, { backgroundColor: tint("#22C55E", isDarkMode) }]}>
                  <Ionicons name="sparkles" size={13} color={theme.primary} />
                  <Text style={[styles.heroBadgeText, { color: theme.primary }]}>
                    {t("story.heroHours")}
                  </Text>
                </View>
                <Text style={[styles.heroTitle, { color: theme.text }]}>
                  {t("story.createStory")}
                </Text>
                <Text style={[styles.heroSubtitle, { color: theme.subText }]}>
                  {t("story.heroSubtitle")}
                </Text>
              </LinearGradient>

              {/* 3 Creation Mode Cards */}
              <Text style={[styles.sectionHeading, { color: theme.subText }]}>
                {t("story.selectCreationMode")}
              </Text>

              {/* 1. Gallery Pick (Featured) */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                  }
                ]}
                onPress={pickImage}
              >
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  style={styles.modeIconCircle}
                >
                  <Ionicons name="images" size={26} color="#fff" />
                </LinearGradient>
                <View style={styles.modeCardBody}>
                  <View style={styles.modeCardTitleRow}>
                    <Text style={[styles.modeCardTitle, { color: theme.text }]}>
                      {t("story.galleryTitle")}
                    </Text>
                    <View style={[styles.popularBadge, { backgroundColor: isDarkMode ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.12)" }]}>
                      <Text style={[styles.popularBadgeText, { color: "#10B981" }]}>
                        {t("story.popularBadge")}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: theme.subText }]}>
                    {t("story.gallerySubtitle")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.subText} />
              </TouchableOpacity>

              {/* 2. Camera Card */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                  }
                ]}
                onPress={handleCameraPress}
              >
                <LinearGradient
                  colors={["#3B82F6", "#2563EB"]}
                  style={styles.modeIconCircle}
                >
                  <Ionicons name="camera" size={26} color="#fff" />
                </LinearGradient>
                <View style={styles.modeCardBody}>
                  <Text style={[styles.modeCardTitle, { color: theme.text }]}>
                    {t("story.cameraTitle")}
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: theme.subText }]}>
                    {t("story.cameraSubtitle")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.subText} />
              </TouchableOpacity>

              {/* 3. Text Story Card */}
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isDarkMode ? "#282B34" : "#E2E8F0",
                  }
                ]}
                onPress={handleTextOnlyStory}
              >
                <LinearGradient
                  colors={GRADIENTS[0].colors}
                  style={styles.modeIconCircle}
                >
                  <Ionicons name="text" size={26} color="#fff" />
                </LinearGradient>
                <View style={styles.modeCardBody}>
                  <Text style={[styles.modeCardTitle, { color: theme.text }]}>
                    {t("story.textStoryTitle")}
                  </Text>
                  <Text style={[styles.modeCardDesc, { color: theme.subText }]}>
                    {t("story.textStorySubtitle")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.subText} />
              </TouchableOpacity>

              {/* Feature Highlights Grid */}
              <View style={[styles.featureBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.featureBoxHeader}>
                  <Ionicons name="color-palette-outline" size={17} color={theme.primary} />
                  <Text style={[styles.featureBoxTitle, { color: theme.text }]}>
                    {t("story.creativeTools")}
                  </Text>
                </View>
                <Text style={[styles.featureBoxDesc, { color: theme.subText }]}>
                  {t("story.creativeToolsDesc")}
                </Text>
                <View style={styles.featureGrid}>
                  <View style={styles.featureRow}>
                    {[
                      { icon: "musical-notes", label: t("story.featMusic"), color: "#EC4899" },
                      { icon: "color-filter", label: t("story.featFilters"), color: "#8B5CF6" },
                    ].map((feat, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.featureChip,
                          {
                            backgroundColor: tint(feat.color, isDarkMode),
                            borderColor: "transparent",
                          }
                        ]}
                      >
                        <Ionicons name={feat.icon} size={15} color={feat.color} />
                        <Text numberOfLines={1} style={[styles.featureChipText, { color: theme.text }]}>
                          {feat.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.featureRow}>
                    {[
                      { icon: "brush", label: t("story.featDrawing"), color: "#F59E0B" },
                      { icon: "happy", label: t("story.featStickers"), color: "#06B6D4" },
                    ].map((feat, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.featureChip,
                          {
                            backgroundColor: tint(feat.color, isDarkMode),
                            borderColor: "transparent",
                          }
                        ]}
                      >
                        <Ionicons name={feat.icon} size={15} color={feat.color} />
                        <Text numberOfLines={1} style={[styles.featureChipText, { color: theme.text }]}>
                          {feat.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.ScrollView>
            </AndroidGlassBackdrop>
          </View>
        )}

        {/* Hear the chosen track while composing, the way it will play in the
            story - paused while a picker is open on top of the canvas. */}
        <StoryMusicPlayer music={music} paused={Boolean(activeSheet) || isUploading} />

        {!!editingText && (
          <TextEditorOverlay
            item={editingText}
            canvasWidth={captureDims.w}
            onCancel={() => setEditingText(null)}
            onDone={handleTextEditorDone}
          />
        )}

        <StickerSheet
          visible={activeSheet === "sticker"}
          onClose={() => setActiveSheet(null)}
          onPickEmoji={addSticker}
          onRequestMention={() => setActiveSheet("mention")}
          onRequestLink={() => setActiveSheet("link")}
          onRequestMusic={() => setActiveSheet("music")}
        />
        <MentionSheet
          visible={activeSheet === "mention"}
          onClose={() => setActiveSheet(null)}
          onSelect={addMention}
        />
        <LinkSheet
          visible={activeSheet === "link"}
          onClose={() => setActiveSheet(null)}
          onSubmit={addLink}
        />
        <MusicSheet
          visible={activeSheet === "music"}
          onClose={() => setActiveSheet(null)}
          onSelect={addMusic}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  // Initial Picker Screen Styles
  pickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
  },
  pickerHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBrandTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
  pickerSparkle: { fontSize: 16, color: "#EAB308", marginLeft: 4, marginTop: -8 },
  pickerBrandSubtitle: { fontSize: 12.5, fontWeight: "500", marginTop: 1 },
  pickerMascot: { width: 40, height: 40, marginLeft: 8 },
  heroBanner: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  modeCardBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  modeCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  modeCardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  modeCardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  popularBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  featureBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  featureBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  featureBoxTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  featureBoxDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  featureGrid: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    gap: 8,
  },
  featureChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  featureChipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },

  // Header Back Button (Initial Screen)
  headerBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  // Editor Top Header Styles
  headerCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerCenterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  headerActionPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  // Editor Tools Styles
  toolsContainer: {
    position: "absolute",
    right: 12,
    top: "38%",
    transform: [{ translateY: -110 }],
    backgroundColor: "rgba(18,18,18,0.72)",
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  toolButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 3,
    borderRadius: 20,
  },
  activeToolButton: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  activeDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ADE80",
  },

  // Bottom Action Bar
  bottomActionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: "#000",
  },
  bottomShareButton: {
    flex: 1,
    maxWidth: 380,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
  },
  bottomShareText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  mediaPreviewContainer: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  videoPreview: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  trashZone: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15000,
  },
  trashZoneText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },
  colorPicker: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
  },
  colorButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  selectedColor: {
    borderColor: "#fff",
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  drawingTools: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 24,
    paddingHorizontal: 10,
    alignSelf: "center",
  },
  brushSizeSlider: {
    marginHorizontal: 30,
    marginBottom: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 10,
  },
  brushSizeLabel: {
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  slider: {
    width: "100%",
    height: 30,
  },
  sliderThumb: {
    backgroundColor: "#fff",
  },
  overlayTools: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
  },
  aspectRatioContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  gradientContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  filterLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CreateStoryScreen;
