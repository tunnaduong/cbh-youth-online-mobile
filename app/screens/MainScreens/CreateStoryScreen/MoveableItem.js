import React, { memo, useEffect, useRef } from "react";
import { Animated, PanResponder, Dimensions } from "react-native";

const MIN_SCALE = 0.3;
const MAX_SCALE = 6;
const TRASH_ZONE_RATIO = 0.82;

const distanceBetween = (touches) => {
  const [a, b] = touches;
  return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
};

const midpointBetween = (touches) => {
  const [a, b] = touches;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
};

const angleBetween = (touches) => {
  const [a, b] = touches;
  return (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI;
};

const normalizeAngleDelta = (delta) => {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

/**
 * Drag / pinch-to-resize / twist wrapper for a single story overlay, plus the
 * drag-to-trash gesture.
 *
 * Transforms are driven by Animated values so a drag never re-renders the
 * whole editor; the parent's state is only updated when the gesture ends.
 * Position is the item's top-left corner on the 9:16 canvas, which is exactly
 * what the viewer re-applies later.
 */
const MoveableItem = ({
  item,
  onChange,
  onTap,
  onDragStart,
  onDragging,
  onDragEnd,
  disabled = false,
  children,
}) => {
  const translate = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
  const scale = useRef(new Animated.Value(item.scale ?? 1)).current;
  const rotation = useRef(new Animated.Value(item.rotation ?? 0)).current;

  // Live values, needed because Animated.Value reads are async-ish and the
  // gesture math has to build on the exact value it last wrote.
  const current = useRef({
    x: item.x,
    y: item.y,
    scale: item.scale ?? 1,
    rotation: item.rotation ?? 0,
  });
  const gestureStart = useRef({ ...current.current });
  const pinchStart = useRef(null);
  const didMove = useRef(false);
  const disabledRef = useRef(disabled);
  const callbacks = useRef({ onChange, onTap, onDragStart, onDragging, onDragEnd });

  useEffect(() => {
    callbacks.current = { onChange, onTap, onDragStart, onDragging, onDragEnd };
  }, [onChange, onTap, onDragStart, onDragging, onDragEnd]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    // Keep in sync when the parent changes the item outside of a gesture
    // (e.g. the text editor re-centres a box after the text got longer).
    current.current = {
      x: item.x,
      y: item.y,
      scale: item.scale ?? 1,
      rotation: item.rotation ?? 0,
    };
    translate.setValue({ x: item.x, y: item.y });
    scale.setValue(item.scale ?? 1);
    rotation.setValue(item.rotation ?? 0);
  }, [item.x, item.y, item.scale, item.rotation, translate, scale, rotation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: () => {
        gestureStart.current = { ...current.current, dx: 0, dy: 0 };
        pinchStart.current = null;
        didMove.current = false;
      },
      onPanResponderMove: (event, gestureState) => {
        if (disabledRef.current) return;

        const touches = event.nativeEvent.touches;

        if (touches.length >= 2) {
          const distance = distanceBetween(touches);
          const midpoint = midpointBetween(touches);
          const angle = angleBetween(touches);

          if (!pinchStart.current || distance < 4) {
            pinchStart.current = {
              distance: Math.max(distance, 4),
              midpoint,
              angle,
              x: current.current.x,
              y: current.current.y,
              scale: current.current.scale,
              rotation: current.current.rotation,
            };
            return;
          }

          const nextScale = Math.max(
            MIN_SCALE,
            Math.min(MAX_SCALE, pinchStart.current.scale * (distance / pinchStart.current.distance))
          );
          const nextRotation =
            pinchStart.current.rotation + normalizeAngleDelta(angle - pinchStart.current.angle);
          const nextX = pinchStart.current.x + (midpoint.x - pinchStart.current.midpoint.x);
          const nextY = pinchStart.current.y + (midpoint.y - pinchStart.current.midpoint.y);

          current.current.x = nextX;
          current.current.y = nextY;
          current.current.scale = nextScale;
          current.current.rotation = nextRotation;
          translate.setValue({ x: nextX, y: nextY });
          scale.setValue(nextScale);
          rotation.setValue(nextRotation);
          didMove.current = true;
          return;
        }

        // A finger was lifted after a pinch - restart the pinch reference so
        // the item does not jump when the gesture continues with one finger.
        if (pinchStart.current) {
          pinchStart.current = null;
          gestureStart.current = {
            ...current.current,
            dx: gestureState.dx,
            dy: gestureState.dy,
          };
          return;
        }

        const deltaX = gestureState.dx - (gestureStart.current.dx || 0);
        const deltaY = gestureState.dy - (gestureStart.current.dy || 0);

        if (!didMove.current && Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
          return;
        }

        if (!didMove.current) {
          didMove.current = true;
          callbacks.current.onDragStart?.(item.id);
        }

        const nextX = gestureStart.current.x + deltaX;
        const nextY = gestureStart.current.y + deltaY;

        current.current.x = nextX;
        current.current.y = nextY;
        translate.setValue({ x: nextX, y: nextY });
        callbacks.current.onDragging?.(gestureState.moveY);
      },
      onPanResponderRelease: (event, gestureState) => {
        if (disabledRef.current) return;

        if (!didMove.current) {
          callbacks.current.onTap?.(item.id);
          return;
        }

        const overTrash =
          gestureState.numberActiveTouches <= 1 &&
          gestureState.moveY > Dimensions.get("window").height * TRASH_ZONE_RATIO;

        callbacks.current.onChange?.(item.id, { ...current.current });
        callbacks.current.onDragEnd?.(item.id, overTrash);
        didMove.current = false;
        pinchStart.current = null;
      },
      onPanResponderTerminate: () => {
        callbacks.current.onChange?.(item.id, { ...current.current });
        callbacks.current.onDragEnd?.(item.id, false);
        didMove.current = false;
        pinchStart.current = null;
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: [
          { translateX: translate.x },
          { translateY: translate.y },
          { scale },
          {
            rotate: rotation.interpolate({
              inputRange: [-360, 360],
              outputRange: ["-360deg", "360deg"],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

export default memo(MoveableItem);
