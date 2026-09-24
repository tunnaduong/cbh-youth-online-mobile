import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import EditorSheet from "./EditorSheet";

const normalizeUrl = (value) => {
  const raw = String(value || "").trim();

  if (!raw) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  // Cheap structural check - the server validates properly, this only stops
  // obvious typos before the sticker is added to the canvas.
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(withScheme) ? withScheme : null;
};

/** Attaches an external link sticker to the story. */
const LinkSheet = ({ visible, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) {
      setUrl("");
      setLabel("");
      setError(null);
    }
  }, [visible]);

  const handleSubmit = () => {
    const normalized = normalizeUrl(url);

    if (!normalized) {
      setError(t("story.linkInvalid"));
      return;
    }

    onSubmit({ url: normalized, label: label.trim() });
  };

  return (
    <EditorSheet visible={visible} title={t("story.linkTitle")} onClose={onClose} heightRatio={0.5}>
      <View style={styles.body}>
        <Text style={styles.label}>{t("story.linkUrlLabel")}</Text>
        <TextInput
          value={url}
          onChangeText={(value) => {
            setUrl(value);
            setError(null);
          }}
          placeholder="https://chuyenbienhoa.com"
          placeholderTextColor="rgba(255,255,255,0.45)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          autoFocus
          style={styles.input}
        />

        <Text style={styles.label}>{t("story.linkLabelLabel")}</Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t("story.linkLabelPlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.45)"
          maxLength={60}
          style={styles.input}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.submit} onPress={handleSubmit}>
          <Text style={styles.submitLabel}>{t("story.addSticker")}</Text>
        </TouchableOpacity>
      </View>
    </EditorSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 16,
    gap: 8,
  },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    // See MentionSheet: padding, not a fixed height, keeps the text centred.
    paddingVertical: 13,
    margin: 0,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    fontSize: 15,
  },
  error: {
    color: "#FF6B6B",
    fontSize: 13,
  },
  submit: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  submitLabel: {
    color: "#111",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default LinkSheet;
