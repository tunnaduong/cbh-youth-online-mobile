import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { Animated, PanResponder, StyleSheet } from "react-native";
import FastImage from "../../../components/FastImage";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

const getDistance = (touches) => {
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
};

const getMidpoint = (touches) => {
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
};

/**
 * Instagram-style pinch-to-zoom + pan wrapper for the story background image.
 *
 * - Two-finger pinch: zoom 1×–6×, anchored at the pinch midpoint.
 * - Two-finger pan while pinching: follows the midpoint drift.
 * - One-finger pan when zoomed in: drag to reposition.
 * - Double-tap: reset to 1×.
 * - Translation is clamped so the image never reveals a gap at the canvas
 *   edges (it covers the full canvas at all times).
 *
 * Because the whole Animated.View lives inside the `imageWithOverlaysRef` View
 * that is passed to captureRef, zoom + position are automatically baked into
 * the final JPEG that gets posted — no extra work needed at upload time.
 */
const PinchableStoryImage = forwardRef(
  ({ uri, baseStyle, canvasWidth, canvasHeight, disabled = false }, ref) => {
    // ── Animated values ──────────────────────────────────────────────────────
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    // Raw (non-async) mirrors of the animated values, used in gesture math.
    const sv = useRef(1);         // scale value
    const tx = useRef(0);         // translateX value
    const ty = useRef(0);         // translateY value

    // Saved baseline at the start of each gesture segment.
    const baseScale = useRef(1);
    const baseTx = useRef(0);
    const baseTy = useRef(0);

    // Pinch state.
    const pinchStart = useRef(null); // { dist, mid, scale, tx, ty }

    // Double-tap detection.
    const lastTap = useRef(0);

    // Expose a reset() method so the parent can reset when a new image is loaded.
    useImperativeHandle(ref, () => ({
      reset() {
        sv.current = 1;
        tx.current = 0;
        ty.current = 0;
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start();
      },
    }));

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Clamp translation so the scaled image always covers the canvas entirely.
     * baseStyle gives the "cover" dimensions: { left, top, width, height }.
     */
    const clamp = (nextTx, nextTy, currentScale) => {
      if (!baseStyle || !canvasWidth || !canvasHeight) {
        return { x: nextTx, y: nextTy };
      }

      const scaledW = (baseStyle.width ?? canvasWidth) * currentScale;
      const scaledH = (baseStyle.height ?? canvasHeight) * currentScale;

      // Maximum translation to keep the scaled image covering the canvas.
      const maxX = Math.max(0, (scaledW - canvasWidth) / 2);
      const maxY = Math.max(0, (scaledH - canvasHeight) / 2);

      return {
        x: Math.max(-maxX, Math.min(maxX, nextTx)),
        y: Math.max(-maxY, Math.min(maxY, nextTy)),
      };
    };

    const applyTransform = (nextScale, nextTx, nextTy, animated = false) => {
      const { x, y } = clamp(nextTx, nextTy, nextScale);

      sv.current = nextScale;
      tx.current = x;
      ty.current = y;

      if (animated) {
        Animated.parallel([
          Animated.spring(scale, { toValue: nextScale, useNativeDriver: true }),
          Animated.spring(translateX, { toValue: x, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: y, useNativeDriver: true }),
        ]).start();
      } else {
        scale.setValue(nextScale);
        translateX.setValue(x);
        translateY.setValue(y);
      }
    };

    const reset = (animated = true) => applyTransform(1, 0, 0, animated);

    // ── PanResponder ──────────────────────────────────────────────────────────

    const panResponder = useRef(
      PanResponder.create({
        // Capture 2-finger gestures immediately; capture 1-finger only when
        // already zoomed so single-finger taps still reach overlays.
        onStartShouldSetPanResponder: (evt) =>
          !disabled && evt.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (evt, gs) => {
          if (disabled) return false;
          return (
            evt.nativeEvent.touches.length >= 2 ||
            (sv.current > 1 &&
              (Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2))
          );
        },
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: () => {
          baseScale.current = sv.current;
          baseTx.current = tx.current;
          baseTy.current = ty.current;
          pinchStart.current = null;
        },

        onPanResponderMove: (evt, gs) => {
          if (disabled) return;
          const touches = evt.nativeEvent.touches;

          if (touches.length >= 2) {
            const dist = getDistance(touches);
            const mid = getMidpoint(touches);

            if (!pinchStart.current) {
              // Record the starting point of this pinch segment.
              pinchStart.current = {
                dist,
                mid,
                scale: baseScale.current,
                tx: baseTx.current,
                ty: baseTy.current,
              };
              return;
            }

            const { dist: startDist, mid: startMid, scale: startScale, tx: startTx, ty: startTy } =
              pinchStart.current;

            const nextScale = Math.max(
              MIN_SCALE,
              Math.min(MAX_SCALE, startScale * (dist / startDist))
            );

            // Translate so the pinch midpoint stays fixed on the canvas.
            const midDx = mid.x - startMid.x;
            const midDy = mid.y - startMid.y;
            const nextTx = startTx + midDx;
            const nextTy = startTy + midDy;

            applyTransform(nextScale, nextTx, nextTy);
          } else if (touches.length === 1 && sv.current > 1) {
            // Single-finger pan when zoomed.
            if (pinchStart.current) {
              // Finger was lifted from pinch — reset base so there's no jump.
              pinchStart.current = null;
              baseScale.current = sv.current;
              baseTx.current = tx.current;
              baseTy.current = ty.current;
              return;
            }

            applyTransform(sv.current, baseTx.current + gs.dx, baseTy.current + gs.dy);
          }
        },

        onPanResponderRelease: (evt, gs) => {
          // Check for double-tap to reset.
          if (evt.nativeEvent.touches.length === 0 && gs.numberActiveTouches === 0) {
            const now = Date.now();
            if (now - lastTap.current < 300) {
              reset(true);
              lastTap.current = 0;
              return;
            }
            lastTap.current = now;
          }

          // Snap back to MIN_SCALE if the user pinched below 1×.
          if (sv.current <= MIN_SCALE + 0.05) {
            reset(true);
          } else {
            // Update baselines for the next gesture.
            baseScale.current = sv.current;
            baseTx.current = tx.current;
            baseTy.current = ty.current;
            pinchStart.current = null;
          }
        },

        onPanResponderTerminate: () => {
          pinchStart.current = null;
          baseScale.current = sv.current;
          baseTx.current = tx.current;
          baseTy.current = ty.current;
        },
      })
    ).current;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX },
              { translateY },
              { scale },
            ],
          },
        ]}
      >
        <FastImage
          source={{ uri }}
          style={baseStyle || StyleSheet.absoluteFill}
          resizeMode={FastImage.resizeMode.cover}
        />
      </Animated.View>
    );
  }
);

PinchableStoryImage.displayName = "PinchableStoryImage";

export default PinchableStoryImage;
