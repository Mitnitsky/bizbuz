import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Family, FamilySettings } from '@/types'
import { onFamily, onFamilySettings } from '@/services/firestore'
import type { Unsubscribe } from 'firebase/firestore'

export const useFamilyStore = defineStore('family', () => {
  const family = ref<Family | null>(null)
  const familySettings = ref<FamilySettings>({
    cycleStartDay: 1,
    incomeAnchorDay: null,
    incomeAnchorGraceDays: 3,
    categoryBudgets: {},
    paymentMethodLabels: {},
    paymentMethodOwners: {},
    categoryNameOverrides: {},
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

  function resolveOwnerName(tag: string): string {
    if (ownerTagNames.value[tag]) return ownerTagNames.value[tag]
    if (memberNames.value[tag]) return memberNames.value[tag]
    // If it looks like a Firebase UID, show a friendlier fallback
    if (tag.length > 12) return 'Member'
    return tag
  }

  async function bindFamily(familyId: string) {
    unbind()

    unsubFamily = onFamily(familyId, async (f) => {
      family.value = f
      const names: Record<string, string> = {}
      for (const uid of f.memberUids) {
        names[uid] = f.memberDisplayNames[uid] ?? uid.slice(0, 8)
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
    resolveOwnerName,
    bindFamily,
    unbind,
  }
})
