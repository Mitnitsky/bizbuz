import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { getEffectiveCategories, categoryDisplayName, TRANSFER_CATEGORY, EXCEPTIONAL_CATEGORY, NON_BUDGET_CATEGORY, INCOME_CATEGORY } from '@/composables/useCategories'
import { computeCycleRange } from '@/composables/useBillingCycle'
import { useUiStore } from '@/stores/ui'
import { startOfDay, format } from 'date-fns'

const EXCLUDED_CATEGORIES = [TRANSFER_CATEGORY, EXCEPTIONAL_CATEGORY, NON_BUDGET_CATEGORY, INCOME_CATEGORY]

function isBudgetExpense(t: { chargedAmount: number; category: string }): boolean {
  return t.chargedAmount < 0 && !EXCLUDED_CATEGORIES.includes(t.category)
}

export function useAiContext() {
  const txnStore = useTransactionsStore()
  const familyStore = useFamilyStore()
  const uiStore = useUiStore()

  const context = computed(() => {
    if (!txnStore.loaded || !familyStore.familyLoaded) return ''

    const categories = getEffectiveCategories(familyStore.familySettings.categories)
    const catName = (id: string) => categoryDisplayName(id, 'he', categories)

    const lines: string[] = []
    const today = startOfDay(new Date())

    // Current cycle info
    const range = computeCycleRange(today, familyStore.familySettings.cycleStartDay, uiStore.cycleOffset)
    lines.push(`📅 תקופה נוכחית: ${format(range.start, 'dd/MM/yyyy')} - ${format(range.end, 'dd/MM/yyyy')}`)
    lines.push(`💰 סה"כ הוצאות תקציביות בתקופה: ₪${Math.round(txnStore.cycleSpend).toLocaleString('he-IL')}`)
    lines.push(`💵 סה"כ הכנסות בתקופה: ₪${Math.round(txnStore.cycleIncome).toLocaleString('he-IL')}`)
    lines.push(`ℹ️ הערה: "הוצאות תקציביות" = לא כולל העברות, חריגים, לא-תקציבי והכנסות`)

    // Budget info per category
    const catBudgets = familyStore.familySettings.categoryBudgets || {}
    const totalBudget = Object.values(catBudgets).reduce((s, v) => s + v, 0)
    if (totalBudget > 0) {
      lines.push(`📊 תקציב חודשי כולל: ₪${Math.round(totalBudget).toLocaleString('he-IL')}`)
      const remaining = totalBudget - txnStore.cycleSpend
      lines.push(`📊 נותר מהתקציב: ₪${Math.round(remaining).toLocaleString('he-IL')}`)
    }

    lines.push('')

    // Category breakdown for current cycle (budget expenses only)
    const cycleBudgetTxns = txnStore.cycleTransactions.filter(isBudgetExpense)
    const catTotals = new Map<string, number>()
    for (const t of cycleBudgetTxns) {
      const cat = t.category || 'other'
      catTotals.set(cat, (catTotals.get(cat) || 0) + Math.abs(t.chargedAmount))
    }
    const sorted = [...catTotals.entries()].sort((a, b) => b[1] - a[1])

    lines.push('📋 פירוט הוצאות תקציביות לפי קטגוריה (תקופה נוכחית):')
    for (const [cat, total] of sorted) {
      const budget = catBudgets[cat]
      const budgetStr = budget ? ` (תקציב: ₪${Math.round(budget).toLocaleString('he-IL')})` : ''
      lines.push(`  ${catName(cat)}: ₪${Math.round(total).toLocaleString('he-IL')}${budgetStr}`)
    }

    // Non-budget categories separately
    const nonBudgetTxns = txnStore.cycleTransactions.filter(t => t.chargedAmount < 0 && EXCLUDED_CATEGORIES.includes(t.category))
    if (nonBudgetTxns.length > 0) {
      const nonBudgetTotal = nonBudgetTxns.reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
      lines.push(`  --- לא תקציבי ---`)
      const nbCatTotals = new Map<string, number>()
      for (const t of nonBudgetTxns) {
        nbCatTotals.set(t.category, (nbCatTotals.get(t.category) || 0) + Math.abs(t.chargedAmount))
      }
      for (const [cat, total] of nbCatTotals) {
        lines.push(`  ${catName(cat)}: ₪${Math.round(total).toLocaleString('he-IL')}`)
      }
      lines.push(`  סה"כ לא-תקציבי: ₪${Math.round(nonBudgetTotal).toLocaleString('he-IL')}`)
    }
    lines.push('')

    // Past cycles comparison (last 3 cycles, using billing cycle periods)
    lines.push('📈 השוואה לתקופות קודמות (הוצאות תקציביות בלבד):')
    for (let i = 0; i < 3; i++) {
      const cycleRange = computeCycleRange(today, familyStore.familySettings.cycleStartDay, uiStore.cycleOffset - i)
      const cycleTxns = txnStore.visibleTransactions.filter(t =>
        t.date >= cycleRange.start && t.date <= cycleRange.end && isBudgetExpense(t)
      )
      const cycleTotal = cycleTxns.reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
      const label = `${format(cycleRange.start, 'dd/MM')} - ${format(cycleRange.end, 'dd/MM/yyyy')}`
      lines.push(`  ${label}: ₪${Math.round(cycleTotal).toLocaleString('he-IL')}`)

      // Category breakdown per cycle
      const mCatTotals = new Map<string, number>()
      for (const t of cycleTxns) {
        const cat = t.category || 'other'
        mCatTotals.set(cat, (mCatTotals.get(cat) || 0) + Math.abs(t.chargedAmount))
      }
      const mSorted = [...mCatTotals.entries()].sort((a, b) => b[1] - a[1])
      for (const [cat, total] of mSorted) {
        lines.push(`    ${catName(cat)}: ₪${Math.round(total).toLocaleString('he-IL')}`)
      }
    }
    lines.push('')

    // Top 10 biggest budget expenses this cycle
    const bigExpenses = [...cycleBudgetTxns]
      .sort((a, b) => a.chargedAmount - b.chargedAmount)
      .slice(0, 10)
    if (bigExpenses.length > 0) {
      lines.push('💸 10 ההוצאות התקציביות הגדולות ביותר בתקופה:')
      for (const t of bigExpenses) {
        const desc = t.overrideDescription || t.description
        const cat = catName(t.category || 'other')
        const date = format(t.date, 'dd/MM')
        lines.push(`  ${date} | ${desc} | ${cat} | ₪${Math.round(Math.abs(t.chargedAmount)).toLocaleString('he-IL')}`)
      }
      lines.push('')
    }

    // Recent transactions (last 30, all types)
    const recent = [...txnStore.visibleTransactions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 30)
    lines.push('🕐 30 פעולות אחרונות (כולל לא-תקציבי):')
    for (const t of recent) {
      const desc = t.overrideDescription || t.description
      const cat = catName(t.category || 'other')
      const date = format(t.date, 'dd/MM')
      const amount = t.chargedAmount < 0
        ? `-₪${Math.round(Math.abs(t.chargedAmount)).toLocaleString('he-IL')}`
        : `+₪${Math.round(t.chargedAmount).toLocaleString('he-IL')}`
      const tag = EXCLUDED_CATEGORIES.includes(t.category) ? ' [לא-תקציבי]' : ''
      lines.push(`  ${date} | ${desc} | ${cat} | ${amount}${tag}`)
    }

    return lines.join('\n')
  })

  return { context }
}
