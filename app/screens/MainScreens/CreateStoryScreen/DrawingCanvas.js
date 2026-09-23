import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, StyleSheet, Dimensions } from "react-native";
import { Canvas, Path, useCanvasRef } from "@shopify/react-native-skia";
import { captureRef } from "react-native-view-shot";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

const DrawingCanvas = React.forwardRef(
  (
    {
      color = "#FFFFFF",
      strokeWidth = 3,
      isEraser = false,
      savedDrawingData = null,
      // The drawing surface must match the 9:16 story canvas, not the window:
      // its snapshot is later laid back over that canvas, and a window-sized
      // snapshot would be rescaled and pull every stroke out of place.
      width = WINDOW_WIDTH,
      height = WINDOW_HEIGHT,
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

export default DrawingCanvas;
