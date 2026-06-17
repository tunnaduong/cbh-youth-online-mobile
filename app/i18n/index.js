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
      savedLanguage = 'vi';
    }

    if (!resources[savedLanguage]) {
      savedLanguage = 'vi';
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
  const nextLanguage = resources[lng] ? lng : 'vi';
  await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  i18n.changeLanguage(nextLanguage);
};

export default i18n;
