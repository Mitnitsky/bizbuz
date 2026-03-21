<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { TRANSFER_CATEGORY, categoryDisplayName } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const budgetItems = computed(() => {
  const budgets = familyStore.familySettings.categoryBudgets
  const spendByCategory: Record<string, number> = {}

  for (const txn of txnStore.cycleTransactions) {
    if (txn.category === TRANSFER_CATEGORY) continue
    spendByCategory[txn.category] = (spendByCategory[txn.category] ?? 0) + txn.chargedAmount
  }

  return Object.entries(budgets)
    .filter(([, budget]) => budget > 0)
    .map(([category, budget]) => ({
      category,
      budget,
      spent: spendByCategory[category] ?? 0,
      pct: Math.min(((spendByCategory[category] ?? 0) / budget) * 100, 100),
    }))
    .sort((a, b) => (b.spent / b.budget) - (a.spent / a.budget))
})

const hasBudgets = computed(() => budgetItems.value.length > 0)
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{{ t('home.budgetByCategory') }}</h3>

    <div v-if="!hasBudgets" class="text-gray-400 dark:text-gray-500 text-sm">{{ t('home.noBudgetsSet') }}</div>

    <div v-else class="space-y-3">
      <div v-for="item in budgetItems" :key="item.category">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-700 dark:text-gray-300">{{ categoryDisplayName(item.category, prefsStore.locale) }}</span>
          <span class="text-gray-500 dark:text-gray-400">{{ formatCurrency(item.spent) }} / {{ formatCurrency(item.budget) }}</span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="item.pct >= 100 ? 'bg-red-500' : item.pct >= 80 ? 'bg-orange-400' : 'bg-purple-500'"
            :style="{ width: `${item.pct}%` }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
