import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { getNameEffect, normalizeTheme } from "../../utils/profileTheme";
import { useNameFont } from "../../utils/nameFonts";

/**
 * Tên hiển thị theo kiểu tên (phông + hiệu ứng) trong theme của người dùng.
 * Không có theme thì là một <Text> bình thường.
 *
 * Props:
 *   theme   - `theme`/`profile_theme` của người dùng từ API, hoặc null
 *   variant - "full": phông + hiệu ứng (trang cá nhân, xem trước)
 *             "compact": chỉ phông - như cách Discord hiện tên trong danh
 *             sách dài (bài viết, bình luận, chat) cho đỡ rối mắt. Web hiện
 *             hiệu ứng khi rê chuột; điện thoại không có rê chuột.
 *   style, numberOfLines, ...rest - như <Text>
 *
 * "compact" luôn là một <Text>, lồng được trong <Text> khác. "full" với hiệu
 * ứng chuyển màu/hoạt hình là một <View> (chữ vẽ bằng SVG) - đặt nó đứng riêng,
 * không lồng trong <Text>.
 */
const StyledName = ({ theme, variant = "full", style, numberOfLines, children, ...rest }) => {
  const normalized = normalizeTheme(theme);
  const font = useNameFont(normalized?.name_font);

  if (!normalized) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {children}
      </Text>
    );
  }

  const flat = StyleSheet.flatten(style) || {};
  const fontSize = flat.fontSize || 14;
  // Custom fonts already carry their weight; asking iOS for a bold variant of
  // a single-weight family makes it fall back to the system font.
  const fontStyle = font
    ? {
        fontFamily: font.family,
        fontWeight: "normal",
        fontSize: fontSize * font.scale,
        ...(flat.lineHeight ? { lineHeight: flat.lineHeight * font.scale } : null),
        ...(font.letterSpacing ? { letterSpacing: font.letterSpacing } : null),
      }
    : null;
  const effect = variant === "full" ? getNameEffect(normalized, fontSize) : null;
  const textStyle = [style, fontStyle, effect?.style];

  if (effect?.gradient || effect?.toon) {
    return (
      <SvgName textStyle={textStyle} effect={effect} numberOfLines={numberOfLines} {...rest}>
        {children}
      </SvgName>
    );
  }

  return (
    <Text style={textStyle} numberOfLines={numberOfLines} {...rest}>
      {children}
    </Text>
  );
};

let gradientCounter = 0;

/**
 * Lays the name out as a normal (invisible) <Text> - so wrapping, alignment
 * and the parent's layout behave exactly as for any other name - then paints
 * each laid-out line on top with SVG, which can do what RN text can't: fill
 * with a gradient, or stroke an outline.
 */
function SvgName({ textStyle, effect, numberOfLines, children, ...rest }) {
  const [lines, setLines] = useState(null);
  const [box, setBox] = useState(null);
  const gradientId = useRef(`name-gradient-${++gradientCounter}`).current;
  const flat = StyleSheet.flatten(textStyle) || {};
  const fontSize = flat.fontSize || 14;

  const svgFont = {
    fontFamily: flat.fontFamily,
    fontSize,
    fontWeight: flat.fontWeight || "normal",
    letterSpacing: flat.letterSpacing,
  };

  const renderLines = (props, dy = 0) =>
    lines.map((line, index) => (
      <SvgText key={index} x={line.x} y={line.y + line.ascender + dy} {...svgFont} {...props}>
        {line.text.replace(/\n$/, "")}
      </SvgText>
    ));

  return (
    <View style={styles.svgWrap} {...rest}>
      <Text
        style={[
          textStyle,
          { color: "transparent", textShadowColor: "transparent" },
        ]}
        numberOfLines={numberOfLines}
        onTextLayout={(e) => setLines(e.nativeEvent.lines)}
        onLayout={(e) => setBox(e.nativeEvent.layout)}
      >
        {children}
      </Text>
      {lines && box ? (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={box.width}
          height={box.height + fontSize * 0.2}
        >
          {effect.gradient ? (
            <>
              <Defs>
                <LinearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2={box.width}
                  y2="0"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={effect.gradient[0]} />
                  <Stop offset="0.5" stopColor={effect.gradient[1]} />
                  <Stop offset="1" stopColor={effect.gradient[0]} />
                </LinearGradient>
              </Defs>
              {renderLines({ fill: `url(#${gradientId})` })}
            </>
          ) : (
            <>
              {/* Drop shadow, then the outline, then the fill on top - the
                  web's paint-order: stroke fill. */}
              {renderLines(
                {
                  fill: effect.toon.outline,
                  stroke: effect.toon.outline,
                  strokeWidth: fontSize * 0.12,
                  strokeLinejoin: "round",
                },
                fontSize * 0.09
              )}
              {renderLines({
                fill: effect.toon.fill,
                stroke: effect.toon.outline,
                strokeWidth: fontSize * 0.12,
                strokeLinejoin: "round",
              })}
              {renderLines({ fill: effect.toon.fill })}
            </>
          )}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Lets a long name shrink inside a row instead of pushing past it.
  svgWrap: { flexShrink: 1, maxWidth: "100%" },
});

export default StyledName;
