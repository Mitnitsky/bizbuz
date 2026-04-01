import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SavingsEntry } from '@/types'
import { onSavings } from '@/services/firestore'
import type { Unsubscribe } from 'firebase/firestore'

export const useSavingsStore = defineStore('savings', () => {
  const entries = ref<SavingsEntry[]>([])
  const loaded = ref(false)
  let unsub: Unsubscribe | null = null

  const liquidEntries = computed(() => entries.value.filter((e) => e.savingsType === 'liquid'))
  const lockedEntries = computed(() => entries.value.filter((e) => e.savingsType === 'locked'))
  const liquidTotal = computed(() => liquidEntries.value.reduce((sum, e) => sum + e.amount, 0))
  const lockedTotal = computed(() => lockedEntries.value.reduce((sum, e) => sum + e.amount, 0))

  function bindSavings(familyId: string) {
    unbind()
    loaded.value = false
    unsub = onSavings(familyId, (items) => {
      entries.value = items
      loaded.value = true
    })
  }

  function unbind() {
    unsub?.()
    unsub = null
  }

  return {
    entries,
    loaded,
    liquidEntries,
    lockedEntries,
    liquidTotal,
    lockedTotal,
    bindSavings,
    unbind,
  }
})
