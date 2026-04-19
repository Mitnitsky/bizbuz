import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { getEffectiveCategories, categoryDisplayName } from '@/composables/useCategories'
import { computeCycleRange } from '@/composables/useBillingCycle'
import { useUiStore } from '@/stores/ui'
import { startOfDay, format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { he } from 'date-fns/locale'

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
    lines.push(`💰 סה"כ הוצאות בתקופה: ₪${Math.round(txnStore.cycleSpend).toLocaleString('he-IL')}`)
    lines.push(`💵 סה"כ הכנסות בתקופה: ₪${Math.round(txnStore.cycleIncome).toLocaleString('he-IL')}`)

    // Budget info
    const catBudgets = familyStore.familySettings.categoryBudgets || {}
    const totalBudget = Object.values(catBudgets).reduce((s, v) => s + v, 0)
    if (totalBudget > 0) {
      lines.push(`📊 תקציב חודשי כולל: ₪${Math.round(totalBudget).toLocaleString('he-IL')}`)
      const remaining = totalBudget - txnStore.cycleSpend
      lines.push(`📊 נותר מהתקציב: ₪${Math.round(remaining).toLocaleString('he-IL')}`)
    }

    lines.push('')

    // Category breakdown for current cycle
    const cycleTxns = txnStore.cycleTransactions.filter(t => t.chargedAmount < 0)
    const catTotals = new Map<string, number>()
    for (const t of cycleTxns) {
      const cat = t.category || 'other'
      catTotals.set(cat, (catTotals.get(cat) || 0) + Math.abs(t.chargedAmount))
    }
    const sorted = [...catTotals.entries()].sort((a, b) => b[1] - a[1])

    lines.push('📋 פירוט הוצאות לפי קטגוריה (תקופה נוכחית):')
    for (const [cat, total] of sorted) {
      lines.push(`  ${catName(cat)}: ₪${Math.round(total).toLocaleString('he-IL')}`)
    }
    lines.push('')

    // Monthly trends (last 3 months)
    lines.push('📈 מגמות חודשיות (3 חודשים אחרונים):')
    for (let i = 0; i < 3; i++) {
      const monthDate = subMonths(today, i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      const monthTxns = txnStore.visibleTransactions.filter(t =>
        t.chargedAmount < 0 && t.date >= monthStart && t.date <= monthEnd
      )
      const monthTotal = monthTxns.reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
      const monthLabel = format(monthDate, 'MMMM yyyy', { locale: he })
      lines.push(`  ${monthLabel}: ₪${Math.round(monthTotal).toLocaleString('he-IL')}`)
    }
    lines.push('')

    // Top 10 biggest expenses this cycle
    const bigExpenses = [...cycleTxns]
      .sort((a, b) => a.chargedAmount - b.chargedAmount)
      .slice(0, 10)
    if (bigExpenses.length > 0) {
      lines.push('💸 10 ההוצאות הגדולות ביותר בתקופה:')
      for (const t of bigExpenses) {
        const desc = t.overrideDescription || t.description
        const cat = catName(t.category || 'other')
        const date = format(t.date, 'dd/MM')
        lines.push(`  ${date} | ${desc} | ${cat} | ₪${Math.round(Math.abs(t.chargedAmount)).toLocaleString('he-IL')}`)
      }
      lines.push('')
    }

    // Recent transactions (last 20)
    const recent = [...txnStore.visibleTransactions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20)
    lines.push('🕐 20 פעולות אחרונות:')
    for (const t of recent) {
      const desc = t.overrideDescription || t.description
      const cat = catName(t.category || 'other')
      const date = format(t.date, 'dd/MM')
      const amount = t.chargedAmount < 0
        ? `-₪${Math.round(Math.abs(t.chargedAmount)).toLocaleString('he-IL')}`
        : `+₪${Math.round(t.chargedAmount).toLocaleString('he-IL')}`
      lines.push(`  ${date} | ${desc} | ${cat} | ${amount}`)
    }

    return lines.join('\n')
  })

  return { context }
}
