import { useRef, useEffect } from "react";
import { View, Animated } from "react-native";

// Three dots bouncing in a staggered loop, matching web's CSS
// `typingDotBounce` keyframes (globals.css) so both platforms read as the
// same design.
const TypingDots = ({ color }) => {
  const anims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
            opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};

export { TypingDots };
