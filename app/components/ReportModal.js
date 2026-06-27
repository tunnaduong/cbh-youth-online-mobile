import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, BackHandler } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const ReportModal = ({ visible, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(reason);
    setReason('');
    onClose();
  };

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.container}>
                <TouchableWithoutFeedback>
                  <View style={[styles.content, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.title, { color: theme.text }]}>{t('report.modalTitle')}</Text>
                  <TextInput
                    style={[styles.input, {
                      backgroundColor: isDarkMode ? '#374151' : '#f9fafb',
                      borderColor: theme.border,
                      color: theme.text
                    }]}
                    placeholder={t('report.reasonPlaceholder')}
                    placeholderTextColor={theme.subText}
                    multiline
                    value={reason}
                    onChangeText={setReason}
                    autoFocus
                  />
                  <View style={styles.buttons}>
                    <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                      <Text style={[styles.cancelText, { color: theme.subText }]}>{t('report.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSubmit}
                      style={[styles.submitButton, { backgroundColor: theme.primary }, !reason.trim() && styles.disabled]}
                      disabled={!reason.trim()}
                    >
                      <Text style={styles.submitText}>{t('report.submit')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
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
    width: '85%',
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 20,
    fontSize: 16
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6
  },
  disabled: {
    opacity: 0.5,
  },
  cancelText: {
    fontWeight: '600',
  },
  submitText: {
    fontWeight: '600',
    color: 'white'
  }
});

export default ReportModal;
