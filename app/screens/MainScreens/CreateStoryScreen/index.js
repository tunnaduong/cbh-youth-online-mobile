import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Dimensions,
  StyleSheet,
  TouchableHighlight,
  PanResponder,
  Pressable,
  Keyboard,
  Platform,
  Linking,
  ActionSheetIOS,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import FastImage from "../../../components/FastImage";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import {
  Canvas,
  Path,
  useCanvasRef,
  Skia,
  useImage,
  Image as SkiaImage,
} from "@shopify/react-native-skia";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Slider from "@react-native-community/slider";
import { captureRef } from "react-native-view-shot";
import { createStory } from "../../../services/api/Api";
import { useTranslation } from "react-i18next";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useTheme } from "../../../contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

const GRADIENTS = [
  { colors: ["#FF6B6B", "#4ECDC4"], nameKey: "sunset" },
  { colors: ["#8E2DE2", "#4A00E0"], nameKey: "royalIndigo" },
  { colors: ["#FF416C", "#FF4B2B"], nameKey: "crimsonAlert" },
  { colors: ["#11998E", "#38EF7D"], nameKey: "emeraldAurora" },
  { colors: ["#0F2027", "#203A43", "#2C5364"], nameKey: "obsidianNight" },
  { colors: ["#F9D423", "#FF4E50"], nameKey: "goldenHour" },
  { colors: ["#00c6ff", "#0072ff"], nameKey: "skyBlue" },
];

const DrawingCanvas = React.forwardRef(
  (
    {
      color = "#FFFFFF",
      strokeWidth = 3,
      isEraser = false,
      savedDrawingData = null,
    },
    ref
  ) => {
    const [paths, setPaths] = useState([]);
    const [currentPath, setCurrentPath] = useState("");
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useCanvasRef();
    const viewRef = useRef();

    // Load saved drawing paths when component mounts or savedDrawingData changes
    useEffect(() => {
      if (savedDrawingData?.paths) {
        setPaths(savedDrawingData.paths);
      }
    }, [savedDrawingData]);

    const handleTouchStart = (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      if (locationX && locationY && !isNaN(locationX) && !isNaN(locationY)) {
        setIsDrawing(true);
        const newPath = `M${locationX},${locationY}`;
        setCurrentPath(newPath);
      }
    };

    const handleTouchMove = (evt) => {
      if (!isDrawing) return;
      const { locationX, locationY } = evt.nativeEvent;
      if (locationX && locationY && !isNaN(locationX) && !isNaN(locationY)) {
        setCurrentPath((prev) =>
          prev
            ? `${prev}L${locationX},${locationY}`
            : `M${locationX},${locationY}`
        );
      }
    };

    const handleTouchEnd = () => {
      if (isDrawing && currentPath && currentPath.length > 5) {
        setPaths((currentPaths) => [
          ...currentPaths,
          { path: currentPath, color, strokeWidth, isEraser },
        ]);
        setCurrentPath("");
      }
      setIsDrawing(false);
    };

    const handleUndo = () => {
      setPaths((currentPaths) => currentPaths.slice(0, -1));
    };

    const handleClear = () => {
      setPaths([]);
      setCurrentPath("");
    };

    const makeImageSnapshot = async () => {
      try {
        if (!viewRef.current) {
          throw new Error("View reference is not ready");
        }

        const uri = await captureRef(viewRef, {
          format: "png",
          quality: 1,
          result: "base64",
        });

        if (!uri) {
          throw new Error("Failed to capture view");
        }

        return uri;
      } catch (error) {
        console.error("Error creating image snapshot:", error.message);
        return null;
      }
    };

    React.useImperativeHandle(ref, () => ({
      handleUndo,
      handleClear,
      getPaths: () => paths,
      makeImageSnapshot,
      getDrawingData: () => ({
        paths: paths,
        currentPath: currentPath,
        timestamp: Date.now(),
      }),
    }));

    return (
      <View
        style={[StyleSheet.absoluteFill]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ScrollView
          ref={viewRef}
          style={[StyleSheet.absoluteFill]}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            width: width,
            height: height,
            backgroundColor: "transparent",
          }}
        >
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "transparent" },
            ]}
          >
            <Canvas
              ref={canvasRef}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              {paths.map((pathData, index) => {
                if (!pathData.path || pathData.path.length < 5) return null;
                return (
                  <Path
                    key={index}
                    path={pathData.path}
                    strokeWidth={pathData.strokeWidth}
                    style="stroke"
                    color={pathData.isEraser ? "transparent" : pathData.color}
                    blendMode={pathData.isEraser ? "clear" : "source-over"}
                  />
                );
              })}
              {currentPath && currentPath.length > 5 && (
                <Path
                  path={currentPath}
                  strokeWidth={strokeWidth}
                  style="stroke"
                  color={isEraser ? "transparent" : color}
                  blendMode={isEraser ? "clear" : "source-over"}
                />
              )}
            </Canvas>
          </View>
        </ScrollView>
      </View>
    );
  }
);

// Move TextInputArea outside the main component
const TextInputArea = React.memo(
  ({ text, setText, isTextOnly, placeholder, onFinish }) => {
    const handleSubmit = () => {
      Keyboard.dismiss();
      onFinish?.();
    };

    return (
      <Pressable
        onPress={handleSubmit}
        style={[
          isTextOnly
            ? [styles.textOnlyCenterContainer, styles.textInputContainer2]
            : styles.textInputContainer,
        ]}
      >
        <View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.7)"
            multiline
            style={[styles.textInput, isTextOnly ? styles.textOnlyInput : null]}
            autoFocus
          />
        </View>
        {!isTextOnly && <KeyboardAvoidingView behavior="padding" />}
      </Pressable>
    );
  }
);

const TextOnlyContent = memo(({ text }) => (
  <View style={styles.textOnlyWrapper}>
    <Text
      style={styles.textOnlyText}
      adjustsFontSizeToFit={false}
      numberOfLines={0}
    >
      {text}
    </Text>
  </View>
));

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
  React.useEffect(() => { setSliderValue(strokeWidth); }, [strokeWidth]);
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
    <TouchableOpacity style={[styles.toolButton, !isEraser && styles.activeToolButton]} onPress={() => setIsEraser(false)}>
      <Ionicons name="brush" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={[styles.toolButton, isEraser && styles.activeToolButton]} onPress={() => setIsEraser(true)}>
      <Image source={require("../../../assets/eraser.png")} style={{ width: 24, height: 24 }} />
    </TouchableOpacity>
    <TouchableOpacity style={[styles.toolButton, showBrushSize && styles.activeToolButton]} onPress={() => setShowBrushSize(!showBrushSize)}>
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

const MoveableText = memo(({ id, text, x, y, isEditing, onPositionChange, onTap, onDragStart, onDragEnd, onDragging, isAnyDragging }) => {
  const isEditingRef = useRef(isEditing);
  const posRef = useRef({ x, y });
  const panOffset = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const callbacksRef = useRef({ onPositionChange, onTap, onDragStart, onDragEnd, onDragging });

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    posRef.current = { x, y };
  }, [x, y]);

  useEffect(() => {
    callbacksRef.current = { onPositionChange, onTap, onDragStart, onDragEnd, onDragging };
  }, [onPositionChange, onTap, onDragStart, onDragEnd, onDragging]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        panOffset.current = { ...posRef.current };
        didDragRef.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isEditingRef.current) return;
        if (!didDragRef.current && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5)) {
          didDragRef.current = true;
          callbacksRef.current.onDragStart?.();
        }
        if (didDragRef.current) {
          callbacksRef.current.onPositionChange?.(id, {
            x: panOffset.current.x + gestureState.dx,
            y: panOffset.current.y + gestureState.dy,
          });
          callbacksRef.current.onDragging?.(gestureState.moveY);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (isEditingRef.current) return;
        if (didDragRef.current) {
          const isOverTrash = gestureState.moveY > Dimensions.get("window").height * 0.82;
          callbacksRef.current.onDragEnd?.(id, isOverTrash);
        } else {
          callbacksRef.current.onTap?.(id);
        }
        didDragRef.current = false;
      },
    })
  ).current;

  if (!text || isEditing) return null;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.moveableTextContainer,
        {
          transform: [{ translateX: x }, { translateY: y }],
          opacity: isAnyDragging && !isEditing ? 0.8 : 1,
        },
      ]}
    >
      <Text style={styles.moveableText}>{text}</Text>
    </View>
  );
});

const TrashZone = memo(({ visible, isOver }) => {
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
      <Ionicons
        name={isOver ? "trash" : "trash-outline"}
        size={isOver ? 36 : 28}
        color="#fff"
      />
      <Text style={[styles.trashZoneText, isOver && { fontWeight: "700" }]}>
        {isOver ? "Drop to delete" : "Drag here to delete"}
      </Text>
    </Animated.View>
  );
});

const ToolsBar = ({ isEditing, setIsEditing, isDrawing, setIsDrawing, pickImage, onAddText, t }) => {
  const handleTextPress = () => {
    if (onAddText) {
      onAddText();
    } else {
      if (!isEditing) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
    }
  };

  return (
  <View style={styles.toolsContainer}>
    <TouchableOpacity style={styles.toolButton} onPress={handleTextPress}>
      <Ionicons name="text" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
      <Ionicons name="image" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity style={[styles.toolButton, isDrawing && styles.activeToolButton]} onPress={() => setIsDrawing(!isDrawing)}>
      <Ionicons name="brush" size={24} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.toolButton}
      onPress={() => Toast.show({ type: "info", text1: t("story.featureInDevelopment"), text2: t("story.stayTuned") })}
    >
      <Ionicons name="musical-notes" size={24} color="#fff" />
    </TouchableOpacity>
  </View>
  );
};


const CreateStoryScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();
  const [selectedImage, setSelectedImage] = useState(null);
  const [text, setText] = useState("");
  const [textPosition, setTextPosition] = useState({
    x: 0,
    y: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#FFFFFF");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [showBrushSize, setShowBrushSize] = useState(false);
  const [savedDrawingData, setSavedDrawingData] = useState(null);
  const [isTextOnly, setIsTextOnly] = useState(false);
  const [textBackground, setTextBackground] = useState(["#FF6B6B", "#4ECDC4"]);

  const [storyTexts, setStoryTexts] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const textIdCounter = useRef(0);

  const addStoryText = useCallback(() => {
    const newId = `text_${textIdCounter.current++}`;
    setStoryTexts((prev) => [
      ...prev,
      { id: newId, text: "", x: width / 2 - 100, y: captureDims.h / 2 - 20 },
    ]);
    setEditingTextId(newId);
  }, [captureDims]);

  const updateStoryText = useCallback((id, newText) => {
    setStoryTexts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, text: newText } : item))
    );
  }, []);

  const updateStoryTextPosition = useCallback((id, newPos) => {
    setStoryTexts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, x: newPos.x, y: newPos.y } : item))
    );
  }, []);

  const deleteStoryText = useCallback((id) => {
    setStoryTexts((prev) => prev.filter((item) => item.id !== id));
    setEditingTextId((prev) => (prev === id ? null : prev));
  }, []);

  const handleStoryTextDragStart = useCallback(() => {
    setIsDraggingText(true);
    setIsOverTrash(false);
  }, []);

  const handleStoryTextDragEnd = useCallback((id, wasOverTrash) => {
    if (wasOverTrash) {
      deleteStoryText(id);
    }
    setIsDraggingText(false);
    setIsOverTrash(false);
  }, [deleteStoryText]);

  const handleStoryTextDragging = useCallback((moveY) => {
    const screenH = Dimensions.get("window").height;
    setIsOverTrash(moveY > screenH * 0.82);
  }, []);

  const handleStoryTextTap = useCallback((id) => {
    setEditingTextId(id);
  }, []);

  const editingTextItem = useMemo(
    () => storyTexts.find((item) => item.id === editingTextId),
    [storyTexts, editingTextId]
  );

  const drawingRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [isUploading, setIsUploading] = useState(false);
  const imageWithOverlaysRef = useRef(null);
  const [viewReady, setViewReady] = useState(false);
  const [contentAreaHeight, setContentAreaHeight] = useState(0);

  const captureDims = useMemo(() => {
    const extraTopPad = Platform.OS === 'android' ? 4 : 0;
    const availH = contentAreaHeight > 0 ? contentAreaHeight - extraTopPad : 0;
    if (availH <= 0) {
      return { w: width, h: width * 16 / 9 };
    }
    const idealH = width * 16 / 9;
    if (idealH <= availH) {
      return { w: width, h: idealH };
    }
    return { w: availH * 9 / 16, h: availH };
  }, [contentAreaHeight]);

  const handleTextOnlyStory = () => {
    setSelectedImage(null);
    setIsTextOnly(true);
    setIsEditing(true);
    setText("");
    // Randomly select a gradient background
    const randomIndex = Math.floor(Math.random() * GRADIENTS.length);
    setTextBackground(GRADIENTS[randomIndex].colors);
  };

  const cycleGradient = () => {
    const currentIndex = GRADIENTS.findIndex(
      (g) => JSON.stringify(g.colors) === JSON.stringify(textBackground)
    );
    const nextIndex = (currentIndex + 1) % GRADIENTS.length;
    setTextBackground(GRADIENTS[nextIndex].colors);
  };

  const onViewLayout = useCallback(() => {
    setViewReady(true);
  }, []);

  const captureImageWithOverlays = useCallback(async () => {
    try {
      if (!imageWithOverlaysRef.current || !viewReady) {
        console.log("View not ready for capture, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!imageWithOverlaysRef.current) {
          throw new Error("Image reference still not available after waiting");
        }
      }

      // Force a render cycle
      await new Promise((resolve) =>
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        })
      );

      console.log("Starting capture...");
      const capturedUri = await captureRef(imageWithOverlaysRef.current, {
        format: "jpg",
        quality: 1,
        result: "file",
      });

      return capturedUri;
    } catch (error) {
      console.error("Error capturing image with overlays:", error);
      throw error;
    }
  }, [viewReady]);

  const uploadStory = async () => {
    try {
      setIsUploading(true);

      const formData = new FormData();

      if (isTextOnly && text) {
        formData.append("content", text);
      } else if (!isTextOnly && storyTexts.length > 0) {
        const combinedText = storyTexts
          .filter((item) => item.text)
          .map((item) => item.text)
          .join("\n");
        if (combinedText) {
          formData.append("content", combinedText);
        }
      }

      try {
        let finalImageUri = null;

        // For both image stories and text-only stories, capture the view
        if (selectedImage || isTextOnly) {
          // Dismiss keyboard and stop editing first so that overlays are properly rendered in their final state
          Keyboard.dismiss();
          setEditingTextId(null);
          setIsEditing(false);
          await new Promise((resolve) => setTimeout(resolve, 150));

          finalImageUri = await captureImageWithOverlays();
          if (!finalImageUri) {
            throw new Error("Failed to capture story content");
          }
        }

        if (selectedImage) {
          formData.append("media_type", "image");
          formData.append("media_file", {
            uri: finalImageUri,
            type: "image/jpeg",
            name: "story_image.jpg",
          });
        } else if (isTextOnly) {
          // For text-only stories, we'll send both the text content and the captured image
          formData.append("media_type", "text");
          formData.append("media_file", {
            uri: finalImageUri,
            type: "image/jpeg",
            name: "story_text.jpg",
          });
          // Add background color for text-only stories
          if (textBackground && textBackground.length >= 2) {
            formData.append("background_color", JSON.stringify(textBackground));
          }
        }

        formData.append("privacy", "public");

        await createStory(formData);

        Toast.show({
          type: "success",
          text1: t("story.postSuccess"),
          text2: isTextOnly
            ? t("story.textStoryPosted")
            : savedDrawingData
            ? t("story.drawingStoryPosted")
            : t("story.storyPosted"),
        });

        // Reset navigation stack and go to MainScreens
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "MainScreens",
              params: {
                screen: "Home",
                params: {
                  refresh: Date.now(), // Pass a timestamp to ensure the refresh trigger is unique
                },
              },
            },
          ],
        });
      } catch (imageError) {
        console.error("Error processing story content:", imageError);
        Toast.show({
          type: "error",
          text1: t("story.contentError"),
          text2: t("story.contentErrorDesc"),
        });
        return;
      }
    } catch (error) {
      console.error("Error uploading story:", error.response?.data || error);
      Toast.show({
        type: "error",
        text1: t("story.postError"),
        text2: t("story.postErrorDesc"),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExitIOS = (type) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          type == "drawing" ? t("story.discardDrawing") : t("story.discardStory"),
          t("story.continueEditing"),
        ],
        destructiveButtonIndex: 0,
        userInterfaceStyle: "dark",
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          // cancel action
        } else if (buttonIndex === 0) {
          if (type === "drawing") {
            setIsDrawing(false);
          } else if (type === "text") {
            setIsTextOnly(false);
            setIsEditing(false);
            setText("");
          } else if (type === "image") {
            setSelectedImage(null);
            setText("");
            setIsEditing(false);
            setStoryTexts([]);
            setEditingTextId(null);
          }
          // navigation.goBack();
        }
      }
    );
  };

  const handleExitAndroid = (type) => {
    Alert.alert(
      t("story.exitConfirm"),
      t("story.exitConfirmDesc"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("story.exit"),
          onPress: () => {
            if (type === "drawing") {
              setIsDrawing(false);
            } else if (type === "text") {
              setIsTextOnly(false);
              setIsEditing(false);
              setText("");
            } else if (type === "image") {
              setSelectedImage(null);
              setText("");
              setIsEditing(false);
              setStoryTexts([]);
              setEditingTextId(null);
            }
          },
        },
      ]
    );
  };

  const handleHeaderRightPress = () => {
    if (isDrawing) {
      saveDrawing();
    } else {
      uploadStory();
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };



  const saveDrawing = async () => {
    try {
      const currentDrawingData = drawingRef.current?.getDrawingData?.();
      if (!currentDrawingData) {
        throw new Error(t("story.noDrawingData"));
      }

      // Save both the drawing data and capture the image
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

  // Memoize the text input placeholder
  const textInputPlaceholder = useMemo(
    () => (isTextOnly ? t("story.textPlaceholder") : t("story.drawingPlaceholder")),
    [isTextOnly]
  );

  const handleTextChange = useCallback((newText) => {
    setText(newText);
  }, []);

  const handleCameraPress = async () => {
    const { status } = await ImagePicker.getCameraPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (newStatus !== "granted") {
        Toast.show({ type: "error", text1: t("story.cameraPermissionDenied") });
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleBackPress = useCallback(() => {
    if (isDrawing) {
      if (Platform.OS === "ios") {
        handleExitIOS("drawing");
      } else {
        handleExitAndroid("drawing");
      }
    } else if (isTextOnly) {
      if (Platform.OS === "ios") {
        handleExitIOS("text");
      } else {
        handleExitAndroid("text");
      }
    } else if (selectedImage) {
      if (Platform.OS === "ios") {
        handleExitIOS("image");
      } else {
        handleExitAndroid("image");
      }
    } else {
      navigation.goBack();
    }
  }, [isDrawing, isTextOnly, selectedImage]);



  // Update the header right button to show loading state
  const headerRightButton = (
    <TouchableOpacity
      style={{ position: "absolute", right: 10 }}
      onPress={handleHeaderRightPress}
      disabled={(!selectedImage && !isTextOnly) || isUploading}
    >
      <Text
        style={{
          color: selectedImage || isTextOnly
            ? isUploading
              ? `${theme.primary}80`
              : theme.primary
            : `${theme.primary}80`,
        }}
        className="text-base font-semibold"
      >
        {isDrawing ? t("story.done") : isUploading ? t("story.posting") : t("story.share")}
      </Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        {(
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
                name={
                  isDrawing || isTextOnly || selectedImage
                    ? "close"
                    : "arrow-back"
                }
                size={28}
                color={theme.text}
              />
            </TouchableOpacity>
            <Text style={{ color: theme.text }} className="text-lg font-semibold">
              {isDrawing
                ? t("story.draw")
                : isTextOnly
                ? t("story.textContent")
                : selectedImage
                ? t("story.edit")
                : t("story.createStory")}
            </Text>
            {headerRightButton}
          </View>
        )}

        {/* Main Content */}
        <View style={{ flex: 1 }} onLayout={(e) => setContentAreaHeight(e.nativeEvent.layout.height)}>
          {selectedImage || isTextOnly ? (
            <View style={{ flex: 1 }}>
              <View style={styles.aspectRatioContainer}>
                <ScrollView
                  style={{ width: captureDims.w, height: captureDims.h, backgroundColor: '#000' }}
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
                      style={[
                        StyleSheet.absoluteFill,
                        styles.gradientContainer,
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {text && !isEditing && <TextOnlyContent text={text} />}
                    </LinearGradient>
                  ) : (
                    <>
                      <FastImage
                        source={{ uri: selectedImage }}
                        style={StyleSheet.absoluteFill}
                        resizeMode={FastImage.resizeMode.contain}
                      />

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

                      {!isDrawing && storyTexts.map((item) => (
                        <MoveableText
                          key={item.id}
                          id={item.id}
                          text={item.text}
                          x={item.x}
                          y={item.y}
                          isEditing={editingTextId === item.id}
                          onPositionChange={updateStoryTextPosition}
                          onTap={handleStoryTextTap}
                          onDragStart={handleStoryTextDragStart}
                          onDragEnd={handleStoryTextDragEnd}
                          onDragging={handleStoryTextDragging}
                          isAnyDragging={isDraggingText}
                        />
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* UI Controls - Not Captured */}
              {isDrawing ? (
                <View style={styles.overlayTools} pointerEvents="box-none">
                  <ColorPicker strokeColor={strokeColor} setStrokeColor={setStrokeColor} />
                  <BrushSizePicker strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth} showBrushSize={showBrushSize} t={t} />
                  <DrawingTools drawingRef={drawingRef} isEraser={isEraser} setIsEraser={setIsEraser} showBrushSize={showBrushSize} setShowBrushSize={setShowBrushSize} />
                </View>
              ) : !isTextOnly ? (
                <>
                  <ToolsBar
                    isEditing={editingTextId !== null}
                    setIsEditing={(v) => { if (!v) setEditingTextId(null); }}
                    isDrawing={isDrawing}
                    setIsDrawing={setIsDrawing}
                    pickImage={pickImage}
                    onAddText={addStoryText}
                    t={t}
                  />
                  {editingTextId && editingTextItem && (
                    <TextInputArea
                      text={editingTextItem.text}
                      setText={(newText) => updateStoryText(editingTextId, newText)}
                      isTextOnly={false}
                      placeholder={t("story.drawingPlaceholder")}
                      onFinish={() => {
                        Keyboard.dismiss();
                        if (!editingTextItem.text) {
                          deleteStoryText(editingTextId);
                        }
                        setEditingTextId(null);
                      }}
                    />
                  )}
                  <TrashZone visible={isDraggingText} isOver={isOverTrash} />
                </>
              ) : (
                <>
                  {isEditing && (
                    <TextInputArea
                      text={text}
                      setText={handleTextChange}
                      isTextOnly={isTextOnly}
                      placeholder={textInputPlaceholder}
                    />
                  )}
                  <View style={[styles.toolsContainer, { zIndex: 10000 }]}>
                    <TouchableOpacity
                      style={[
                        styles.toolButton,
                        {
                          backgroundColor: "rgba(0,0,0,0.6)",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.4)",
                        },
                      ]}
                      onPress={cycleGradient}
                    >
                      <Ionicons name="color-palette-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
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
                  <View style={{ backgroundColor: theme.cardBackground, borderColor: theme.border }} className="items-center justify-center h-[100px] rounded-xl border-2">
                    <Ionicons
                      name="camera-outline"
                      size={40}
                      color={theme.text}
                      style={{ marginBottom: 3 }}
                    />
                    <Text style={{ color: theme.text }} className="text-md font-semibold">
                      {t("story.takePhoto")}
                    </Text>
                  </View>
                </TouchableHighlight>
                <TouchableHighlight
                  onPress={handleTextOnlyStory}
                  className="flex-1 rounded-xl"
                  underlayColor={isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                >
                  <View style={{ backgroundColor: theme.cardBackground, borderColor: theme.border }} className="items-center justify-center h-[100px] rounded-xl border-2">
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
              <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.background }]} onPress={pickImage}>
                <View style={styles.imagePickerContent}>
                  <Ionicons name="image" size={40} color={theme.text} />
                  <Text style={[styles.imagePickerText, { color: theme.text }]}>
                    {t("story.pickFromGallery")}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
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
    transform: [{ translateY: -100 }],
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
  textInputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  textInputContainer2: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  textInput: {
    color: "#fff",
    fontSize: 18,
    minHeight: 40,
  },
  textDisplay: {
    position: "absolute",
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
  },
  displayText: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
  },
  moveableTextContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -100,
    marginTop: -20,
    width: 200,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    zIndex: 10,
    alignItems: "center",
  },
  moveableText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  trashZone: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 20,
    zIndex: 1000,
  },
  trashZoneText: {
    color: "#fff",
    fontSize: 13,
    marginTop: 4,
  },
  colorPicker: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 1,
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    margin: 5,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  selectedColor: {
    borderColor: "#fff",
    borderWidth: 3,
  },
  drawingTools: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: [{ translateY: -50 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    padding: 8,
    zIndex: 1000,
  },
  activeToolButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  brushSizeSlider: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    zIndex: 1,
  },
  brushSizeLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  slider: {
    width: width * 0.7,
    height: 40,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  savedIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#319527",
    borderWidth: 2,
    borderColor: "#fff",
  },
  overlayTools: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "box-none",
  },
  textOnlyInput: {
    fontSize: 24,
    textAlign: "center",
    color: "#fff",
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    width: "100%",
    maxWidth: width * 0.9,
    paddingHorizontal: 20,
  },
  textOnlyCenterContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  textOnlyContentContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  textOnlyInnerContainer: {
    padding: 20,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  textOnlyDisplayText: {
    fontSize: 24,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  whiteText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: "#319527",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonContainer: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
  },
  aspectRatioContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  captureContainer: {
    width: "100%",
    aspectRatio: 9 / 16,
  },
  captureContentContainer: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  textOnlyWrapper: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  textOnlyText: {
    fontSize: 24,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    includeFontPadding: false,
  },
  androidOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  androidDialog: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 24,
  },
  androidTitle: {
    fontSize: 24,
    fontWeight: "500",
    marginBottom: 16,
    lineHeight: 32,
  },
  androidOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  androidRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  androidRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  androidOptionText: {
    fontSize: 16,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  androidActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  androidCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});

export default CreateStoryScreen;
