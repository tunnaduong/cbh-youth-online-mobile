import React from "react";
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { MarkdownTextInput } from "@expensify/react-native-live-markdown";
import { useTheme } from "../../contexts/ThemeContext";
import MentionSuggestions from "../MentionSuggestions";
import MarkdownToolbar, { TOOLBAR_HEIGHT } from "./MarkdownToolbar";
import PostPreview from "./PostPreview";
import { postMarkdownParser } from "../../utils/postMarkdownParser";
import { autoEmbedYouTubeLinks } from "../../utils/youtubeShare";
import { autoEmbedSoundCloudLinks } from "../../utils/soundcloudShare";

// The rendered pieces of the shared post editor (state lives in
// usePostEditor). Tabs and field go inside the screen's scroll view; the
// toolbar and mention list must be rendered outside it, as siblings at the
// bottom of the screen.

// Write / Preview switch: a pill with two segments, like the app's other
// segmented controls.
export function PostEditorTabs({ editor, style }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.tabsRow, { backgroundColor: theme.iconBackground }, style]}>
      {["write", "preview"].map((key) => {
        const active = editor.mode === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => {
              if (key === "preview") Keyboard.dismiss();
              editor.setMode(key);
            }}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { backgroundColor: theme.background }]}
          >
            <Text style={[styles.tabText, { color: active ? theme.text : theme.subText }]}>
              {t(`createPost.${key}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// The Markdown input, or the preview of it.
export function PostEditorField({ editor, placeholder, inputStyle, previewPadding }) {
  const { theme } = useTheme();
  return (
    <>
      {/* Kept mounted (just hidden) while previewing so the caret position
          and edit history survive a trip to the Preview tab. */}
      <View style={editor.mode === "write" ? undefined : styles.hidden}>
        <MarkdownTextInput
          ref={editor.inputRef}
          style={[styles.contentInput, { color: theme.text }, inputStyle]}
          parser={postMarkdownParser}
          markdownStyle={editor.markdownStyle}
          placeholder={placeholder}
          placeholderTextColor={theme.subText}
          value={editor.postContent}
          onChangeText={editor.handleTextChange}
          onSelectionChange={(e) => {
            editor.selectionRef.current = e.nativeEvent.selection;
          }}
          selection={editor.forcedSelection}
          onFocus={() => editor.setContentFocused(true)}
          onBlur={() => editor.setContentFocused(false)}
          multiline
          textAlignVertical="top"
        />
      </View>

      {editor.mode === "preview" && (
        <PostPreview
          markdown={autoEmbedSoundCloudLinks(autoEmbedYouTubeLinks(editor.postContent))}
          {...(previewPadding !== undefined ? { horizontalPadding: previewPadding } : {})}
        />
      )}
    </>
  );
}

// Formatting toolbar, riding on top of the keyboard. Stays mounted so it
// already tracks the keyboard when it becomes visible.
export function PostEditorToolbar({ editor }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (editor.mode !== "write") return null;
  return (
    <KeyboardStickyView
      style={styles.sticky}
      pointerEvents={editor.toolbarVisible ? "auto" : "none"}
    >
      <View
        style={{
          opacity: editor.toolbarVisible ? 1 : 0,
          // No keyboard to sit on: stay clear of the home indicator.
          paddingBottom: editor.keyboardHeight === 0 ? insets.bottom : 0,
          backgroundColor: theme.sectionBackground,
        }}
      >
        <MarkdownToolbar
          onAction={editor.handleToolbarAction}
          canUndo={editor.canUndo}
          imageBusy={editor.uploadingImages > 0}
        />
      </View>
    </KeyboardStickyView>
  );
}

// Rendered outside the ScrollView - a FlatList (inside MentionSuggestions)
// nested in a ScrollView of the same orientation doesn't get a usable height
// and never shows anything, only warns.
export function PostEditorMentions({ editor }) {
  const insets = useSafeAreaInsets();
  if (!editor.hasContentSuggestions) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: editor.toolbarVisible
          ? (editor.keyboardHeight || insets.bottom) + TOOLBAR_HEIGHT + 8
          : (editor.keyboardHeight || insets.bottom) + 16,
        zIndex: 50,
        elevation: 50,
      }}
      pointerEvents="box-none"
    >
      <MentionSuggestions
        suggestions={editor.contentSuggestions}
        loading={editor.contentSuggestionsLoading}
        onSelect={editor.handleSelectMention}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { display: "none" },
  contentInput: {
    minHeight: 200,
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 24,
  },
  tabsRow: { flexDirection: "row", alignSelf: "flex-start", borderRadius: 999, padding: 3, marginBottom: 12 },
  tab: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
  tabText: { fontSize: 13, fontWeight: "600" },
  sticky: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 40 },
});
