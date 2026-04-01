import { createI18n } from 'vue-i18n'
import en from './en'
import he from './he'

// Restore saved locale from localStorage before creating i18n
const savedLocale = (typeof localStorage !== 'undefined' && localStorage.getItem('bizbuz-locale')) || 'en'

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { en, he }
})
