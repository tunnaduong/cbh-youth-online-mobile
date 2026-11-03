import React from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop, G } from "react-native-svg";
import { useTheme } from "../../../../contexts/ThemeContext";

/**
 * ChatMascotBackground:
 * Renders the cute cartoon mascot frog, hill curve, sparkle stars, and glowing aura
 * using pure SVG code, matching the chat screen mockup with high fidelity.
 * Adapts beautifully to both dark and light modes.
 */
const ChatMascotBackground = ({ composerHeight = 65, insetsTop = 47 }) => {
  const { width, height } = useWindowDimensions();
  const { isDarkMode } = useTheme();

  // Position frog at bottom-left corner peeking over the hill
  const frogX = 4;
  const frogBottom = height - composerHeight - 6;
  const frogY = frogBottom - 118; // Frog height ~118

  // Ground hill curve parameters: passes across the frog's lower belly/paws
  const hillStartY = frogBottom - 30;

  // Color constants based on active theme
  const strokeColor = isDarkMode ? "#22C55E" : "#16A34A";
  const strokeOpacity = isDarkMode ? 0.75 : 0.82;
  const bellyFillColor = isDarkMode ? "#22C55E" : "#34D399";
  const bellyFillOpacity = isDarkMode ? 0.18 : 0.24;
  const hillStrokeColor = isDarkMode ? "#22C55E" : "#16A34A";
  const hillOpacity = isDarkMode ? 0.45 : 0.48;
  const starFillColor = isDarkMode ? "#22C55E" : "#16A34A";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="frogAuraGlow"
            cx={`${(frogX + 80) / width}`}
            cy={`${(frogY + 80) / height}`}
            rx={`${130 / width}`}
            ry={`${130 / height}`}
          >
            <Stop
              offset="0%"
              stopColor={isDarkMode ? "#22C55E" : "#86EFAC"}
              stopOpacity={isDarkMode ? 0.35 : 0.48}
            />
            <Stop
              offset="50%"
              stopColor={isDarkMode ? "#10B981" : "#A7F3D0"}
              stopOpacity={isDarkMode ? 0.14 : 0.22}
            />
            <Stop
              offset="100%"
              stopColor={isDarkMode ? "#000000" : "#F0FDF4"}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>

        {/* 1. Bioluminescent Aura Glow behind the frog */}
        <Circle
          cx={frogX + 80}
          cy={frogY + 80}
          r={130}
          fill="url(#frogAuraGlow)"
        />

        {/* 2. Background Sparkle Stars (✦) */}
        {/* Top-right sparkle star below header */}
        <Path
          d={`M ${width - 45} ${insetsTop + 75} 
             Q ${width - 45} ${insetsTop + 89} ${width - 32} ${insetsTop + 89} 
             Q ${width - 45} ${insetsTop + 89} ${width - 45} ${insetsTop + 103} 
             Q ${width - 45} ${insetsTop + 89} ${width - 58} ${insetsTop + 89} 
             Q ${width - 45} ${insetsTop + 89} ${width - 45} ${insetsTop + 75} Z`}
          fill={starFillColor}
          fillOpacity={isDarkMode ? 0.3 : 0.38}
        />

        {/* Upper-left sparkle star floating above the frog */}
        <Path
          d={`M ${frogX + 34} ${frogY - 42} 
             Q ${frogX + 34} ${frogY - 30} ${frogX + 46} ${frogY - 30} 
             Q ${frogX + 34} ${frogY - 30} ${frogX + 34} ${frogY - 18} 
             Q ${frogX + 34} ${frogY - 30} ${frogX + 22} ${frogY - 30} 
             Q ${frogX + 34} ${frogY - 30} ${frogX + 34} ${frogY - 42} Z`}
          fill={starFillColor}
          fillOpacity={isDarkMode ? 0.38 : 0.45}
        />

        {/* Lower-right subtle sparkle star */}
        <Path
          d={`M ${width - 65} ${frogBottom - 30} 
             Q ${width - 65} ${frogBottom - 22} ${width - 57} ${frogBottom - 22} 
             Q ${width - 65} ${frogBottom - 22} ${width - 65} ${frogBottom - 14} 
             Q ${width - 65} ${frogBottom - 22} ${width - 73} ${frogBottom - 22} 
             Q ${width - 65} ${frogBottom - 22} ${width - 65} ${frogBottom - 30} Z`}
          fill={starFillColor}
          fillOpacity={isDarkMode ? 0.24 : 0.32}
        />

        {/* 3. Hill / Ground Contour Line sweeping across bottom-left */}
        <Path
          d={`M -20 ${hillStartY} 
             C ${width * 0.22} ${hillStartY + 14}, 
               ${width * 0.52} ${hillStartY + 45}, 
               ${width + 20} ${hillStartY + 80}`}
          stroke={hillStrokeColor}
          strokeOpacity={hillOpacity}
          strokeWidth={2.4}
          fill="none"
        />

        {/* 4. Mascot Frog Group */}
        <G transform={`translate(${frogX}, ${frogY})`}>
          {/* Alert Exclamation Doodles "! !" */}
          {/* Left exclamation: stroke line + round dot */}
          <Path
            d="M 110 18 L 112 5"
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
          <Circle
            cx={109.5}
            cy={23}
            r={2}
            fill={strokeColor}
            fillOpacity={strokeOpacity}
          />

          {/* Right exclamation (tilted): stroke line + round dot */}
          <Path
            d="M 122 15 L 132 4"
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
          <Circle
            cx={120}
            cy={20}
            r={2}
            fill={strokeColor}
            fillOpacity={strokeOpacity}
          />

          {/* Left Paw: 3 cute rounded toes hugging the hill */}
          <Path
            d="M 28 80 
               C 16 80, 8 83, 6 88 
               C 4 92, 7 96, 11 96 
               C 7 98, 7 103, 11 106 
               C 15 108, 20 106, 22 101 
               C 20 106, 25 110, 30 109 
               C 35 107, 37 102, 35 96"
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Right Paw: 3 cute rounded toes hugging the hill */}
          <Path
            d="M 127 96 
               C 125 102, 127 107, 132 109 
               C 137 110, 142 106, 140 101 
               C 142 106, 147 108, 151 106 
               C 155 103, 155 98, 151 96 
               C 155 96, 158 92, 156 88 
               C 154 83, 146 80, 134 80"
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Main Frog Silhouette: Left cheek -> Left eye dome -> Bridge -> Right eye dome -> Right cheek */}
          <Path
            d="M 24 88 
               C 14 72, 15 54, 26 39
               C 33 24, 52 19, 65 27
               C 72 32, 75 41, 76 46
               C 79 48, 83 48, 86 46
               C 87 41, 90 32, 97 27
               C 110 19, 129 24, 136 39
               C 147 54, 148 72, 138 88"
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Plump Friendly Belly / Chin Patch with soft translucent fill */}
          <Path
            d="M 32 62 
               C 44 53, 58 51, 70 55 
               C 76 57, 86 57, 92 55 
               C 104 51, 118 53, 130 62 
               C 136 78, 126 94, 102 95 
               L 60 95 
               C 36 94, 26 78, 32 62 Z"
            fill={bellyFillColor}
            fillOpacity={bellyFillOpacity}
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />

          {/* Left Eye: Outer oval + inner oval pupil */}
          <Ellipse
            cx={50}
            cy={38}
            rx={10}
            ry={14}
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={3}
            fill="none"
          />
          <Ellipse
            cx={50}
            cy={38}
            rx={4.5}
            ry={8}
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={2.4}
            fill={isDarkMode ? "rgba(52, 211, 153, 0.35)" : "rgba(22, 163, 74, 0.35)"}
          />

          {/* Right Eye: Outer oval + inner oval pupil */}
          <Ellipse
            cx={112}
            cy={38}
            rx={10}
            ry={14}
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={3}
            fill="none"
          />
          <Ellipse
            cx={112}
            cy={38}
            rx={4.5}
            ry={8}
            stroke={strokeColor}
            strokeOpacity={strokeOpacity}
            strokeWidth={2.4}
            fill={isDarkMode ? "rgba(52, 211, 153, 0.35)" : "rgba(22, 163, 74, 0.35)"}
          />

          {/* Nostrils (two cute solid round dots) */}
          <Circle
            cx={77}
            cy={50}
            r={2.2}
            fill={strokeColor}
            fillOpacity={strokeOpacity}
          />
          <Circle
            cx={85}
            cy={50}
            r={2.2}
            fill={strokeColor}
            fillOpacity={strokeOpacity}
          />
        </G>
      </Svg>
    </View>
  );
};

export default React.memo(ChatMascotBackground);
