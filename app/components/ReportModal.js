import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { tint } from './settings/SettingsUI';

const ReportModal = ({ visible, onClose, onSubmit, title }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const handleSubmit = async () => {
    if (!reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(reason);
      setReason('');
      onClose();
    } catch (e) {
      // Keep the modal open on failure so the user can see the error
      // (surfaced via the caller's own Alert/Toast) and retry.
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.container}>
                <TouchableWithoutFeedback>
                  <View style={[styles.content, { backgroundColor: theme.surface || theme.cardBackground, borderColor: isDarkMode ? '#282B34' : '#E2E8F0' }, isDarkMode && { elevation: 0, shadowOpacity: 0 }]}>
                    <View style={[styles.iconHolder, { backgroundColor: tint('#EF4444', isDarkMode) }]}>
                      <Ionicons name="flag" size={24} color="#EF4444" />
                    </View>
                    <Text style={[styles.title, { color: theme.text }]}>{title || t('report.modalTitle')}</Text>
                    <TextInput
                      style={[styles.input, {
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F8FAFC',
                        borderColor: isDarkMode ? '#282B34' : '#E2E8F0',
                        color: theme.text
                      }]}
                      placeholder={t('report.reasonPlaceholder')}
                      placeholderTextColor={theme.subText}
                      multiline
                      value={reason}
                      onChangeText={setReason}
                      autoFocus
                      editable={!submitting}
                    />
                    <View style={styles.buttons}>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={[styles.cancelButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}
                        disabled={submitting}
                      >
                        <Text style={[styles.cancelText, { color: theme.text }]}>{t('report.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        style={[styles.submitButton, { backgroundColor: '#EF4444' }, (!reason.trim() || submitting) && styles.disabled]}
                        disabled={!reason.trim() || submitting}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.submitText}>{t('report.submit')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  content: {
    width: '88%',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    alignItems: 'stretch',
    shadowColor: "#0F172A",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  iconHolder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    textAlignVertical: 'top',
    marginBottom: 18,
    fontSize: 15
  },
  buttons: {
    flexDirection: 'row',
    gap: 10
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 999
  },
  disabled: {
    opacity: 0.5,
  },
  cancelText: {
    fontWeight: '700',
  },
  submitText: {
    fontWeight: '700',
    color: 'white'
  }
});

export default ReportModal;
