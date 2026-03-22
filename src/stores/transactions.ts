import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Transaction } from '@/types'
import { onTransactions } from '@/services/firestore'
import { TRANSFER_CATEGORY, EXCEPTIONAL_CATEGORY, NON_BUDGET_CATEGORY, INCOME_CATEGORY } from '@/composables/useCategories'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import { computeCycleRange, computeIncomeWindow } from '@/composables/useBillingCycle'
import { startOfDay } from 'date-fns'
import type { Unsubscribe } from 'firebase/firestore'

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])
  let unsub: Unsubscribe | null = null

  const visibleTransactions = computed(() => {
    return transactions.value.filter((t) => {
      if (t.hiddenFromUi) return false
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

  const EXCLUDED_FROM_CYCLE = [TRANSFER_CATEGORY, EXCEPTIONAL_CATEGORY, NON_BUDGET_CATEGORY, INCOME_CATEGORY]

  const cycleSpend = computed(() => {
    return cycleTransactions.value
      .filter((t) => !EXCLUDED_FROM_CYCLE.includes(t.category) && t.chargedAmount < 0)
      .reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
  })

  const cycleIncome = computed(() => {
    const familyStore = useFamilyStore()
    const ui = useUiStore()
    const today = startOfDay(new Date())
    const { incomeAnchorDay, incomeAnchorGraceDays, cycleStartDay } = familyStore.familySettings
    const range = computeCycleRange(today, cycleStartDay, ui.cycleOffset)

    let incomeTxns: typeof visibleTransactions.value

    // If no anchor configured and no grace days, use simple in-cycle income
    if (incomeAnchorDay === null && incomeAnchorGraceDays === 0) {
      incomeTxns = cycleTransactions.value.filter((t) => t.chargedAmount > 0)
    } else {
      // Compute extended income window
      const incomeWin = computeIncomeWindow(range.start, incomeAnchorDay, incomeAnchorGraceDays)
      incomeTxns = visibleTransactions.value.filter((t) => {
        if (t.chargedAmount <= 0) return false
        const d = t.date
        return (d >= range.start && d <= range.end) || (d >= incomeWin.start && d <= incomeWin.end)
      })
    }

    // Deduplicate: per description keep only the first (earliest) occurrence.
    // This prevents counting next month's early salary in this cycle.
    const seen = new Map<string, typeof incomeTxns[0]>()
    for (const t of incomeTxns) {
      const key = (t.description || '').trim().toLowerCase()
      const existing = seen.get(key)
      if (!existing || t.date < existing.date) {
        seen.set(key, t)
      }
    }

    return [...seen.values()].reduce((sum, t) => sum + t.chargedAmount, 0)
  })

  // Descriptions seen only in the current cycle, never in prior history
  const newDescriptions = computed(() => {
    const cycleIds = new Set(cycleTransactions.value.map(t => t.id))
    const historicalDescs = new Set(
      visibleTransactions.value
        .filter(t => !cycleIds.has(t.id))
        .map(t => (t.description || '').trim().toLowerCase())
    )
    const newDescs = new Set<string>()
    for (const t of cycleTransactions.value) {
      const desc = (t.description || '').trim().toLowerCase()
      if (desc && !historicalDescs.has(desc)) {
        newDescs.add(desc)
      }
    }
    return newDescs
  })

  function isNewTransaction(txn: Transaction): boolean {
    return newDescriptions.value.has((txn.description || '').trim().toLowerCase())
  }

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
    cycleIncome,
    isNewTransaction,
    bindTransactions,
    unbind,
  }
})
