import React, { useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Animated, Image, PanResponder, Platform, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import FastImage from "../../../components/FastImage";

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const SNAP_TRANSLATE_THRESHOLD = 7;
const SNAP_ROTATION_THRESHOLD = 5;
const SNAP_SCALE_THRESHOLD = 0.035;

const getDistance = (touches) => {
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
};

const getMidpoint = (touches) => {
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
};

const getAngle = (touches) => {
  const [a, b] = touches;
  return (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI;
};

const normalizeAngleDelta = (delta) => {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

const snapRotationAngle = (angle) => {
  const nearest90 = Math.round(angle / 90) * 90;
  if (Math.abs(angle - nearest90) <= SNAP_ROTATION_THRESHOLD) {
    return { angle: nearest90, snapped: true };
  }
  return { angle, snapped: false };
};

const triggerLightHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/**
 * Instagram / Facebook-style pinch-to-resize, rotate, and pan wrapper for the
 * story photo.
 *
 * - Two-finger pinch: freely resize photo smaller (down to 0.25x) or larger
 *   (up to 6x), with elastic resistance at boundaries and magnetic snap at 1x.
 * - Two-finger twist: rotate photo with magnetic snap at 0° / 90° / 180° / 270°.
 * - One-finger or two-finger drag: reposition photo anywhere on the 9:16 canvas
 *   with magnetic snap + visual alignment guides at horizontal/vertical center.
 * - Double-tap: smoothly reset / toggle fit & fill.
 * - Ambient blurred backdrop behind the photo when scaled down, rotated, or
 *   when viewing non-9:16 photos.
 */
const PinchableStoryImage = forwardRef(
  ({ uri, baseStyle, coverScale = 1, canvasWidth, canvasHeight, disabled = false }, ref) => {
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const rotation = useRef(new Animated.Value(0)).current;

    const [guides, setGuides] = useState({ centerX: false, centerY: false, rotation: false });
    const guidesRef = useRef({ centerX: false, centerY: false, rotation: false, scale: false });

    const sv = useRef(1);
    const tx = useRef(0);
    const ty = useRef(0);
    const rot = useRef(0);

    const panAnchor = useRef({ tx: 0, ty: 0, dx: 0, dy: 0 });
    const pinchStart = useRef(null);
    const didMove = useRef(false);
    const lastTap = useRef(0);

    const propsRef = useRef({ baseStyle, coverScale, canvasWidth, canvasHeight, disabled });
    propsRef.current = { baseStyle, coverScale, canvasWidth, canvasHeight, disabled };

    const updateGuides = (next) => {
      const prev = guidesRef.current;
      if (
        prev.centerX !== next.centerX ||
        prev.centerY !== next.centerY ||
        prev.rotation !== next.rotation
      ) {
        setGuides({
          centerX: next.centerX,
          centerY: next.centerY,
          rotation: next.rotation,
        });
      }
      guidesRef.current = next;
    };

    const clearGuides = () => {
      if (
        guidesRef.current.centerX ||
        guidesRef.current.centerY ||
        guidesRef.current.rotation ||
        guidesRef.current.scale
      ) {
        guidesRef.current = { centerX: false, centerY: false, rotation: false, scale: false };
        setGuides({ centerX: false, centerY: false, rotation: false });
      }
    };

    const animateTo = (nextScale, nextTx, nextTy, nextRot) => {
      sv.current = nextScale;
      tx.current = nextTx;
      ty.current = nextTy;
      rot.current = nextRot;

      Animated.parallel([
        Animated.spring(scale, {
          toValue: nextScale,
          useNativeDriver: true,
          friction: 7,
          tension: 70,
        }),
        Animated.spring(translateX, {
          toValue: nextTx,
          useNativeDriver: true,
          friction: 7,
          tension: 70,
        }),
        Animated.spring(translateY, {
          toValue: nextTy,
          useNativeDriver: true,
          friction: 7,
          tension: 70,
        }),
        Animated.spring(rotation, {
          toValue: nextRot,
          useNativeDriver: true,
          friction: 7,
          tension: 70,
        }),
      ]).start();
    };

    useImperativeHandle(ref, () => ({
      reset() {
        clearGuides();
        sv.current = 1;
        tx.current = 0;
        ty.current = 0;
        rot.current = 0;
        scale.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
        rotation.setValue(0);
      },
    }));

    const clampVisibleBounds = (nextScale, nextTx, nextTy) => {
      const { canvasWidth: cw, canvasHeight: ch, baseStyle: bs } = propsRef.current;
      if (!cw || !ch) return { x: nextTx, y: nextTy };

      const w = (bs?.width || cw) * nextScale;
      const h = (bs?.height || ch) * nextScale;
      const maxX = cw * 0.42 + w * 0.35;
      const maxY = ch * 0.42 + h * 0.35;

      return {
        x: Math.max(-maxX, Math.min(maxX, nextTx)),
        y: Math.max(-maxY, Math.min(maxY, nextTy)),
      };
    };

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !propsRef.current.disabled,
        onMoveShouldSetPanResponder: (_, gs) => {
          if (propsRef.current.disabled) return false;
          return gs.numberActiveTouches >= 2 || Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2;
        },
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (_, gs) => {
          panAnchor.current = {
            tx: tx.current,
            ty: ty.current,
            dx: gs.dx,
            dy: gs.dy,
          };
          pinchStart.current = null;
          didMove.current = false;
        },

        onPanResponderMove: (evt, gs) => {
          if (propsRef.current.disabled) return;
          const touches = evt.nativeEvent.touches;

          if (touches.length >= 2) {
            const dist = getDistance(touches);
            const mid = getMidpoint(touches);
            const angle = getAngle(touches);

            if (!pinchStart.current || dist < 4) {
              pinchStart.current = {
                dist: Math.max(dist, 4),
                mid,
                angle,
                scale: sv.current,
                tx: tx.current,
                ty: ty.current,
                rot: rot.current,
              };
              return;
            }

            const start = pinchStart.current;
            let rawScale = start.scale * (dist / start.dist);

            // Elastic rubber-banding beyond MIN_SCALE / MAX_SCALE
            if (rawScale < MIN_SCALE) {
              rawScale = Math.max(0.15, MIN_SCALE - (MIN_SCALE - rawScale) * 0.35);
            } else if (rawScale > MAX_SCALE) {
              rawScale = MAX_SCALE + (rawScale - MAX_SCALE) * 0.35;
            }

            // Soft snap at 1.0x or coverScale
            let snappedScale = false;
            const targetCover = propsRef.current.coverScale || 1;
            if (Math.abs(rawScale - 1) <= SNAP_SCALE_THRESHOLD) {
              rawScale = 1;
              snappedScale = true;
            } else if (
              targetCover > 1.05 &&
              Math.abs(rawScale - targetCover) <= SNAP_SCALE_THRESHOLD * targetCover
            ) {
              rawScale = targetCover;
              snappedScale = true;
            }

            // Rotation + cardinal snap
            const angleDelta = normalizeAngleDelta(angle - start.angle);
            const rawRot = start.rot + angleDelta;
            const { angle: nextRot, snapped: snappedRot } = snapRotationAngle(rawRot);

            // Midpoint pan + center snap
            let nextTx = start.tx + (mid.x - start.mid.x);
            let nextTy = start.ty + (mid.y - start.mid.y);

            const snappedX = Math.abs(nextTx) <= SNAP_TRANSLATE_THRESHOLD;
            const snappedY = Math.abs(nextTy) <= SNAP_TRANSLATE_THRESHOLD;
            if (snappedX) nextTx = 0;
            if (snappedY) nextTy = 0;

            const prevGuides = guidesRef.current;
            if (
              (snappedX && !prevGuides.centerX) ||
              (snappedY && !prevGuides.centerY) ||
              (snappedRot && !prevGuides.rotation) ||
              (snappedScale && !prevGuides.scale)
            ) {
              triggerLightHaptic();
            }

            updateGuides({
              centerX: snappedX,
              centerY: snappedY,
              rotation: snappedRot,
              scale: snappedScale,
            });

            sv.current = rawScale;
            tx.current = nextTx;
            ty.current = nextTy;
            rot.current = nextRot;

            scale.setValue(rawScale);
            translateX.setValue(nextTx);
            translateY.setValue(nextTy);
            rotation.setValue(nextRot);
            didMove.current = true;
            return;
          }

          // Transition from 2 fingers -> 1 finger without jumping
          if (pinchStart.current) {
            pinchStart.current = null;
            panAnchor.current = {
              tx: tx.current,
              ty: ty.current,
              dx: gs.dx,
              dy: gs.dy,
            };
            return;
          }

          if (touches.length === 1) {
            const deltaX = gs.dx - panAnchor.current.dx;
            const deltaY = gs.dy - panAnchor.current.dy;

            if (!didMove.current && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
              return;
            }

            didMove.current = true;
            let nextTx = panAnchor.current.tx + deltaX;
            let nextTy = panAnchor.current.ty + deltaY;

            const snappedX = Math.abs(nextTx) <= SNAP_TRANSLATE_THRESHOLD;
            const snappedY = Math.abs(nextTy) <= SNAP_TRANSLATE_THRESHOLD;
            if (snappedX) nextTx = 0;
            if (snappedY) nextTy = 0;

            const prevGuides = guidesRef.current;
            if ((snappedX && !prevGuides.centerX) || (snappedY && !prevGuides.centerY)) {
              triggerLightHaptic();
            }

            updateGuides({
              centerX: snappedX,
              centerY: snappedY,
              rotation: false,
              scale: false,
            });

            tx.current = nextTx;
            ty.current = nextTy;
            translateX.setValue(nextTx);
            translateY.setValue(nextTy);
          }
        },

        onPanResponderRelease: () => {
          clearGuides();
          pinchStart.current = null;

          if (!didMove.current) {
            const now = Date.now();
            if (now - lastTap.current < 300) {
              lastTap.current = 0;
              triggerLightHaptic();
              const targetCover = propsRef.current.coverScale || 1;
              const isDefaultState =
                Math.abs(sv.current - 1) < 0.05 &&
                Math.abs(tx.current) < 5 &&
                Math.abs(ty.current) < 5 &&
                Math.abs(rot.current % 360) < 2;

              if (isDefaultState && targetCover > 1.05) {
                animateTo(targetCover, 0, 0, 0);
              } else {
                animateTo(1, 0, 0, 0);
              }
              return;
            }
            lastTap.current = now;
            return;
          }

          const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, sv.current));
          const { x: clampedTx, y: clampedTy } = clampVisibleBounds(
            clampedScale,
            tx.current,
            ty.current
          );

          if (
            clampedScale !== sv.current ||
            clampedTx !== tx.current ||
            clampedTy !== ty.current
          ) {
            animateTo(clampedScale, clampedTx, clampedTy, rot.current);
          }
        },

        onPanResponderTerminate: () => {
          clearGuides();
          pinchStart.current = null;
          const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, sv.current));
          const { x: clampedTx, y: clampedTy } = clampVisibleBounds(
            clampedScale,
            tx.current,
            ty.current
          );
          if (
            clampedScale !== sv.current ||
            clampedTx !== tx.current ||
            clampedTy !== ty.current
          ) {
            animateTo(clampedScale, clampedTx, clampedTy, rot.current);
          }
        },
      })
    ).current;

    const rotateInterpolate = rotation.interpolate({
      inputRange: [-360, 360],
      outputRange: ["-360deg", "360deg"],
    });

    return (
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
        {/* Ambient blurred backdrop (visible when photo is pinched smaller, rotated, or letterboxed) */}
        {uri ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={Platform.OS === "ios" ? 35 : 22}
            />
            <View style={styles.backdropDim} />
          </View>
        ) : null}

        <Animated.View
          pointerEvents="none"
          style={[
            baseStyle || StyleSheet.absoluteFill,
            {
              transform: [
                { translateX },
                { translateY },
                { scale },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        >
          <FastImage
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode={FastImage.resizeMode.cover}
          />
        </Animated.View>

        {/* Instagram-style center alignment guide lines (hidden on release so never captured) */}
        {guides.centerX && (
          <View pointerEvents="none" style={styles.guideVertical} />
        )}
        {guides.centerY && (
          <View pointerEvents="none" style={styles.guideHorizontal} />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  guideVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: "#00D4FF",
    opacity: 0.85,
  },
  guideHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1.5,
    marginTop: -0.75,
    backgroundColor: "#00D4FF",
    opacity: 0.85,
  },
});

PinchableStoryImage.displayName = "PinchableStoryImage";

export default PinchableStoryImage;
