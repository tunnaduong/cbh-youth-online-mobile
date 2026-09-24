import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { AuthContext } from '../contexts/AuthContext';
import { giftPoints, getWalletBalance } from '../services/api/Api';

const QUICK_AMOUNTS = [10, 20, 50, 100];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 1000;
const REQUIRED_TIER_POINTS = 150;

/**
 * Gift points to a post's author. The recipient is resolved server-side from
 * `post.id`, so an anonymous author stays anonymous to the sender.
 */
const GiftPointsModal = ({ visible, onClose, post, onSuccess }) => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const { userInfo, setUserInfo } = useContext(AuthContext);
  const [amountText, setAmountText] = useState('10');
  const [note, setNote] = useState('');
  const [balance, setBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isAnonymous = !!post?.anonymous;
  const authorName = isAnonymous
    ? t('giftPoints.anonymousAuthor')
    : post?.author?.profile_name || post?.author?.username || t('giftPoints.author');

  const amount = parseInt(amountText, 10);
  const validAmount = Number.isInteger(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
  const insufficient = balance !== null && validAmount && amount > balance;

  // Only gate client-side when we actually know the balance is too low; the
  // server enforces the tier requirement either way.
  const knownPoints = balance ?? userInfo?.total_points;
  const isAdmin = userInfo?.role === 'admin';
  const hasPrivilege = !!userInfo?.member_tier?.privileges?.includes('gift_points_to_others');
  const blockedByTier =
    !isAdmin && !hasPrivilege && typeof knownPoints === 'number' && knownPoints < REQUIRED_TIER_POINTS;

  useEffect(() => {
    if (!visible) return;
    setAmountText('10');
    setNote('');
    setError(null);
    setBalance(null);
    let cancelled = false;
    getWalletBalance()
      .then((res) => {
        const payload = res?.data ?? res ?? {};
        if (!cancelled && typeof payload.points === 'number') setBalance(payload.points);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!validAmount) {
      setError(t('giftPoints.invalidAmount', { min: MIN_AMOUNT, max: MAX_AMOUNT.toLocaleString() }));
      return;
    }
    if (insufficient) {
      setError(t('giftPoints.insufficient', { points: balance.toLocaleString() }));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await giftPoints({
        topic_id: post.id,
        amount,
        message: note.trim() || undefined,
      });
      const data = res?.data ?? res ?? {};
      if (typeof data.remaining_points === 'number' && userInfo && setUserInfo) {
        setUserInfo({ ...userInfo, total_points: data.remaining_points });
      }
      Toast.show({
        type: 'success',
        text1: t('giftPoints.successTitle', { amount: amount.toLocaleString() }),
        text2: t('giftPoints.successBody', { name: authorName }),
        autoHide: true,
        visibilityTime: 3000,
      });
      onSuccess?.(data);
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || t('giftPoints.errorDefault'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputBg = isDarkMode ? '#374151' : '#f9fafb';

  return (
    <Modal transparent={true} visible={visible} animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.container}>
                <TouchableWithoutFeedback>
                  <View
                    style={[
                      styles.content,
                      { backgroundColor: theme.cardBackground },
                      isDarkMode && { elevation: 0, shadowOpacity: 0 },
                    ]}
                  >
                    <View style={styles.titleRow}>
                      <Ionicons name="gift-outline" size={20} color={theme.primary} />
                      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                        {t('giftPoints.title', { name: authorName })}
                      </Text>
                    </View>

                    {blockedByTier ? (
                      <>
                        <Text style={[styles.description, { color: theme.text }]}>
                          {t('giftPoints.requirement', {
                            required: REQUIRED_TIER_POINTS,
                            points: Number(knownPoints).toLocaleString(),
                          })}
                        </Text>
                        <View style={styles.buttons}>
                          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                            <Text style={[styles.cancelText, { color: theme.subText }]}>{t('giftPoints.close')}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.description, { color: theme.subText }]}>
                          {t('giftPoints.description', { name: authorName })}
                          {balance !== null
                            ? ' ' + t('giftPoints.balance', { points: balance.toLocaleString() })
                            : ''}
                        </Text>

                        <View style={styles.quickRow}>
                          {QUICK_AMOUNTS.map((v) => {
                            const active = amount === v;
                            return (
                              <TouchableOpacity
                                key={v}
                                onPress={() => setAmountText(String(v))}
                                disabled={submitting}
                                style={[
                                  styles.chip,
                                  { borderColor: active ? theme.primary : theme.border },
                                  active && { backgroundColor: theme.primary },
                                ]}
                              >
                                <Text style={{ color: active ? '#fff' : theme.text, fontSize: 14 }}>
                                  {v} {t('giftPoints.pointsUnit')}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <View
                          style={[
                            styles.amountRow,
                            { backgroundColor: inputBg, borderColor: theme.border },
                          ]}
                        >
                          <TextInput
                            style={[styles.amountInput, { color: theme.text }]}
                            keyboardType="number-pad"
                            value={amountText}
                            onChangeText={(v) => setAmountText(v.replace(/[^0-9]/g, ''))}
                            placeholder={t('giftPoints.amountPlaceholder')}
                            placeholderTextColor={theme.subText}
                            editable={!submitting}
                            maxLength={4}
                          />
                          <Text style={{ color: theme.subText, fontSize: 15 }}>{t('giftPoints.pointsUnit')}</Text>
                        </View>

                        <TextInput
                          style={[
                            styles.noteInput,
                            { backgroundColor: inputBg, borderColor: theme.border, color: theme.text },
                          ]}
                          placeholder={t('giftPoints.notePlaceholder')}
                          placeholderTextColor={theme.subText}
                          multiline
                          maxLength={200}
                          value={note}
                          onChangeText={setNote}
                          editable={!submitting}
                        />

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <View style={styles.buttons}>
                          <TouchableOpacity onPress={handleClose} style={styles.cancelButton} disabled={submitting}>
                            <Text style={[styles.cancelText, { color: theme.subText }]}>{t('giftPoints.cancel')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleSubmit}
                            style={[
                              styles.submitButton,
                              { backgroundColor: theme.primary },
                              (!validAmount || insufficient || submitting) && styles.disabled,
                            ]}
                            disabled={!validAmount || insufficient || submitting}
                          >
                            {submitting ? (
                              <ActivityIndicator size="small" color="white" />
                            ) : (
                              <Text style={styles.submitText}>
                                {t('giftPoints.submit', { amount: validAmount ? amount.toLocaleString() : '' })}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
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
    alignItems: 'center',
  },
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  content: {
    width: '88%',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  amountInput: {
    flex: 1,
    height: 46,
    fontSize: 18,
    fontWeight: '600',
  },
  noteInput: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 12,
    fontSize: 15,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 10,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  cancelText: {
    fontSize: 16,
  },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default GiftPointsModal;
