import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../../../../contexts/ThemeContext";

/**
 * Organic curved wave header background drawn with pure SVG.
 * Adapts to dark and light modes with glowing emerald and mint gradients.
 */
const ConversationHeaderBackground = ({ height = 120 }) => {
  const { isDarkMode } = useTheme();

  const h = height;
  const waveDipY = h - 6;
  const waveStartY = h - 22;

  // Base opaque canopy path from top-left (0,0) down to the organic wave contour
  const baseCanopyPath = `M 0 0 
    L 400 0 
    L 400 ${waveStartY} 
    C 330 ${h}, 220 ${waveDipY + 4}, 130 ${waveStartY + 2} 
    C 60 ${waveStartY - 10}, 20 ${waveStartY - 4}, 0 ${waveStartY} Z`;

  // Secondary fluid wave overlay
  const upperWavePath = `M 0 0 
    L 400 0 
    L 400 ${waveStartY - 24} 
    C 290 ${waveStartY + 4}, 170 ${waveStartY - 16}, 70 ${waveStartY - 48} 
    C 35 ${waveStartY - 64}, 10 ${waveStartY - 78}, 0 0 Z`;

  // Radiant glowing ribbon curve sweeping across middle-right
  const glowingRibbonPath = `M 110 0 
    C 160 ${h * 0.28}, 235 ${h * 0.58}, 305 ${waveStartY - 8} 
    C 345 ${waveStartY - 2}, 380 ${waveStartY - 6}, 400 ${waveStartY - 12}`;

  const accentContourPath = `M 170 0 
    C 215 ${h * 0.32}, 285 ${h * 0.62}, 355 ${waveStartY - 6} 
    C 375 ${waveStartY - 4}, 390 ${waveStartY - 5}, 400 ${waveStartY - 8}`;

  const bottomEdgePath = `M 0 ${waveStartY} 
    C 20 ${waveStartY - 4}, 60 ${waveStartY - 10}, 130 ${waveStartY + 2} 
    C 220 ${waveDipY + 4}, 330 ${h}, 400 ${waveStartY}`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Svg
        width="100%"
        height={h}
        viewBox={`0 0 400 ${h}`}
        preserveAspectRatio="none"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {isDarkMode ? (
            <>
              {/* Dark mode base canopy gradient: solid opaque deep emerald/black */}
              <LinearGradient id="headerBaseDark" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#04140E" stopOpacity={1} />
                <Stop offset="45%" stopColor="#082A1E" stopOpacity={1} />
                <Stop offset="80%" stopColor="#051912" stopOpacity={1} />
                <Stop offset="100%" stopColor="#020B08" stopOpacity={1} />
              </LinearGradient>

              {/* Glowing emerald ribbon */}
              <LinearGradient id="waveGlowDark" x1="0%" y1="0%" x2="100%" y2="80%">
                <Stop offset="0%" stopColor="#22C55E" stopOpacity="0" />
                <Stop offset="30%" stopColor="#10B981" stopOpacity="0.5" />
                <Stop offset="70%" stopColor="#22C55E" stopOpacity="0.85" />
                <Stop offset="100%" stopColor="#34D399" stopOpacity="0.25" />
              </LinearGradient>

              {/* Deep fluid wave overlay */}
              <LinearGradient id="darkWaveShape" x1="15%" y1="0%" x2="95%" y2="100%">
                <Stop offset="0%" stopColor="#020E09" stopOpacity="0.95" />
                <Stop offset="55%" stopColor="#06281B" stopOpacity="0.96" />
                <Stop offset="100%" stopColor="#083626" stopOpacity="0.9" />
              </LinearGradient>
            </>
          ) : (
            <>
              {/* Light mode base canopy gradient: solid opaque fresh mint/sage */}
              <LinearGradient id="headerBaseLight" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#E6F7EE" stopOpacity={1} />
                <Stop offset="45%" stopColor="#D4F3E2" stopOpacity={1} />
                <Stop offset="80%" stopColor="#E0F7EB" stopOpacity={1} />
                <Stop offset="100%" stopColor="#F0FCF5" stopOpacity={1} />
              </LinearGradient>

              {/* Crisp jade ribbon */}
              <LinearGradient id="waveGlowLight" x1="0%" y1="0%" x2="100%" y2="80%">
                <Stop offset="0%" stopColor="#10B981" stopOpacity="0" />
                <Stop offset="30%" stopColor="#059669" stopOpacity="0.45" />
                <Stop offset="70%" stopColor="#10B981" stopOpacity="0.75" />
                <Stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
              </LinearGradient>

              {/* Soft mint fluid wave overlay */}
              <LinearGradient id="lightWaveShape" x1="15%" y1="0%" x2="95%" y2="100%">
                <Stop offset="0%" stopColor="#BBF7D0" stopOpacity="0.65" />
                <Stop offset="55%" stopColor="#A7F3D0" stopOpacity="0.55" />
                <Stop offset="100%" stopColor="#C6F6D5" stopOpacity="0.75" />
              </LinearGradient>
            </>
          )}
        </Defs>

        {/* 1. Base Curved Canopy */}
        <Path
          d={baseCanopyPath}
          fill={isDarkMode ? "url(#headerBaseDark)" : "url(#headerBaseLight)"}
        />

        {/* 2. Upper Flowing Wave Shape */}
        <Path
          d={upperWavePath}
          fill={isDarkMode ? "url(#darkWaveShape)" : "url(#lightWaveShape)"}
        />

        {/* 3. Glowing Emerald Ribbon Wave */}
        <Path
          d={glowingRibbonPath}
          stroke={isDarkMode ? "url(#waveGlowDark)" : "url(#waveGlowLight)"}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />

        {/* 4. Secondary subtle accent wave contour */}
        <Path
          d={accentContourPath}
          stroke={isDarkMode ? "#22C55E" : "#10B981"}
          strokeOpacity={isDarkMode ? 0.35 : 0.4}
          strokeWidth={1.8}
          fill="none"
        />

        {/* 5. Bottom boundary subtle wave glow line */}
        <Path
          d={bottomEdgePath}
          stroke={isDarkMode ? "#10B981" : "#059669"}
          strokeOpacity={isDarkMode ? 0.35 : 0.4}
          strokeWidth={1.6}
          fill="none"
        />
      </Svg>
    </View>
  );
};

export default React.memo(ConversationHeaderBackground);
