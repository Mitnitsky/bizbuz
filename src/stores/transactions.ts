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

  /**
   * Compute income transactions for a cycle.
   * Income window grabs salary/income that arrives just before the cycle start.
   * In-cycle income counts UNLESS it falls in the NEXT cycle's income window
   * (which means it's that next cycle's salary, not ours).
   */
  function getIncomeForCycle(cycleOffset: number) {
    const familyStore = useFamilyStore()
    const today = startOfDay(new Date())
    const { incomeAnchorDay, incomeAnchorGraceDays, cycleStartDay } = familyStore.familySettings
    const range = computeCycleRange(today, cycleStartDay, cycleOffset)

    if (incomeAnchorDay === null && incomeAnchorGraceDays === 0) {
      return cycleTransactions.value.filter((t) => t.chargedAmount > 0)
    }

    // This cycle's income window (grabs salary arriving before cycle start)
    const incomeWin = computeIncomeWindow(range.start, incomeAnchorDay, incomeAnchorGraceDays)

    // Next cycle's income window (exclude these from our in-cycle range)
    const nextRange = computeCycleRange(today, cycleStartDay, cycleOffset + 1)
    const nextIncomeWin = computeIncomeWindow(nextRange.start, incomeAnchorDay, incomeAnchorGraceDays)

    const incomeTxns = visibleTransactions.value.filter((t) => {
      if (t.chargedAmount <= 0) return false
      const d = t.date

      // If this transaction is in the NEXT cycle's income window, it belongs there, not here
      if (d >= nextIncomeWin.start && d <= nextIncomeWin.end) return false

      // In-cycle income (excluding what belongs to next cycle)
      if (d >= range.start && d <= range.end) return true

      // Income window: grab transactions before cycle start
      return d >= incomeWin.start && d < range.start
    })

    // Deduplicate by transaction ID only (same txn shouldn't appear twice)
    const seen = new Set<string>()
    const unique: typeof incomeTxns = []
    for (const t of incomeTxns) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        unique.push(t)
      }
    }
    return unique
  }

  const cycleIncome = computed(() => {
    const ui = useUiStore()
    return getIncomeForCycle(ui.cycleOffset).reduce((sum, t) => sum + t.chargedAmount, 0)
  })

  const cycleIncomeTransactions = computed(() => {
    const ui = useUiStore()
    return getIncomeForCycle(ui.cycleOffset)
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
