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
  SafeAreaView,
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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import FastImage from "react-native-fast-image";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import KeyboardSpacer from "react-native-keyboard-spacer";

const { width, height } = Dimensions.get("window");

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
  ({ text, setText, isTextOnly, placeholder }) => {
    return (
      <Pressable
        onPress={() => Keyboard.dismiss()}
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
        {!isTextOnly && <KeyboardSpacer />}
      </Pressable>
    );
  }
);

const StableCameraView = memo(
  ({ cameraRef, cameraType, onClose, onCameraFlip, onTakePhoto }) => {
    console.log("StableCameraView rendering");

    return (
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cameraType}
        onMountError={(error) => {
          console.error("Camera mount error:", error);
          Toast.show({
            type: "error",
            text1: "Lỗi khởi tạo camera",
            text2: "Không thể khởi tạo camera. Vui lòng thử lại.",
          });
        }}
        onCameraReady={() => {
          console.log("Camera is ready");
        }}
      >
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cameraButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cameraButton} onPress={onCameraFlip}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.captureButtonContainer}>
          <TouchableOpacity style={styles.captureButton} onPress={onTakePhoto}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
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

const CreateStoryScreen = ({ navigation }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [text, setText] = useState("");
  const [textPosition, setTextPosition] = useState({
    x: width / 2,
    y: height / 2,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#FFFFFF");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [showBrushSize, setShowBrushSize] = useState(false);
  const [savedDrawingData, setSavedDrawingData] = useState(null);
  const [isTextOnly, setIsTextOnly] = useState(false);
  const [textBackground, setTextBackground] = useState(["#FF6B6B", "#4ECDC4"]); // Default gradient colors
  const drawingRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [cameraType, setCameraType] = useState("back");
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const imageWithOverlaysRef = useRef(null);
  const [viewReady, setViewReady] = useState(false);

  const gradientBackgrounds = [
    ["#FF6B6B", "#4ECDC4"],
    ["#A8E6CF", "#DCEDC1"],
    ["#FFD93D", "#FF6B6B"],
    ["#6C5B7B", "#C06C84"],
    ["#355C7D", "#6C5B7B"],
  ];

  const handleTextOnlyStory = () => {
    setSelectedImage(null);
    setIsTextOnly(true);
    setIsEditing(true);
    setText("");
    // Randomly select a gradient background
    const randomGradient =
      gradientBackgrounds[
        Math.floor(Math.random() * gradientBackgrounds.length)
      ];
    setTextBackground(randomGradient);
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

      // Add content (text)
      if (text) {
        formData.append("content", text);
      }

      try {
        let finalImageUri = null;

        // For both image stories and text-only stories, capture the view
        if (selectedImage || isTextOnly) {
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
          text1: "Đăng tin thành công",
          text2: isTextOnly
            ? "Tin văn bản đã được đăng."
            : savedDrawingData
            ? "Tin với bản vẽ đã được đăng."
            : "Tin của bạn đã được đăng.",
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
          text1: "Lỗi xử lý nội dung",
          text2: "Không thể xử lý nội dung. Vui lòng thử lại.",
        });
        return;
      }
    } catch (error) {
      console.error("Error uploading story:", error.response?.data || error);
      Toast.show({
        type: "error",
        text1: "Lỗi đăng tin",
        text2: "Không thể đăng tin. Vui lòng thử lại sau.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExitIOS = (type) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          type == "drawing" ? "Bỏ bản vẽ" : "Bỏ tin",
          "Tiếp tục chỉnh sửa",
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
          }
          // navigation.goBack();
        }
      }
    );
  };

  const handleExitAndroid = (type) => {
    Alert.alert(
      "Bạn có chắc chắn muốn thoát không?",
      "Bạn sẽ mất nội dung đã nhập",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Thoát",
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [9, 16],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const colors = [
    "#FFFFFF",
    "#FF0000",
    "#00FF00",
    "#0000FF",
    "#FFFF00",
    "#FF00FF",
    "#00FFFF",
  ];

  const ColorPicker = () => {
    return (
      <View style={styles.colorPicker} pointerEvents="box-none">
        {colors.map((color) => (
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
  };

  const BrushSizePicker = React.memo(() => {
    const [sliderValue, setSliderValue] = useState(strokeWidth);

    // Sync slider value when strokeWidth changes from external sources
    React.useEffect(() => {
      setSliderValue(strokeWidth);
    }, [strokeWidth]);

    if (!showBrushSize) return null;

    return (
      <View style={styles.brushSizeSlider}>
        <Text style={styles.brushSizeLabel}>
          Kích thước bút: {sliderValue}px
        </Text>
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
  });

  const DrawingTools = ({ drawingRef }) => {
    return (
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
          <Image
            source={require("../../../assets/eraser.png")}
            style={{ width: 24, height: 24 }}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolButton, showBrushSize && styles.activeToolButton]}
          onPress={() => setShowBrushSize(!showBrushSize)}
        >
          <Ionicons name="resize" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => drawingRef.current?.handleUndo()}
        >
          <Ionicons name="arrow-undo" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => drawingRef.current?.handleClear()}
        >
          <Ionicons name="trash" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  const ToolsBar = () => (
    <View style={styles.toolsContainer}>
      <TouchableOpacity
        style={styles.toolButton}
        onPress={() => setIsEditing(!isEditing)}
      >
        <Ionicons name="text" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.toolButton} onPress={pickImage}>
        <Ionicons name="image" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toolButton, isDrawing && styles.activeToolButton]}
        onPress={() => setIsDrawing(!isDrawing)}
      >
        <Ionicons name="brush" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.toolButton}
        onPress={() =>
          Toast.show({
            type: "info",
            text1: "Tính năng đang phát triển",
            text2: "Hãy cùng chờ đón tính năng này nhé",
          })
        }
      >
        <Ionicons name="musical-notes" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const saveDrawing = async () => {
    try {
      const currentDrawingData = drawingRef.current?.getDrawingData?.();
      if (!currentDrawingData) {
        throw new Error("Không có dữ liệu vẽ để lưu.");
      }

      // Save both the drawing data and capture the image
      const imageBase64 = await drawingRef.current?.makeImageSnapshot();
      if (!imageBase64) {
        throw new Error("Không thể chụp ảnh bản vẽ.");
      }

      setSavedDrawingData({
        ...currentDrawingData,
        imageBase64: `data:image/png;base64,${imageBase64}`,
      });

      Toast.show({
        type: "success",
        text1: "Đã lưu bản vẽ",
        text2: "Bản vẽ của bạn đã được cập nhật.",
      });

      setIsDrawing(false);
      setShowBrushSize(false);
    } catch (error) {
      console.error("Error saving drawing:", error.message);
      Toast.show({
        type: "error",
        text1: "Lỗi lưu bản vẽ",
        text2: "Không thể lưu bản vẽ. Vui lòng thử lại.",
      });
    }
  };

  // Memoize the text input placeholder
  const textInputPlaceholder = useMemo(
    () => (isTextOnly ? "Nhập nội dung tin của bạn..." : "Nhập nội dung..."),
    [isTextOnly]
  );

  // Memoize text change handler
  const handleTextChange = useCallback((newText) => {
    setText(newText);
  }, []);

  const handleCameraPress = async () => {
    if (!permission) {
      Toast.show({
        type: "info",
        text1: "Đang kiểm tra quyền truy cập",
        text2: "Vui lòng đợi trong giây lát...",
      });
      return;
    }

    if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Toast.show({
          type: "error",
          text1: "Không có quyền truy cập camera",
          text2: "Vui lòng cấp quyền truy cập camera trong cài đặt.",
        });
        return;
      }
    }

    setIsCameraMode(true);
  };

  const handleCameraFlip = () => {
    setCameraType((prevType) => (prevType === "back" ? "front" : "back"));
  };

  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          base64: false,
        });

        setSelectedImage(photo.uri);
        setIsCameraMode(false);
      } catch (error) {
        console.error("Error taking photo:", error);
        Toast.show({
          type: "error",
          text1: "Lỗi chụp ảnh",
          text2: "Không thể chụp ảnh. Vui lòng thử lại.",
        });
      }
    }
  };

  const handleCloseCamera = useCallback(() => {
    setIsCameraMode(false);
  }, []);

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

  const CameraUI = () => {
    if (!permission) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.whiteText}>
            Đang yêu cầu quyền truy cập camera...
          </Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.whiteText}>Không có quyền truy cập camera.</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              if (Platform.OS === "ios") {
                Linking.openURL("app-settings:");
              } else {
                Linking.openSettings();
              }
            }}
          >
            <Text style={styles.permissionButtonText}>Mở Cài đặt</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={StyleSheet.absoluteFill}>
        <StableCameraView
          cameraRef={cameraRef}
          cameraType={cameraType}
          onClose={handleCloseCamera}
          onCameraFlip={handleCameraFlip}
          onTakePhoto={handleTakePhoto}
        />
      </View>
    );
  };

  // Update the header right button to show loading state
  const headerRightButton = (
    <TouchableOpacity
      style={{ position: "absolute", right: 10 }}
      onPress={handleHeaderRightPress}
      disabled={(!selectedImage && !isTextOnly) || isUploading}
    >
      <Text
        className={`text-base font-semibold ${
          selectedImage || isTextOnly
            ? isUploading
              ? "text-[#319527]/50"
              : "text-[#319527]"
            : "text-[#319527]/50"
        }`}
      >
        {isDrawing ? "Xong" : isUploading ? "Đang đăng..." : "Chia sẻ"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Header */}
        {!isCameraMode && (
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
                color="#fff"
              />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">
              {isDrawing
                ? "Vẽ"
                : isTextOnly
                ? "Tin văn bản"
                : selectedImage
                ? "Chỉnh sửa"
                : "Tạo tin"}
            </Text>
            {headerRightButton}
          </View>
        )}

        {/* Main Content */}
        <View style={{ flex: 1 }}>
          {isCameraMode ? (
            <CameraUI />
          ) : selectedImage || isTextOnly ? (
            <View style={{ flex: 1 }}>
              <View style={styles.aspectRatioContainer}>
                <ScrollView
                  style={styles.captureContainer}
                  scrollEnabled={false}
                  ref={imageWithOverlaysRef}
                  onLayout={onViewLayout}
                  contentContainerStyle={styles.captureContentContainer}
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
                      {text && <TextOnlyContent text={text} />}
                    </LinearGradient>
                  ) : (
                    <>
                      <FastImage
                        source={{ uri: selectedImage }}
                        style={StyleSheet.absoluteFill}
                        resizeMode={FastImage.resizeMode.cover}
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

                      {!isDrawing && text && !isEditing && (
                        <View
                          style={[
                            styles.textDisplay,
                            {
                              transform: [
                                { translateX: textPosition.x - width / 2 },
                                { translateY: textPosition.y - height / 2 },
                              ],
                            },
                          ]}
                        >
                          <Text style={styles.displayText}>{text}</Text>
                        </View>
                      )}
                    </>
                  )}
                </ScrollView>
              </View>

              {/* UI Controls - Not Captured */}
              {isDrawing ? (
                <View style={styles.overlayTools} pointerEvents="box-none">
                  <ColorPicker />
                  <BrushSizePicker />
                  <DrawingTools drawingRef={drawingRef} />
                </View>
              ) : !isTextOnly ? (
                <>
                  <ToolsBar />
                  {isEditing && (
                    <TextInputArea
                      text={text}
                      setText={handleTextChange}
                      isTextOnly={isTextOnly}
                      placeholder={textInputPlaceholder}
                    />
                  )}
                </>
              ) : (
                isEditing && (
                  <TextInputArea
                    text={text}
                    setText={handleTextChange}
                    isTextOnly={isTextOnly}
                    placeholder={textInputPlaceholder}
                  />
                )
              )}
            </View>
          ) : (
            <>
              <View className="flex-row items-center justify-center py-5 gap-4 mx-2">
                <TouchableHighlight
                  onPress={handleCameraPress}
                  className="flex-1"
                >
                  <View className="items-center justify-center h-[100px] rounded-xl bg-neutral-900 border-2 border-neutral-800">
                    <Ionicons
                      name="camera-outline"
                      size={40}
                      color="#fff"
                      style={{ marginBottom: 3 }}
                    />
                    <Text className="text-white text-md font-semibold">
                      Chụp ảnh
                    </Text>
                  </View>
                </TouchableHighlight>
                <TouchableHighlight
                  onPress={handleTextOnlyStory}
                  className="flex-1"
                >
                  <View className="items-center justify-center h-[100px] rounded-xl bg-neutral-900 border-2 border-neutral-800">
                    <Ionicons
                      name="text-outline"
                      size={40}
                      color="#fff"
                      style={{ marginBottom: 3 }}
                    />
                    <Text className="text-white text-md font-semibold">
                      Văn bản
                    </Text>
                  </View>
                </TouchableHighlight>
              </View>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                <View style={styles.imagePickerContent}>
                  <Ionicons name="image" size={40} color="#fff" />
                  <Text style={styles.imagePickerText}>
                    Chọn ảnh từ thư viện
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
});

export default CreateStoryScreen;
