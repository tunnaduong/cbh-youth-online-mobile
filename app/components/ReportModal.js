import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';

const ReportModal = ({ visible, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) return;
    onSubmit(reason);
    setReason('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
              <TouchableWithoutFeedback>
                <View style={styles.content}>
                  <Text style={styles.title}>Báo cáo vi phạm</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập lý do báo cáo (tối thiểu 10 ký tự)..."
                    multiline
                    value={reason}
                    onChangeText={setReason}
                    autoFocus
                  />
                  <View style={styles.buttons}>
                    <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSubmit}
                      style={[styles.submitButton, !reason.trim() && styles.disabled]}
                      disabled={!reason.trim()}
                    >
                      <Text style={styles.submitText}>Gửi báo cáo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    width: '85%',
    backgroundColor: 'white',
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
    color: '#333'
  },
  input: {
    height: 120,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#319527',
    borderRadius: 6
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: '#a5d6a7'
  },
  cancelText: {
    fontWeight: '600',
    color: '#6b7280'
  },
  submitText: {
    fontWeight: '600',
    color: 'white'
  }
});

export default ReportModal;
