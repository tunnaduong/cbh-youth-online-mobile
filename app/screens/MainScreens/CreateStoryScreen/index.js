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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import FastImage from "../../../components/FastImage";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Slider from "@react-native-community/slider";
import { captureRef } from "react-native-view-shot";
import { createStory } from "../../../services/api/Api";
import { useTranslation } from "react-i18next";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import Video from "react-native-video";
import { useTheme } from "../../../contexts/ThemeContext";
import DrawingCanvas from "./DrawingCanvas";
import MoveableItem from "./MoveableItem";
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
import { toStoryMusicPayload } from "../../../services/musicSearch";

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
    <TouchableOpacity style={styles.toolButton} onPress={onAddText}>
      <Ionicons name="text" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolButton} onPress={onOpenStickers}>
      <Ionicons name="happy-outline" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.toolButton, hasMusic && styles.activeToolButton]}
      onPress={onOpenMusic}
    >
      <Ionicons name="musical-notes" size={24} color="#fff" />
    </TouchableOpacity>
    {!isTextOnly && (
      <>
        <TouchableOpacity
          style={[styles.toolButton, isDrawing && styles.activeToolButton]}
          onPress={onToggleDrawing}
        >
          <Ionicons name="brush" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolButton, filtersVisible && styles.activeToolButton]}
          onPress={onToggleFilters}
        >
          <Ionicons name="color-filter-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </>
    )}
    {isTextOnly && (
      <TouchableOpacity style={styles.toolButton} onPress={onCycleGradient}>
        <Ionicons name="color-palette-outline" size={24} color="#fff" />
      </TouchableOpacity>
    )}
    {selectedMediaType === "video" && (
      <TouchableOpacity style={styles.toolButton} onPress={toggleMute}>
        <Ionicons
          name={isMuted ? "volume-mute-outline" : "volume-high-outline"}
          size={24}
          color="#fff"
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

  const hasContent = Boolean(originalImage || isTextOnly);
  const isVideo = selectedMediaType === "video";

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
  };

  /**
   * Stories are 9:16, so anything picked gets centre-cropped to that ratio -
   * some OS pickers ignore the `aspect` hint when both photos and videos are
   * selectable, which used to leave uncropped images in the editor.
   */
  const forceStoryAspect = async (asset) => {
    if (!asset?.width || !asset?.height) return asset;

    const targetRatio = 9 / 16;
    const currentRatio = asset.width / asset.height;

    if (Math.abs(currentRatio - targetRatio) <= 0.02) return asset;

    try {
      let cropWidth = asset.width;
      let cropHeight = Math.round(asset.width / targetRatio);

      if (cropHeight > asset.height) {
        cropHeight = asset.height;
        cropWidth = Math.round(asset.height * targetRatio);
      }

      const manipulated = await manipulateAsync(
        asset.uri,
        [
          {
            crop: {
              originX: Math.round((asset.width - cropWidth) / 2),
              originY: Math.round((asset.height - cropHeight) / 2),
              width: cropWidth,
              height: cropHeight,
            },
          },
        ],
        { compress: 1, format: SaveFormat.JPEG }
      );

      return { ...asset, uri: manipulated.uri, width: manipulated.width, height: manipulated.height };
    } catch (error) {
      console.warn("Failed to force 9:16 crop on story image:", error?.message);
      return asset;
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
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
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
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
      quality: 1,
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

    try {
      setIsUploading(true);

      const formData = new FormData();
      const contentText = textItems
        .map((item) => item.text)
        .join("\n")
        .trim();

      if (contentText) {
        formData.append("content", contentText);
      }

      let mediaUri = null;

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

      if (isVideo) {
        const storyFile = {
          uri: mediaUri,
          type: selectedMediaAsset?.mimeType || "video/mp4",
          name: selectedMediaAsset?.fileName || "story_video.mp4",
        };

        formData.append("media_type", "video");
        formData.append("media_file", storyFile);
        formData.append("file", storyFile);
        formData.append("is_muted", isMuted ? "true" : "false");
      } else {
        const storyFile = {
          uri: mediaUri,
          type: "image/jpeg",
          name: isTextOnly ? "story_text.jpg" : "story_image.jpg",
        };

        formData.append("media_type", isTextOnly ? "text" : "image");
        formData.append("media_file", storyFile);
        formData.append("file", storyFile);

        if (isTextOnly && textBackground?.length >= 2) {
          formData.append("background_color", JSON.stringify(textBackground));
        }
      }

      // Overlays are always sent: for photos they only carry the tap targets
      // for mentions/links (the look is already flattened into the picture),
      // for videos they are what the viewer draws on top.
      const overlays = buildOverlaysPayload(!isVideo);

      if (overlays) {
        formData.append("overlays", JSON.stringify(overlays));
      }

      if (music) {
        formData.append("music", JSON.stringify(toStoryMusicPayload(music)));
      }

      formData.append("privacy", "public");

      await createStory(formData);

      Toast.show({
        type: "success",
        text1: t("story.postSuccess"),
        text2: isTextOnly ? t("story.textStoryPosted") : t("story.storyPosted"),
      });

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "MainScreens",
            params: { screen: "Home", params: { refresh: Date.now() } },
          },
        ],
      });
    } catch (error) {
      const serverMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message;

      console.error("[CreateStory] failed to post story", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      Toast.show({
        type: "error",
        text1: t("story.postError"),
        text2: typeof serverMessage === "string" ? serverMessage : t("story.postErrorDesc"),
      });
    } finally {
      setIsUploading(false);
    }
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
  }, [isDrawing, hasContent]);

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
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{ marginTop: insets.top }}
          className="flex-row items-center justify-center px-4 py-2 h-[50px]"
        >
          <TouchableOpacity
            style={{ position: "absolute", left: 10 }}
            onPress={handleBackPress}
            disabled={isUploading}
          >
            <Ionicons
              name={isDrawing || hasContent ? "close" : "arrow-back"}
              size={28}
              color={theme.text}
            />
          </TouchableOpacity>
          <Text style={{ color: theme.text }} className="text-lg font-semibold">
            {isDrawing
              ? t("story.draw")
              : isTextOnly
              ? t("story.textContent")
              : hasContent
              ? t("story.edit")
              : t("story.createStory")}
          </Text>
          {headerRightButton}
        </View>

        <View
          style={{ flex: 1 }}
          onLayout={(event) => setContentAreaHeight(event.nativeEvent.layout.height)}
        >
          {hasContent ? (
            <View style={{ flex: 1 }}>
              <View style={styles.aspectRatioContainer}>
                <ScrollView
                  style={{ width: captureDims.w, height: captureDims.h, backgroundColor: "#000" }}
                  scrollEnabled={false}
                  ref={imageWithOverlaysRef}
                  onLayout={onViewLayout}
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
                        resizeMode="cover"
                        repeat
                        paused={false}
                        muted={isMuted}
                      />
                      <StoryFilterTint filterId={filterId} />
                    </View>
                  ) : (
                    <FastImage
                      source={{ uri: displayImage || originalImage }}
                      style={StyleSheet.absoluteFill}
                      resizeMode={FastImage.resizeMode.cover}
                    />
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
              ) : (
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
          ) : (
            <>
              <View className="flex-row items-center justify-center py-5 gap-4 mx-2">
                <TouchableHighlight
                  onPress={handleCameraPress}
                  className="flex-1 rounded-xl"
                  underlayColor={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                >
                  <View
                    style={{ backgroundColor: theme.cardBackground, borderColor: theme.border }}
                    className="items-center justify-center h-[100px] rounded-xl border-2"
                  >
                    <Ionicons
                      name="camera-outline"
                      size={40}
                      color={theme.text}
                      style={{ marginBottom: 3 }}
                    />
                    <Text style={{ color: theme.text }} className="text-md font-semibold">
                      {t("story.takePhotoOrVideo")}
                    </Text>
                  </View>
                </TouchableHighlight>
                <TouchableHighlight
                  onPress={handleTextOnlyStory}
                  className="flex-1 rounded-xl"
                  underlayColor={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                >
                  <View
                    style={{ backgroundColor: theme.cardBackground, borderColor: theme.border }}
                    className="items-center justify-center h-[100px] rounded-xl border-2"
                  >
                    <Ionicons
                      name="text-outline"
                      size={40}
                      color={theme.text}
                      style={{ marginBottom: 3 }}
                    />
                    <Text style={{ color: theme.text }} className="text-md font-semibold">
                      {t("story.text")}
                    </Text>
                  </View>
                </TouchableHighlight>
              </View>
              <TouchableOpacity
                style={[styles.imagePicker, { backgroundColor: theme.background }]}
                onPress={pickImage}
              >
                <View style={styles.imagePickerContent}>
                  <Ionicons name="image" size={40} color={theme.text} />
                  <Text style={[styles.imagePickerText, { color: theme.text }]}>
                    {t("story.pickPhotoOrVideo")}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

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
  imagePicker: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  imagePickerContent: {
    alignItems: "center",
    padding: 20,
  },
  imagePickerText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  toolsContainer: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: [{ translateY: -120 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 8,
  },
  toolButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
    borderRadius: 20,
  },
  activeToolButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
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
    bottom: 40,
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
