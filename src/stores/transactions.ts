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
  const loaded = ref(false)
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
    return visibleTransactions.value.filter((t) => {
      const d = t.date
      return d >= range.start && d <= range.end
    })
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

  // Deduped income transactions (earliest per description, extended window)
  const cycleIncomeTransactions = computed(() => {
    const familyStore = useFamilyStore()
    const ui = useUiStore()
    const today = startOfDay(new Date())
    const { incomeAnchorDay, incomeAnchorGraceDays, cycleStartDay } = familyStore.familySettings
    const range = computeCycleRange(today, cycleStartDay, ui.cycleOffset)

    let incomeTxns: typeof visibleTransactions.value

    if (incomeAnchorDay === null && incomeAnchorGraceDays === 0) {
      incomeTxns = cycleTransactions.value.filter((t) => t.chargedAmount > 0)
    } else {
      const incomeWin = computeIncomeWindow(range.start, incomeAnchorDay, incomeAnchorGraceDays)
      incomeTxns = visibleTransactions.value.filter((t) => {
        if (t.chargedAmount <= 0) return false
        const d = t.date
        return (d >= range.start && d <= range.end) || (d >= incomeWin.start && d <= incomeWin.end)
      })
    }

    const seen = new Map<string, typeof incomeTxns[0]>()
    for (const t of incomeTxns) {
      const key = (t.description || '').trim().toLowerCase()
      const existing = seen.get(key)
      if (!existing || t.date < existing.date) {
        seen.set(key, t)
      }
    }
    return [...seen.values()]
  })

  // Descriptions that appear in already-categorized transactions → "known"
  const knownDescriptions = computed(() => {
    return new Set(
      visibleTransactions.value
        .filter(t => t.status !== 'pending_categorization')
        .map(t => (t.description || '').trim().toLowerCase())
    )
  })

  // 🦄 Unique = description never seen in any categorized transaction
  function isUniqueTransaction(txn: Transaction): boolean {
    if (txn.status !== 'pending_categorization') return false
    const desc = (txn.description || '').trim().toLowerCase()
    return !!desc && !knownDescriptions.value.has(desc)
  }

  // NEW = from latest ingestion (stored in Firestore)
  function isNewTransaction(txn: Transaction): boolean {
    return txn.isNew === true
  }

  function bindTransactions(familyId: string) {
    unbind()
    loaded.value = false
    console.log('[transactions store] binding to family:', familyId)
    unsub = onTransactions(familyId, (txns) => {
      console.log('[transactions store] received', txns.length, 'transactions')
      transactions.value = txns
      loaded.value = true
    })
  }

  function unbind() {
    unsub?.()
    unsub = null
  }

  return {
    transactions,
    loaded,
    visibleTransactions,
    cycleTransactions,
    inboxTransactions,
    inboxCount,
    cycleSpend,
    cycleIncome,
    cycleIncomeTransactions,
    isNewTransaction,
    isUniqueTransaction,
    bindTransactions,
    unbind,
  }
})
