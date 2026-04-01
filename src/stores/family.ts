import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Family, FamilySettings } from '@/types'
import { onFamily, onFamilySettings } from '@/services/firestore'
import { useI18n } from 'vue-i18n'
import type { Unsubscribe } from 'firebase/firestore'

export const useFamilyStore = defineStore('family', () => {
  const { t, locale } = useI18n()
  const family = ref<Family | null>(null)
  const familyLoaded = ref(false)
  const familySettings = ref<FamilySettings>({
    cycleStartDay: 1,
    incomeAnchorDay: null,
    incomeAnchorGraceDays: 3,
    categoryBudgets: {},
    paymentMethodLabels: {},
    paymentMethodOwners: {},
    categoryNameOverrides: {},
    categories: [],
  })

  // Locale-aware member names
  const memberNames = computed(() => {
    const f = family.value
    if (!f) return {} as Record<string, string>
    const names: Record<string, string> = {}
    const isHe = locale.value === 'he'
    for (const uid of f.memberUids) {
      const heName = f.memberDisplayNamesHe?.[uid]
      const enName = f.memberDisplayNames[uid]
      names[uid] = (isHe ? (heName || enName) : (enName || heName)) ?? uid.slice(0, 8)
    }
    return names
  })

  // Locale-aware family name
  const familyName = computed(() => {
    const f = family.value
    if (!f) return ''
    const isHe = locale.value === 'he'
    return (isHe ? (f.nameHe || f.name) : (f.name || f.nameHe)) ?? ''
  })

  let unsubFamily: Unsubscribe | null = null
  let unsubSettings: Unsubscribe | null = null

  const ownerTagNames = computed(() => {
    const members = family.value?.memberUids ?? []
    const names: Record<string, string> = { shared: t('ownerFilter.shared') }
    if (members.length > 0) names.userA = memberNames.value[members[0]] ?? members[0]
    if (members.length > 1) names.userB = memberNames.value[members[1]] ?? members[1]
    return names
  })

  function resolveOwnerName(tag: string): string {
    if (ownerTagNames.value[tag]) return ownerTagNames.value[tag]
    if (memberNames.value[tag]) return memberNames.value[tag]
    if (tag.length > 12) return t('common.name')
    return tag
  }

  async function bindFamily(familyId: string) {
    unbind()
    familyLoaded.value = false

    unsubFamily = onFamily(familyId, async (f) => {
      family.value = f
      familyLoaded.value = true
    })

    unsubSettings = onFamilySettings(familyId, (s) => {
      familySettings.value = s
    })
  }

  function unbind() {
    unsubFamily?.()
    unsubSettings?.()
    unsubFamily = null
    unsubSettings = null
  }

  return {
    family,
    familyLoaded,
    familySettings,
    memberNames,
    familyName,
    ownerTagNames,
    resolveOwnerName,
    bindFamily,
    unbind,
  }
})
