import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Dimensions, AppState } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

// Helper to generate random numbers
const random = (min, max) => Math.random() * (max - min) + min;

const FloatingElement = ({ config, theme, isDarkMode }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Floating up and down
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: config.floatOffset,
          duration: config.floatDuration,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: config.floatDuration,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Gentle rotation for non-circles
    if (config.type !== 'circle') {
      Animated.loop(
        Animated.timing(rotate, {
          toValue: 1,
          duration: config.floatDuration * 2.5,
          useNativeDriver: true,
        })
      ).start();
    }
  }, []);

  const animatedStyle = {
    transform: [
      { translateY },
      ...(config.type !== 'circle'
        ? [
            {
              rotate: rotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ]
        : []),
    ],
  };

  const commonStyle = {
    position: 'absolute',
    top: config.top,
    left: config.left,
    width: config.size,
    height: config.size,
    opacity: isDarkMode ? config.opacityDark : config.opacityLight,
  };

  if (config.type === 'logo') {
    return (
      <Animated.View style={[commonStyle, animatedStyle]}>
        <Image
          source={require('../assets/logo.png')}
          style={{
            width: '100%',
            height: '100%',
            resizeMode: 'contain',
            // Option to tint logo with primary color so it matches the theme perfectly
            tintColor: theme.primary, 
          }}
        />
      </Animated.View>
    );
  }

  // Material Design shapes: Circle or Blob (Rounded Rect)
  const shapeStyle = {
    backgroundColor: theme.primary,
    borderRadius: config.type === 'circle' ? config.size / 2 : config.size * 0.35,
  };

  return <Animated.View style={[commonStyle, shapeStyle, animatedStyle]} />;
};

const AuthBackground = () => {
  const { theme, isDarkMode } = useTheme();

    const generateElements = () => {
    // Always 1 or 2 logos
    const numLogos = Math.random() > 0.5 ? 2 : 1;
    // Plus 2 to 3 beautiful shapes
    const numShapes = Math.floor(random(2, 4));
    
    const items = [];

    // 1. Generate Logos
    for (let i = 0; i < numLogos; i++) {
      items.push({
        id: `logo-${i}-${Date.now()}`,
        type: 'logo',
        size: random(120, 250),
        top: random(-50, height - 150),
        left: random(-50, width - 100),
        opacityLight: random(0.04, 0.08),
        opacityDark: random(0.06, 0.12),
        floatOffset: random(10, 30) * (Math.random() > 0.5 ? 1 : -1),
        floatDuration: random(4000, 7000),
      });
    }

    // 2. Generate Material Shapes
    for (let i = 0; i < numShapes; i++) {
      items.push({
        id: `shape-${i}-${Date.now()}`,
        type: Math.random() > 0.5 ? 'circle' : 'rounded-rect',
        size: random(180, 400),
        top: random(-100, height - 150),
        left: random(-100, width - 100),
        opacityLight: random(0.03, 0.07),
        opacityDark: random(0.05, 0.1),
        floatOffset: random(15, 40) * (Math.random() > 0.5 ? 1 : -1),
        floatDuration: random(5000, 8000),
      });
    }

    return items;
  };

  const [elements, setElements] = React.useState(generateElements());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        setElements(generateElements());
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {elements.map((config) => (
        <FloatingElement
          key={config.id}
          config={config}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
});

export default React.memo(AuthBackground);
