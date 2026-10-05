import React, { useRef } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import LiquidButton from "../LiquidButton";
import { AndroidGlassBackdrop } from "../GlassModules";
import CustomLoading from "../CustomLoading";
import Dropdown from "../Dropdown";
import FastImage from "../FastImage";
import VideoThumbnail from "../VideoThumbnail";
import { TOOLBAR_HEIGHT } from "./MarkdownToolbar";
import {
  PostEditorField,
  PostEditorMentions,
  PostEditorTabs,
  PostEditorToolbar,
} from "./PostEditorParts";

// Everything the create-post and edit-post screens show, so the two can't
// drift apart: the app's floating header (close button + title that fades on
// scroll + the publish/save action), the editor card, the post settings card,
// the attachments card and the primary button. Presentation only - the
// screens keep their own state, pickers and submit logic and pass them in.

// Height of the floating header below the status bar (same as the other
// native screens).
const HEADER_HEIGHT = 64;
// Card padding + screen padding on each side, for the HTML preview's width.
const PREVIEW_PADDING = 32;
const MEDIA_TILE = 104;

// A row of the settings card: round icon, label (+ hint), control on the right.
function SettingRow({ icon, title, hint, last, wide, dimmed, theme, children }) {
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        dimmed && { opacity: 0.6 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.iconBackground }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={wide ? styles.rowTextWide : styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={wide ? 2 : 1}>
          {title}
        </Text>
        {hint ? <Text style={[styles.rowHint, { color: theme.subText }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function PostComposerLayout({
  editor,
  // Header
  headerTitle,
  onClose,
  submitLabel,
  onSubmit,
  submitDisabled = false,
  // Shows the app's loader in place of the form (edit: the post is loading).
  loading = false,
  // { text, actionLabel, onAction, onDismiss } - e.g. "your draft was restored"
  banner,
  // Title + body
  title,
  onChangeTitle,
  titlePlaceholder,
  contentPlaceholder,
  onMarkdownHelp,
  onRulesHelp,
  // Settings
  categoryOptions,
  category,
  onChangeCategory,
  privacyOptions,
  privacy,
  onChangePrivacy,
  anonymous,
  // Leave out to show the switch locked (a post can't change it once made).
  onToggleAnonymous,
  // Attachments: images are [{ uri }], videos [{ uri }], documents [{ name }]
  images = [],
  videos = [],
  documents = [],
  onPickImage,
  onPickVideo,
  onPickDocument,
  onRemoveImage,
  onRemoveVideo,
  onRemoveDocument,
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // The header reads the scroll position: the title fades out and the
  // buttons get their glass surface once content slides under them.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 10, 50],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const headerHeight = HEADER_HEIGHT + insets.top;
  const cardStyle = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  const hasMedia = images.length > 0 || videos.length > 0;
  const actionDisabled = submitDisabled || loading;

  const attachActions = [
    { key: "image", icon: "image-outline", label: t("createPost.addImage"), onPress: onPickImage },
    { key: "video", icon: "videocam-outline", label: t("createPost.addVideo"), onPress: onPickVideo },
    { key: "document", icon: "document-attach-outline", label: t("createPost.addDocument"), onPress: onPickDocument },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating header */}
      <View pointerEvents="box-none" style={styles.headerWrap}>
        <View style={[styles.header, { paddingTop: insets.top, height: headerHeight }]}>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            providerId="PostComposer"
            onPress={onClose}
            accessibilityLabel={t("common.close")}
          >
            <Ionicons name="close" size={24} color={theme.primary} />
          </LiquidButton>
          <Animated.Text
            style={[styles.headerTitle, { color: theme.primary, opacity: headerTitleOpacity }]}
            numberOfLines={1}
          >
            {headerTitle}
          </Animated.Text>
          <LiquidButton
            size={44}
            scrollY={scrollY}
            providerId="PostComposer"
            onPress={onSubmit}
            disabled={actionDisabled}
            style={styles.headerActionButton}
            accessibilityLabel={submitLabel}
          >
            <Text style={[styles.headerAction, { color: actionDisabled ? theme.subText : theme.primary }]}>
              {submitLabel}
            </Text>
          </LiquidButton>
        </View>
      </View>

      <AndroidGlassBackdrop providerId="PostComposer" style={{ flex: 1 }}>
        {loading ? (
          <View style={[styles.loading, { paddingTop: headerHeight }]}>
            <CustomLoading size={56} />
          </View>
        ) : (
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 16,
              paddingTop: headerHeight,
              paddingBottom: insets.bottom + 32 + (editor.toolbarVisible ? TOOLBAR_HEIGHT : 0),
            }}
            bottomOffset={TOOLBAR_HEIGHT + 24}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            // A plain callback (not Animated.event): this scroll view is a
            // Reanimated one, the header's scrollY is a core Animated.Value.
            onScroll={(event) => scrollY.setValue(event.nativeEvent.contentOffset.y)}
          >
            {banner ? (
              <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
                <Ionicons name="document-text-outline" size={18} color={theme.primary} />
                <Text style={[styles.bannerText, { color: theme.text }]}>{banner.text}</Text>
                {banner.onAction && (
                  <TouchableOpacity onPress={banner.onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[styles.bannerAction, { color: theme.primary }]}>{banner.actionLabel}</Text>
                  </TouchableOpacity>
                )}
                {banner.onDismiss && (
                  <TouchableOpacity
                    onPress={banner.onDismiss}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close")}
                  >
                    <Ionicons name="close" size={18} color={theme.subText} />
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Title + body */}
            <View style={[cardStyle, styles.editorCard]}>
              <TextInput
                style={[styles.titleInput, { color: theme.text }]}
                placeholder={titlePlaceholder}
                placeholderTextColor={theme.subText}
                value={title}
                onChangeText={onChangeTitle}
                returnKeyType="next"
                onSubmitEditing={() => {
                  editor.setMode("write");
                  editor.inputRef.current?.focus();
                }}
              />
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <PostEditorTabs editor={editor} />
              <PostEditorField
                editor={editor}
                placeholder={contentPlaceholder}
                previewPadding={PREVIEW_PADDING}
              />
              <View style={[styles.helpRow, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  onPress={onMarkdownHelp}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={[styles.chip, { backgroundColor: theme.iconBackground }]}
                >
                  <Ionicons name="logo-markdown" size={14} color={theme.primary} />
                  <Text style={[styles.chipText, { color: theme.text }]}>{t("createPost.markdown")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onRulesHelp}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={[styles.chip, { backgroundColor: theme.iconBackground }]}
                >
                  <Ionicons name="shield-checkmark-outline" size={14} color={theme.primary} />
                  <Text style={[styles.chipText, { color: theme.text }]}>{t("createPost.rules")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Where it goes and who sees it */}
            <Text style={[styles.sectionTitle, { color: theme.subText }]}>{t("createPost.sectionSettings")}</Text>
            <View style={cardStyle}>
              <SettingRow icon="albums-outline" title={t("createPost.categoryLabel")} theme={theme}>
                <Dropdown
                  options={categoryOptions}
                  placeholder={t("createPost.categoryShort")}
                  selectedValue={category}
                  onValueChange={onChangeCategory}
                  containerStyle={styles.rowDropdownContainer}
                  style={styles.rowDropdown}
                  textStyle={styles.rowDropdownText}
                  arrowSize={16}
                />
              </SettingRow>
              <SettingRow icon={privacy?.icon || "earth"} title={t("createPost.privacyLabel")} theme={theme}>
                <Dropdown
                  options={privacyOptions}
                  placeholder={t("createPost.privacyPublic")}
                  selectedValue={privacy}
                  onValueChange={onChangePrivacy}
                  containerStyle={styles.rowDropdownContainer}
                  style={styles.rowDropdown}
                  textStyle={styles.rowDropdownText}
                  arrowSize={16}
                />
              </SettingRow>
              <SettingRow
                icon={anonymous ? "eye-off" : "eye-off-outline"}
                title={t("createPost.anonymous")}
                hint={t("createPost.anonymousDesc")}
                theme={theme}
                dimmed={!onToggleAnonymous}
                wide
                last
              >
                <Switch
                  value={!!anonymous}
                  onValueChange={onToggleAnonymous}
                  disabled={!onToggleAnonymous}
                  trackColor={{ true: theme.primary }}
                  accessibilityLabel={t("createPost.anonymous")}
                />
              </SettingRow>
            </View>

            {/* Attachments */}
            <Text style={[styles.sectionTitle, { color: theme.subText }]}>{t("createPost.attachments")}</Text>
            <View style={cardStyle}>
              <View style={styles.attachActions}>
                {attachActions.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={[styles.attachAction, { backgroundColor: theme.iconBackground }]}
                  >
                    <Ionicons name={item.icon} size={22} color={theme.primary} />
                    <Text style={[styles.attachLabel, { color: theme.text }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {hasMedia && (
                // Photos and videos share one row so attaching either feels
                // like the same action.
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mediaRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {images.map((image, index) => (
                    <View key={`image-${index}-${image.uri}`} style={styles.mediaTile}>
                      <FastImage
                        source={{ uri: image.uri }}
                        style={[styles.mediaImage, { borderColor: theme.border }]}
                      />
                      <TouchableOpacity
                        onPress={() => onRemoveImage(index)}
                        style={styles.removeBadge}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("createPost.removeAttachment")}
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {videos.map((video, index) => (
                    <VideoThumbnail
                      key={`video-${index}-${video.uri}`}
                      uri={video.uri}
                      width={MEDIA_TILE}
                      height={MEDIA_TILE}
                      borderRadius={14}
                      onRemove={() => onRemoveVideo(index)}
                    />
                  ))}
                </ScrollView>
              )}

              {documents.map((doc, index) => (
                <View
                  key={`document-${index}`}
                  style={[
                    styles.fileRow,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: theme.iconBackground }]}>
                    <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                  </View>
                  <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onRemoveDocument(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t("createPost.removeAttachment")}
                  >
                    <Ionicons name="close-circle" size={22} color={theme.subText} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primary, { backgroundColor: theme.primary }, actionDisabled && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={actionDisabled}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryText}>{submitLabel}</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
        )}
      </AndroidGlassBackdrop>

      {!loading && <PostEditorToolbar editor={editor} />}
      {!loading && <PostEditorMentions editor={editor} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "600", marginHorizontal: 12 },
  headerActionButton: { width: "auto", minWidth: 64, paddingHorizontal: 14 },
  headerAction: { fontSize: 15, fontWeight: "700" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerAction: { fontSize: 13, fontWeight: "700" },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 24,
  },
  editorCard: { padding: 16 },
  titleInput: { fontSize: 20, fontWeight: "700", paddingVertical: 4, paddingHorizontal: 0 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 12, marginBottom: 12 },
  helpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowText: { marginLeft: 12, flexShrink: 0, maxWidth: "55%" },
  rowTextWide: { flex: 1, marginLeft: 12, marginRight: 12 },
  rowTitle: { fontSize: 16 },
  rowHint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowDropdownContainer: { flex: 1, marginVertical: 0, marginLeft: 12 },
  rowDropdown: {
    borderWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  rowDropdownText: { fontSize: 15, textAlign: "right", marginRight: 4 },
  attachActions: { flexDirection: "row", gap: 8, padding: 12 },
  attachAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  attachLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  mediaRow: { gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  mediaTile: { width: MEDIA_TILE, height: MEDIA_TILE },
  mediaImage: {
    width: MEDIA_TILE,
    height: MEDIA_TILE,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 16 },
  fileName: { flex: 1, fontSize: 15 },
  primary: { borderRadius: 12, padding: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
