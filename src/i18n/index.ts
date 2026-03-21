import { createI18n } from 'vue-i18n'
import en from './en'
import he from './he'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, he }
})
