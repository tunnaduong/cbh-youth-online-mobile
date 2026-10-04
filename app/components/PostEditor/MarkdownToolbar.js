import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";

export const TOOLBAR_HEIGHT = 48;

// Same buttons, same order as GitHub's mobile editor (minus its task list -
// the server's Markdown has no checkbox support, so a numbered list takes
// that slot): B / I / link / image / @ / lists / heading / strike / quote /
// code / code block / undo.
const BUTTONS = [
  { key: "bold", icon: "format-bold" },
  { key: "italic", icon: "format-italic" },
  { key: "link", icon: "link-variant" },
  { key: "image", icon: "image-outline" },
  { key: "mention", icon: "at" },
  { key: "bulletList", icon: "format-list-bulleted" },
  { key: "numberedList", icon: "format-list-numbered" },
  { key: "heading", icon: "format-header-pound" },
  { key: "strikethrough", icon: "format-strikethrough" },
  { key: "quote", icon: "format-quote-close" },
  { key: "code", icon: "code-tags" },
  { key: "codeBlock", icon: "code-braces" },
  { key: "undo", icon: "undo-variant" },
];

// Docked above the keyboard. Taps must never take focus away from the text
// input (that would collapse the keyboard and lose the selection the action
// is about to operate on), hence keyboardShouldPersistTaps="always".
const MarkdownToolbar = ({ onAction, canUndo, imageBusy }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: isDarkMode ? theme.surface : "#F2F3F5",
          borderTopColor: theme.border,
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.content}
      >
        {BUTTONS.map(({ key, icon }) => {
          const disabled = key === "undo" && !canUndo;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t(`createPost.toolbar.${key}`)}
              disabled={disabled}
              // Android hands focus to a tapped focusable view, which would
              // blur the text input and drop the keyboard mid-edit.
              focusable={false}
              onPress={() => onAction(key)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.button,
                pressed && { backgroundColor: isDarkMode ? "#2C2C2C" : "#E4E6EA" },
              ]}
            >
              {key === "image" && imageBusy ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <MaterialCommunityIcons
                  name={icon}
                  size={22}
                  color={disabled ? theme.border : theme.text}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: TOOLBAR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
  content: { paddingHorizontal: 8, alignItems: "center" },
  button: {
    width: 44,
    height: 40,
    marginHorizontal: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MarkdownToolbar;
