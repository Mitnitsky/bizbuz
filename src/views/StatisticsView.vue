<script setup lang="ts">
import { ref, computed } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import { useTransactionsStore } from '@/stores/transactions'
import { usePreferencesStore } from '@/stores/preferences'
import { useFamilyStore } from '@/stores/family'
import {
  TRANSFER_CATEGORY,
  NON_BUDGET_CATEGORY,
  EXCEPTIONAL_CATEGORY,
  INCOME_CATEGORY,
  DEFAULT_CATEGORY,
  categoryDisplayName,
  getEffectiveCategories,
} from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const { t } = useI18n()
const txnStore = useTransactionsStore()
const prefsStore = usePreferencesStore()
const familyStore = useFamilyStore()

const EXCLUDED_CATS = [TRANSFER_CATEGORY, NON_BUDGET_CATEGORY, EXCEPTIONAL_CATEGORY, INCOME_CATEGORY]
const COLORS = [
  '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#eab308', '#22c55e',
  '#64748b', '#d946ef', '#0ea5e9', '#f43f5e', '#78716c',
]

const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const years = computed(() => {
  const yrs = new Set<number>()
  txnStore.transactions.forEach((t) => yrs.add(t.date.getFullYear()))
  if (!yrs.has(currentYear)) yrs.add(currentYear)
  return [...yrs].sort((a, b) => b - a)
})

// All expenses for the selected year
const yearTransactions = computed(() => {
  return txnStore.transactions.filter((t) => {
    if (t.hiddenFromUi) return false
    if (t.date.getFullYear() !== selectedYear.value) return false
    if (EXCLUDED_CATS.includes(t.category)) return false
    if (t.chargedAmount >= 0) return false
    return true
  })
})

// Months array for x-axis
const months = computed(() => {
  const result: { start: Date; end: Date; label: string }[] = []
  for (let m = 0; m < 12; m++) {
    const d = new Date(selectedYear.value, m, 1)
    result.push({
      start: startOfMonth(d),
      end: endOfMonth(d),
      label: format(d, 'MMM'),
    })
  }
  return result
})

// Yearly pie chart data
const yearlyByCategory = computed(() => {
  const grouped: Record<string, number> = {}
  for (const txn of yearTransactions.value) {
    const cat = txn.category || DEFAULT_CATEGORY
    grouped[cat] = (grouped[cat] ?? 0) + Math.abs(txn.chargedAmount)
  }
  return Object.entries(grouped)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
})

const yearlyTotal = computed(() => yearlyByCategory.value.reduce((s, d) => s + d.amount, 0))

const pieData = computed(() => ({
  labels: yearlyByCategory.value.map(d =>
    categoryDisplayName(d.category, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides)
  ),
  datasets: [{
    data: yearlyByCategory.value.map(d => d.amount),
    backgroundColor: yearlyByCategory.value.map((_d, i) => COLORS[i % COLORS.length]),
    borderWidth: 0,
  }],
}))

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: number }) => {
          const pct = yearlyTotal.value > 0 ? ((ctx.parsed / yearlyTotal.value) * 100).toFixed(1) : '0'
          return `${pct}% – ${formatCurrency(ctx.parsed)}`
        },
      },
    },
  },
}

// Top categories for monthly breakdown
const topCategories = computed(() => {
  return yearlyByCategory.value.slice(0, 15).map(d => d.category)
})

// Monthly bar chart data
const barData = computed(() => {
  const datasets = topCategories.value.map((cat, idx) => {
    const data = months.value.map((month) => {
      let sum = 0
      for (const txn of yearTransactions.value) {
        if (txn.category !== cat) continue
        if (isWithinInterval(txn.date, { start: month.start, end: month.end })) {
          sum += Math.abs(txn.chargedAmount)
        }
      }
      return Math.round(sum)
    })
    return {
      label: categoryDisplayName(cat, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides),
      data,
      backgroundColor: COLORS[idx % COLORS.length],
    }
  })
  return {
    labels: months.value.map(m => m.label),
    datasets,
  }
})

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 10 } } },
    tooltip: {
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        label: (ctx: any) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
      },
    },
  },
  scales: {
    x: { stacked: true },
    y: { stacked: true, ticks: { callback: (v: string | number) => `₪${Number(v).toLocaleString()}` } },
  },
}

// Per-category monthly line data for individual charts
const categoryMonthlyData = computed(() => {
  return topCategories.value.map((cat, idx) => {
    const data = months.value.map((month) => {
      let sum = 0
      for (const txn of yearTransactions.value) {
        if (txn.category !== cat) continue
        if (isWithinInterval(txn.date, { start: month.start, end: month.end })) {
          sum += Math.abs(txn.chargedAmount)
        }
      }
      return Math.round(sum)
    })
    const total = data.reduce((s, v) => s + v, 0)
    return {
      category: cat,
      displayName: categoryDisplayName(cat, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides),
      color: COLORS[idx % COLORS.length],
      total,
      chartData: {
        labels: months.value.map(m => m.label),
        datasets: [{
          label: categoryDisplayName(cat, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides),
          data,
          backgroundColor: COLORS[idx % COLORS.length],
        }],
      },
    }
  }).filter(d => d.total > 0)
})

const categoryBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        label: (ctx: any) => formatCurrency(ctx.parsed.y ?? 0),
      },
    },
  },
  scales: {
    y: { ticks: { callback: (v: string | number) => `₪${Number(v).toLocaleString()}` } },
  },
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full px-4 py-6">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-200">{{ t('statistics.title') }}</h1>
      <select
        v-model="selectedYear"
        class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 px-3 py-1.5 text-sm"
      >
        <option v-for="yr in years" :key="yr" :value="yr">{{ yr }}</option>
      </select>
    </div>

    <div v-if="yearTransactions.length === 0" class="text-center py-20 text-gray-400">
      <p class="text-lg">{{ t('statistics.noData') }}</p>
    </div>

    <template v-else>
      <!-- Yearly Distribution Pie -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-6">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          {{ t('statistics.yearlyDistribution') }} – {{ selectedYear }}
        </h3>
        <div class="flex flex-col md:flex-row gap-8 items-start">
          <div class="w-56 h-56 shrink-0 mx-auto md:mx-0">
            <Doughnut :data="pieData" :options="pieOptions" />
          </div>
          <div class="category-breakdown-list flex-1 min-w-0 space-y-1 max-h-64 overflow-y-auto pe-4">
            <div
              v-for="(item, idx) in yearlyByCategory"
              :key="item.category"
              class="flex items-center gap-2 text-sm"
            >
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: COLORS[idx % COLORS.length] }"></span>
              <span class="truncate text-gray-700 dark:text-gray-300">
                {{ categoryDisplayName(item.category, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}
              </span>
              <span class="ms-auto text-gray-500 dark:text-gray-400 shrink-0">
                {{ yearlyTotal > 0 ? ((item.amount / yearlyTotal) * 100).toFixed(1) : 0 }}%
              </span>
              <span class="text-gray-600 dark:text-gray-300 font-medium shrink-0">{{ formatCurrency(item.amount) }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span class="text-gray-900 dark:text-gray-100">{{ t('statistics.total') }}</span>
              <span class="ms-auto text-gray-900 dark:text-gray-100">{{ formatCurrency(yearlyTotal) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Stacked Monthly Bar -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-6">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          {{ t('statistics.monthlyByCategory') }} – {{ selectedYear }}
        </h3>
        <div class="h-80 w-full relative">
          <Bar :data="barData" :options="barOptions" />
        </div>
      </div>

      <!-- Per-category monthly charts -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="cat in categoryMonthlyData"
          :key="cat.category"
          class="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: cat.color }"></span>
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ cat.displayName }}</span>
            <span class="ms-auto text-sm text-gray-500 dark:text-gray-400">{{ formatCurrency(cat.total) }}</span>
          </div>
          <div class="h-32 relative">
            <Bar :data="cat.chartData" :options="categoryBarOptions" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.category-breakdown-list {
  overflow-y: scroll;
  overflow-x: hidden;
}
.category-breakdown-list::-webkit-scrollbar {
  width: 6px;
}
.category-breakdown-list::-webkit-scrollbar-track {
  background: transparent;
}
.category-breakdown-list::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.4);
  border-radius: 3px;
}
.category-breakdown-list::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.6);
}
</style>
