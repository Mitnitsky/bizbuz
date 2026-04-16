<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { useTransactionsStore } from '@/stores/transactions'
import { usePreferencesStore } from '@/stores/preferences'
import { useFamilyStore } from '@/stores/family'
import { useUiStore } from '@/stores/ui'
import { TRANSFER_CATEGORY, EXCEPTIONAL_CATEGORY, NON_BUDGET_CATEGORY, INCOME_CATEGORY, DEFAULT_CATEGORY, categoryDisplayName, getEffectiveCategories } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()
const router = useRouter()
const txnStore = useTransactionsStore()
const prefsStore = usePreferencesStore()
const familyStore = useFamilyStore()
const uiStore = useUiStore()

const COLORS = [
  '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#eab308', '#22c55e',
]

const EXCLUDED = [TRANSFER_CATEGORY, EXCEPTIONAL_CATEGORY, NON_BUDGET_CATEGORY, INCOME_CATEGORY]

const categoryData = computed(() => {
  const grouped: Record<string, number> = {}
  for (const txn of txnStore.cycleTransactions) {
    if (EXCLUDED.includes(txn.category)) continue
    if (txn.chargedAmount >= 0) continue
    if (txn.status === 'pending_categorization') continue
    const cat = txn.category || DEFAULT_CATEGORY
    grouped[cat] = (grouped[cat] ?? 0) + Math.abs(txn.chargedAmount)
  }
  return Object.entries(grouped)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
})

const totalSpend = computed(() => categoryData.value.reduce((sum, d) => sum + d.amount, 0))

const chartData = computed(() => ({
  labels: categoryData.value.map(d => categoryDisplayName(d.category, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides)),
  datasets: [{
    data: categoryData.value.map(d => d.amount),
    backgroundColor: categoryData.value.map((_d, i) => COLORS[i % COLORS.length]),
    borderWidth: 0,
  }],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: number }) => {
          const value = ctx.parsed
          const pct = totalSpend.value > 0 ? ((value / totalSpend.value) * 100).toFixed(1) : '0'
          return `${pct}% – ${formatCurrency(value)}`
        },
      },
    },
  },
}

function goToCategory(category: string) {
  uiStore.highlightedCategory = category
  router.push('/spendings')
}
</script>

<template>
  <router-link to="/spendings" class="block bg-white dark:bg-gray-800 rounded-xl shadow p-5 hover:shadow-md transition-shadow cursor-pointer">
    <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{{ t('home.spendingByCategory') }}</h2>

    <div v-if="categoryData.length === 0" class="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">
      {{ t('spendings.noTransactionsYet') }}
    </div>

    <div v-else class="flex flex-col sm:flex-row gap-4 items-center sm:items-start overflow-hidden">
      <div class="w-36 h-36 shrink-0 relative">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <div class="category-pie-list flex-1 min-w-0 w-full space-y-1 sm:space-y-1.5 max-h-48 overflow-y-auto overflow-x-hidden">
        <div
          v-for="(item, idx) in categoryData"
          :key="item.category"
          class="flex items-center gap-2 text-base sm:text-sm py-1 sm:py-0"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: COLORS[idx % COLORS.length] }"></span>
          <span
            class="truncate text-gray-700 dark:text-gray-300 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors"
            @click.prevent="goToCategory(item.category)"
          >{{ categoryDisplayName(item.category, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}</span>
          <span class="ms-auto text-gray-500 dark:text-gray-400 shrink-0">
            {{ totalSpend > 0 ? ((item.amount / totalSpend) * 100).toFixed(0) : 0 }}%
          </span>
          <span class="text-gray-600 dark:text-gray-300 font-medium shrink-0">{{ formatCurrency(item.amount) }}</span>
        </div>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.category-pie-list {
  overflow-y: scroll;
  overflow-x: hidden;
}
.category-pie-list::-webkit-scrollbar {
  width: 6px;
}
.category-pie-list::-webkit-scrollbar-track {
  background: transparent;
}
.category-pie-list::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.4);
  border-radius: 3px;
}
.category-pie-list::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.6);
}
</style>
