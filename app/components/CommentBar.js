import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Image,
} from "react-native";
// @expo/vector-icons (not react-native-vector-icons) - its fonts are loaded
// via expo-font and don't need a native rebuild to pick up newer glyphs, so
// icons here don't silently fall back to a "missing glyph" box (as happened
// with "glasses-outline") after a JS-only icon-set version bump.
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import { LiquidGlassView } from "./GlassModules";

const isIOS = Platform.OS === "ios";
const isAndroid = Platform.OS === "android";
const RootView = View;

// Runs on the UI thread (native, not JS) on every keystroke inside
// MarkdownTextInput - flags "@username" tokens as 'mention-user' so they get
// colored live via markdownStyle.mentionUser below. This replaces an earlier
// JS-side "transparent TextInput + absolutely-positioned Text overlay" hack
// that had to redo a full text layout pass on every keystroke and was
// visibly laggy on mid/low-end Android; coloring here happens natively in
// the text renderer itself instead.
function makeMentionParser(allowBroadcastMention) {
  return function mentionParser(input) {
    "worklet";
    // MarkdownTextInput requires `parser` to be a worklet (it checks
    // `__workletHash` and throws "parser is not a worklet" otherwise) - it
    // runs on its own dedicated "LiveMarkdownRuntime", not the JS thread, so
    // the directive above is mandatory, not optional. Guard the body in a
    // try/catch so a bad regex match can't throw across the worklet
    // boundary and take the runtime down with it.
    try {
      const ranges = [];
      // \w is ASCII-only, so a mention using Vietnamese characters (diacritics
      // like "@Tuấn") never matched here either, staying uncolored while typing.
      // \p{L}/\p{N} match any Unicode letter/digit (English still matches fine,
      // since those are Unicode letters/digits too), \p{M} covers combining
      // diacritical marks for text still in decomposed (NFD) form.
      const regex = /@[\p{L}\p{N}\p{M}_.-]+/gu;
      let match;
      while ((match = regex.exec(input)) !== null) {
        // @all only means something in a group chat - in a 1-on-1
        // conversation there's no one to broadcast to, so it shouldn't
        // highlight as a live mention while typing either.
        if (!allowBroadcastMention && match[0].toLowerCase() === "@all") continue;
        ranges.push({ start: match.index, length: match[0].length, type: "mention-user" });
      }
      return ranges;
    } catch (e) {
      return [];
    }
  };
}

const CommentBar = React.forwardRef(
  (
    {
      placeholderText,
      onSubmit,
      onChangeText,
      value,
      onKeyPress,
      disabled,
      editable = true,
      isSubmitting = false,
      isAnonymous = false,
      onToggleAnonymous,
      anonymousDisabled = false,
      statusText,
      onClearStatus,
      style,
      leftAccessory,
      onPickImage,
      selectedImages,
      onClearImage,
      nativeID,
      // When the parent already renders its own single glass layer behind
      // this whole bar (e.g. ConversationScreen's floating input block), the
      // pill itself should stay fully transparent instead of also rendering
      // its own glass on top of that.
      androidTransparentPill = false,
      allowBroadcastMention = true,
    },
    ref
  ) => {
    const { theme, isDarkMode } = useTheme();
    const { t } = useTranslation();
    const mentionParser = React.useMemo(
      () => makeMentionParser(allowBroadcastMention),
      [allowBroadcastMention]
    );
    const useGlass = !!LiquidGlassView && !(isAndroid && androidTransparentPill);
    // The pill's content must be real React children of <LiquidGlassView> for
    // the library to capture the backdrop correctly and composite them
    // crisply on top - not a sibling drawn over an absoluteFill glass layer
    // (that let the input/buttons get swept into the captured-and-blurred
    // backdrop too, in addition to rendering normally).
    const PillWrapper = useGlass ? LiquidGlassView : View;

    const inputTextStyle = {
      fontSize: 14,
      flex: 1,
      color: theme.text,
      minHeight: isAndroid ? 34 : 28,
      paddingTop: isAndroid ? 9 : 5,
      paddingBottom: isAndroid ? 9 : 5,
      paddingHorizontal: 2,
    };

    return (
      <RootView
        style={[
          {
            paddingHorizontal: 20, // narrower width
            paddingBottom: isAndroid ? 14 : isIOS ? 4 : 0,
            paddingTop: isAndroid ? 14 : isIOS ? 2 : 0,
            width: "100%",
            backgroundColor: "transparent",
          },
          style,
        ]}
      >
        {selectedImages?.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 8,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 22,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            }}
          >
            {selectedImages.map((uri, index) => (
              <View key={index} style={{ position: "relative" }}>
                <Image
                  source={{ uri }}
                  style={{ width: 56, height: 56, borderRadius: 8 }}
                  resizeMode="cover"
                />
                {onClearImage ? (
                  <TouchableOpacity
                    onPress={() => onClearImage(index)}
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: isDarkMode ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.6)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={11} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {statusText ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 22,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              backgroundColor: isDarkMode ? "rgba(52, 148, 44, 0.95)" : "rgba(255,255,255,0.95)",
            }}
          >
            <Text style={{ color: theme.subText, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {statusText}
            </Text>
            {onClearStatus ? (
              <TouchableOpacity
                onPress={onClearStatus}
                style={{
                  marginLeft: 10,
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 16,
                  backgroundColor: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                }}
              >
                <Ionicons name="close" size={16} color={theme.subText} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <PillWrapper
          {...(useGlass ? { variant: "regular", borderRadius: 30 } : {})}
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: useGlass || (isAndroid && androidTransparentPill)
                ? "transparent"
                : isDarkMode
                ? "rgba(18, 18, 18, 0.85)"
                : "rgba(255, 255, 255, 0.75)",
              borderRadius: 30, // floating pill shape
              padding: 4,
              borderWidth: isAndroid && androidTransparentPill ? 0 : StyleSheet.hairlineWidth,
              borderColor: theme.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            },
            // Android's `elevation` shadow is drawn by the OS against the
            // view's rectangular bounding box, ignoring borderRadius/
            // overflow:hidden clipping entirely - it pokes a flat-edged
            // rectangle out past this pill's rounded corners in both themes
            // (worse the taller the pill grows, e.g. typing a 2nd line).
            // Drop it on Android across the board; the border already gives
            // the pill definition, and iOS's shadow* props render correctly
            // without this issue so they're left alone.
            !isIOS && { elevation: 0, shadowOpacity: 0 },
          ]}
        >
          <View
            style={{
              backgroundColor: isIOS
                ? "rgba(150,150,150,0.15)"
                : isDarkMode
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.05)",
              borderRadius: 25,
              padding: 7,
              paddingHorizontal: 15,
              flexDirection: "row",
              flex: 1,
              alignItems: "center",
            }}
          >
            {leftAccessory ? (
              <View style={{ marginRight: 8, alignItems: "center", justifyContent: "center" }}>
                {leftAccessory}
              </View>
            ) : null}
            <MarkdownTextInput
              style={inputTextStyle}
              parser={mentionParser}
              markdownStyle={{
                mentionUser: { color: "#22c55e", backgroundColor: "transparent" },
              }}
              placeholder={placeholderText}
              placeholderTextColor={theme.subText}
              multiline={true}
              ref={ref}
              onChangeText={onChangeText}
              value={value}
              onKeyPress={onKeyPress}
              editable={editable}
              nativeID={nativeID}
              cursorColor={theme.text}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 5 }}>
            {onPickImage && (
              <TouchableOpacity
                style={{
                  marginRight: 4,
                  backgroundColor: isIOS
                    ? "rgba(150,150,150,0.15)"
                    : isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.05)",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={onPickImage}
              >
                <Ionicons
                  name={selectedImages?.length > 0 ? "image" : "image-outline"}
                  size={20}
                  color={selectedImages?.length > 0 ? theme.primary : theme.text}
                />
              </TouchableOpacity>
            )}
            {onToggleAnonymous && (
              <TouchableOpacity
                style={{
                  marginRight: 8,
                  opacity: anonymousDisabled ? 0.5 : 1,
                  backgroundColor: isIOS
                    ? "rgba(150,150,150,0.15)"
                    : isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.05)",
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={onToggleAnonymous}
                disabled={anonymousDisabled}
              >
                <Ionicons
                  name={isAnonymous ? "glasses" : "glasses-outline"}
                  size={20}
                  color={isAnonymous ? theme.primary : theme.text}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: disabled
                  ? "transparent"
                  : isIOS
                  ? "rgba(150,150,150,0.15)"
                  : isDarkMode
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
                width: 36,
                height: 36,
                borderRadius: 18,
              }}
              onPress={() => {
                // On Android, blur first to commit any pending IME composition,
                // then send after one frame so onChangeText fires with the full text.
                if (isAndroid && ref?.current) {
                  ref.current.blur();
                  setTimeout(onSubmit, 100);
                } else {
                  onSubmit();
                }
              }}
              disabled={disabled}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons
                  name={"send"}
                  size={20}
                  color={
                    disabled
                      ? theme.subText
                      : theme.primary
                  }
                  style={{ marginLeft: 2 }} // center the send icon slightly
                />
              )}
            </TouchableOpacity>
          </View>
        </PillWrapper>
      </RootView>
    );
  }
);

export default CommentBar;
