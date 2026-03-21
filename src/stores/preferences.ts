import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { UserPreferences } from '@/types'
import { onUserPreferences } from '@/services/firestore'
import { i18n } from '@/i18n'
import type { Unsubscribe } from 'firebase/firestore'

export const usePreferencesStore = defineStore('preferences', () => {
  const userPreferences = ref<UserPreferences | null>(null)
  const locale = ref('en')
  const themeMode = ref('system')

  let unsub: Unsubscribe | null = null

  watch(
    () => userPreferences.value,
    (prefs) => {
      if (prefs) {
        locale.value = prefs.locale
        themeMode.value = prefs.themeMode
        i18n.global.locale.value = prefs.locale as 'en' | 'he'
      }
    },
    { deep: true },
  )

  function bindPreferences(familyId: string, uid: string) {
    unbind()
    unsub = onUserPreferences(familyId, uid, (prefs) => {
      userPreferences.value = prefs
    })
  }

  function unbind() {
    unsub?.()
    unsub = null
  }

  return {
    userPreferences,
    locale,
    themeMode,
    bindPreferences,
    unbind,
  }
})
