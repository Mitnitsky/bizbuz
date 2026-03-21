import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Family, FamilySettings } from '@/types'
import { onFamily, onFamilySettings, getAppUser } from '@/services/firestore'
import type { Unsubscribe } from 'firebase/firestore'

export const useFamilyStore = defineStore('family', () => {
  const family = ref<Family | null>(null)
  const familySettings = ref<FamilySettings>({
    cycleStartDay: 1,
    categoryBudgets: {},
    paymentMethodLabels: {},
    categoryNameOverrides: {},
    categoryOrder: [],
  })
  const memberNames = ref<Record<string, string>>({})

  let unsubFamily: Unsubscribe | null = null
  let unsubSettings: Unsubscribe | null = null

  const ownerTagNames = computed(() => {
    const members = family.value?.memberUids ?? []
    const names: Record<string, string> = { shared: 'Shared' }
    if (members.length > 0) names.userA = memberNames.value[members[0]] ?? members[0]
    if (members.length > 1) names.userB = memberNames.value[members[1]] ?? members[1]
    return names
  })

  async function bindFamily(familyId: string) {
    unbind()

    unsubFamily = onFamily(familyId, async (f) => {
      family.value = f
      // Load member display names (silently skip if no permission to read other users)
      const names: Record<string, string> = {}
      for (const uid of f.memberUids) {
        try {
          const user = await getAppUser(uid)
          if (user) names[uid] = user.displayName ?? user.email
        } catch {
          // Can't read other user's doc — use UID as fallback
          names[uid] = uid.slice(0, 8)
        }
      }
      memberNames.value = names
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
    familySettings,
    memberNames,
    ownerTagNames,
    bindFamily,
    unbind,
  }
})
