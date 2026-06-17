import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import vi from './locales/vi.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LANGUAGE_KEY = 'app_language';

const resources = {
  vi: { translation: vi },
  en: { translation: en },
  ru: { translation: ru },
};

const initI18n = async () => {
  try {
    let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (!savedLanguage) {
      const locales = getLocales();
      savedLanguage = locales[0]?.languageCode === 'en' ? 'en' : 'vi';
    }

    await i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3',
        resources,
        lng: savedLanguage,
        fallbackLng: 'vi',
        interpolation: {
          escapeValue: false, // react already safes from xss
        },
      });
  } catch (error) {
    console.error('Error initializing i18n:', error);
  }
};

initI18n();

export const changeLanguage = async (lng) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lng);
  i18n.changeLanguage(lng);
};

export default i18n;
