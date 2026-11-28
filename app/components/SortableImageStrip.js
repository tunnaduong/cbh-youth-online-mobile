import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import FastImage from "./FastImage";

const SPRING = { damping: 18, stiffness: 260, mass: 0.7 };
const AUTO_SCROLL_EDGE = 44;
const AUTO_SCROLL_STEP = 6;

/**
 * Pure helper to move an element inside an array without mutating it.
 */
export function arrayMove(list, fromIndex, toIndex) {
  if (
    !Array.isArray(list) ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return list;
  }
  const next = list.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function SortableImageTile({
  image,
  index,
  tileSize,
  step,
  borderRadius,
  canDrag,
  activeIndex,
  targetIndex,
  dragX,
  dragY,
  scrollDelta,
  itemCount,
  showOrderBadge,
  onStartDrag,
  onHoverSlotChange,
  onPointerMove,
  onEndDrag,
  onRemove,
  renderOverlay,
  theme,
  removeLabel,
}) {
  const uri = typeof image === "string" ? image : image?.uri;

  const pan = usePanGesture({
    enabled: canDrag,
    activateAfterLongPress: 200,
    onActivate: () => {
      "worklet";
      activeIndex.value = index;
      targetIndex.value = index;
      dragX.value = 0;
      dragY.value = 0;
      scrollDelta.value = 0;
      scheduleOnRN(onStartDrag, index);
    },
    onUpdate: (e) => {
      "worklet";
      if (activeIndex.value !== index) return;
      dragX.value = e.translationX;
      dragY.value = Math.max(-14, Math.min(14, e.translationY * 0.25));
      const maxIdx = Math.max(0, itemCount.value - 1);
      const totalOffsetX = e.translationX + scrollDelta.value;
      const shifted = Math.round((index * step + totalOffsetX) / step);
      const nextTarget = Math.max(0, Math.min(maxIdx, shifted));
      if (nextTarget !== targetIndex.value) {
        targetIndex.value = nextTarget;
        scheduleOnRN(onHoverSlotChange);
      }
      scheduleOnRN(onPointerMove, e.absoluteX);
    },
    onDeactivate: () => {
      "worklet";
      if (activeIndex.value !== index) return;
      const from = index;
      const to = targetIndex.value;
      if (from === to) {
        dragX.value = withSpring(0, SPRING);
        dragY.value = withSpring(0, SPRING);
      } else {
        const landX = (to - from) * step - scrollDelta.value;
        dragX.value = withTiming(landX, { duration: 110 });
        dragY.value = withTiming(0, { duration: 110 });
      }
      scheduleOnRN(onEndDrag, from, to);
    },
    onFinalize: () => {
      "worklet";
      // Safety net if gesture was cancelled externally before onDeactivate
      if (activeIndex.value === index) {
        const from = index;
        const to = targetIndex.value;
        scheduleOnRN(onEndDrag, from, to);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeIndex.value;
    const target = targetIndex.value;

    if (active === index) {
      return {
        zIndex: 100,
        elevation: 10,
        transform: [
          { translateX: dragX.value + scrollDelta.value },
          { translateY: dragY.value },
          { scale: withSpring(1.07, SPRING) },
        ],
      };
    }

    if (active === -1) {
      return {
        zIndex: 1,
        elevation: 0,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
      };
    }

    let shift = 0;
    if (active < target && index > active && index <= target) {
      shift = -step;
    } else if (active > target && index >= target && index < active) {
      shift = step;
    }

    return {
      zIndex: 1,
      elevation: 0,
      transform: [
        { translateX: withSpring(shift, SPRING) },
        { translateY: 0 },
        { scale: withSpring(1, SPRING) },
      ],
    };
  });

  const activeBorderStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    return {
      borderWidth: isActive ? 2 : StyleSheet.hairlineWidth,
      borderColor: isActive ? "#22C55E" : theme.border,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width: tileSize, height: tileSize }, animatedStyle]}>
        <Animated.View
          style={[
            styles.imageFrame,
            { width: tileSize, height: tileSize, borderRadius },
            activeBorderStyle,
          ]}
        >
          <FastImage
            source={{ uri }}
            style={{ width: "100%", height: "100%", borderRadius }}
          />
          {renderOverlay ? renderOverlay(image, index) : null}
        </Animated.View>

        {showOrderBadge && canDrag ? (
          <View style={styles.orderBadge} pointerEvents="none">
            <Text style={styles.orderBadgeText}>{index + 1}</Text>
          </View>
        ) : null}

        {onRemove ? (
          <TouchableOpacity
            onPress={() => onRemove(index)}
            style={styles.removeBadge}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={removeLabel}
          >
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Horizontal press-and-hold drag-to-reorder image strip built on Reanimated +
 * react-native-gesture-handler v3 (JS/OTA-only, no extra native modules).
 *
 * - Normal tap hits the remove badge immediately.
 * - Normal swipe scrolls the strip (or the parent scroll view vertically).
 * - Long-press (200ms) lifts the tile with haptics, locks parent/strip scroll,
 *   slides neighbor tiles aside on the UI thread, and auto-scrolls near edges.
 */
export default function SortableImageStrip({
  images = [],
  onReorder,
  onRemove,
  onDragStateChange,
  tileSize = 104,
  gap = 8,
  borderRadius = 14,
  contentContainerStyle,
  trailingContent = null,
  renderOverlay = null,
  disabled = false,
  showOrderBadge = true,
  showHint = true,
  hintText,
  hintStyle,
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const canDrag = !disabled && images.length > 1 && typeof onReorder === "function";
  const step = tileSize + gap;

  const activeIndex = useSharedValue(-1);
  const targetIndex = useSharedValue(-1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const scrollDelta = useSharedValue(0);
  const itemCount = useSharedValue(images.length);

  const [isDragging, setIsDragging] = useState(false);

  const scrollViewRef = useRef(null);
  const containerRef = useRef(null);
  const scrollXRef = useRef(0);
  const contentWidthRef = useRef(0);
  const viewportWidthRef = useRef(0);
  const containerWindowRef = useRef({ left: 0, right: 0 });
  const dragStartScrollXRef = useRef(0);
  const draggingIndexRef = useRef(-1);
  const pointerAbsXRef = useRef(null);
  const autoScrollTimerRef = useRef(null);
  const endedRef = useRef(false);
  const resetFallbackTimerRef = useRef(null);

  useEffect(() => {
    itemCount.value = images.length;
  }, [images.length, itemCount]);

  // Reset drag transforms synchronously after React commits the reordered list,
  // so tiles settle into their new DOM slots with zero single-frame jump.
  useLayoutEffect(() => {
    if (activeIndex.value !== -1) {
      activeIndex.value = -1;
      targetIndex.value = -1;
      dragX.value = 0;
      dragY.value = 0;
      scrollDelta.value = 0;
    }
  }, [images, activeIndex, targetIndex, dragX, dragY, scrollDelta]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAutoScroll();
      if (resetFallbackTimerRef.current) clearTimeout(resetFallbackTimerRef.current);
    };
  }, [stopAutoScroll]);

  const handleStartDrag = useCallback(
    (index) => {
      endedRef.current = false;
      draggingIndexRef.current = index;
      dragStartScrollXRef.current = scrollXRef.current;
      pointerAbsXRef.current = null;
      if (resetFallbackTimerRef.current) {
        clearTimeout(resetFallbackTimerRef.current);
        resetFallbackTimerRef.current = null;
      }

      setIsDragging(true);
      onDragStateChange?.(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      containerRef.current?.measureInWindow?.((x, _y, width) => {
        containerWindowRef.current = { left: x, right: x + width };
      });
    },
    [onDragStateChange]
  );

  const handleHoverSlotChange = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const handlePointerMove = useCallback(
    (absX) => {
      pointerAbsXRef.current = absX;
      const maxScroll = Math.max(0, contentWidthRef.current - viewportWidthRef.current);
      if (maxScroll <= 0) return;

      const { left, right } = containerWindowRef.current;
      const nearRight = right > 0 && absX > right - AUTO_SCROLL_EDGE;
      const nearLeft = right > 0 && absX < left + AUTO_SCROLL_EDGE;

      if (!nearRight && !nearLeft) {
        stopAutoScroll();
        return;
      }

      if (autoScrollTimerRef.current) return;

      autoScrollTimerRef.current = setInterval(() => {
        const curAbsX = pointerAbsXRef.current;
        if (curAbsX == null || draggingIndexRef.current === -1) {
          stopAutoScroll();
          return;
        }
        const bounds = containerWindowRef.current;
        const max = Math.max(0, contentWidthRef.current - viewportWidthRef.current);
        let dir = 0;
        if (curAbsX > bounds.right - AUTO_SCROLL_EDGE) dir = 1;
        else if (curAbsX < bounds.left + AUTO_SCROLL_EDGE) dir = -1;
        else {
          stopAutoScroll();
          return;
        }

        const nextX = Math.max(0, Math.min(max, scrollXRef.current + dir * AUTO_SCROLL_STEP));
        if (nextX === scrollXRef.current) return;

        scrollXRef.current = nextX;
        scrollViewRef.current?.scrollTo({ x: nextX, animated: false });
        const delta = nextX - dragStartScrollXRef.current;
        scrollDelta.value = delta;

        const idx = draggingIndexRef.current;
        const shifted = Math.round((idx * step + dragX.value + delta) / step);
        const clampedTarget = Math.max(0, Math.min(images.length - 1, shifted));
        if (clampedTarget !== targetIndex.value) {
          targetIndex.value = clampedTarget;
          Haptics.selectionAsync().catch(() => {});
        }
      }, 16);
    },
    [stopAutoScroll, step, images.length, scrollDelta, dragX, targetIndex]
  );

  const handleEndDrag = useCallback(
    (from, to) => {
      if (endedRef.current) return;
      endedRef.current = true;
      draggingIndexRef.current = -1;
      stopAutoScroll();
      setIsDragging(false);
      onDragStateChange?.(false);

      if (from !== to && from >= 0 && to >= 0 && from < images.length && to < images.length) {
        onReorder?.(from, to);
        // Fallback reset in case parent does not replace `images` array ref
        resetFallbackTimerRef.current = setTimeout(() => {
          activeIndex.value = -1;
          targetIndex.value = -1;
          dragX.value = 0;
          dragY.value = 0;
          scrollDelta.value = 0;
        }, 120);
      } else {
        activeIndex.value = -1;
        targetIndex.value = -1;
        dragX.value = 0;
        dragY.value = 0;
        scrollDelta.value = 0;
      }
    },
    [
      stopAutoScroll,
      onDragStateChange,
      onReorder,
      images.length,
      activeIndex,
      targetIndex,
      dragX,
      dragY,
      scrollDelta,
    ]
  );

  const resolvedHint =
    hintText || t("createPost.dragToReorderImages", "Nhấn giữ và kéo ảnh để đổi thứ tự");
  const removeLabel = t("createPost.removeAttachment", "Xóa tệp đính kèm");

  // Build stable unique keys even if the user attaches the same URI twice
  const seenKeys = new Map();
  const keyedImages = images.map((img, idx) => {
    const base =
      typeof img === "string"
        ? img
        : img?.uid ?? (img?.id != null ? `id-${img.id}` : img?.uri ?? `idx-${idx}`);
    const count = seenKeys.get(base) || 0;
    seenKeys.set(base, count + 1);
    return { img, key: count === 0 ? String(base) : `${base}__${count}` };
  });

  return (
    <View ref={containerRef} collapsable={false}>
      {showHint && canDrag ? (
        <View style={[styles.hintRow, hintStyle]}>
          <Ionicons name="reorder-three-outline" size={15} color={theme.subText} />
          <Text style={[styles.hintText, { color: theme.subText }]}>{resolvedHint}</Text>
        </View>
      ) : null}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        scrollEnabled={!isDragging}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x;
        }}
        onLayout={(e) => {
          viewportWidthRef.current = e.nativeEvent.layout.width;
        }}
        onContentSizeChange={(w) => {
          contentWidthRef.current = w;
        }}
        contentContainerStyle={[styles.row, { gap }, contentContainerStyle]}
      >
        {keyedImages.map(({ img, key }, index) => (
          <SortableImageTile
            key={key}
            image={img}
            index={index}
            tileSize={tileSize}
            step={step}
            borderRadius={borderRadius}
            canDrag={canDrag}
            activeIndex={activeIndex}
            targetIndex={targetIndex}
            dragX={dragX}
            dragY={dragY}
            scrollDelta={scrollDelta}
            itemCount={itemCount}
            showOrderBadge={showOrderBadge}
            onStartDrag={handleStartDrag}
            onHoverSlotChange={handleHoverSlotChange}
            onPointerMove={handlePointerMove}
            onEndDrag={handleEndDrag}
            onRemove={disabled ? undefined : onRemove}
            renderOverlay={renderOverlay}
            theme={theme}
            removeLabel={removeLabel}
          />
        ))}
        {trailingContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 12,
  },
  row: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: "center",
  },
  imageFrame: {
    overflow: "hidden",
  },
  orderBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  removeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
