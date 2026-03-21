import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Transaction } from '@/types'
import { onTransactions } from '@/services/firestore'
import { TRANSFER_CATEGORY } from '@/composables/useCategories'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import { computeCycleRange } from '@/composables/useBillingCycle'
import { startOfDay } from 'date-fns'
import type { Unsubscribe } from 'firebase/firestore'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])
  let unsub: Unsubscribe | null = null

  const visibleTransactions = computed(() => {
    const ui = useUiStore()
    return transactions.value.filter((t) => {
      if (t.hiddenFromUi) return false
      if (ui.ownerFilter !== 'all' && t.ownerTag !== ui.ownerFilter) return false
      return true
    })
  })

  const cycleTransactions = computed(() => {
    const ui = useUiStore()
    const familyStore = useFamilyStore()
    const today = startOfDay(new Date())
    const range = computeCycleRange(today, familyStore.familySettings.cycleStartDay, ui.cycleOffset)
    console.log('[transactions store] cycle range:', range.start.toISOString(), '→', range.end.toISOString(), 'cycleStartDay:', familyStore.familySettings.cycleStartDay, 'offset:', ui.cycleOffset)
    console.log('[transactions store] visible count:', visibleTransactions.value.length)
    const filtered = visibleTransactions.value.filter((t) => {
      const d = t.date
      return d >= range.start && d <= range.end
    })
    console.log('[transactions store] cycle filtered count:', filtered.length)
    if (filtered.length === 0 && visibleTransactions.value.length > 0) {
      const sample = visibleTransactions.value.slice(0, 3).map(t => t.date.toISOString())
      console.log('[transactions store] sample dates:', sample)
    }
    return filtered
  })

  const inboxTransactions = computed(() => {
    return cycleTransactions.value.filter((t) => t.status === 'pending_categorization')
  })

  const inboxCount = computed(() => inboxTransactions.value.length)

  const cycleSpend = computed(() => {
    return cycleTransactions.value
      .filter((t) => t.category !== TRANSFER_CATEGORY)
      .reduce((sum, t) => sum + t.chargedAmount, 0)
  })

  function bindTransactions(familyId: string) {
    unbind()
    console.log('[transactions store] binding to family:', familyId)
    unsub = onTransactions(familyId, (txns) => {
      console.log('[transactions store] received', txns.length, 'transactions')
      transactions.value = txns
    })
  }

  function unbind() {
    unsub?.()
    unsub = null
  }

  return {
    transactions,
    visibleTransactions,
    cycleTransactions,
    inboxTransactions,
    inboxCount,
    cycleSpend,
    bindTransactions,
    unbind,
  }
})
