<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { TRANSFER_CATEGORY } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const familyStore = useFamilyStore()

const totalBudget = computed(() => {
  const budgets = familyStore.familySettings.categoryBudgets
  return Object.values(budgets).reduce((sum, b) => sum + b, 0)
})

const totalSpend = computed(() => {
  return txnStore.cycleTransactions
    .filter(txn => txn.category !== TRANSFER_CATEGORY)
    .reduce((sum, txn) => sum + txn.chargedAmount, 0)
})

const remaining = computed(() => totalBudget.value - totalSpend.value)
const hasBudgets = computed(() => totalBudget.value > 0)
const exceeded = computed(() => remaining.value < 0)

const progressPct = computed(() => {
  if (totalBudget.value <= 0) return 0
  return Math.min((totalSpend.value / totalBudget.value) * 100, 100)
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{{ t('home.budgetRemaining') }}</h3>

    <div v-if="!hasBudgets" class="text-gray-400 dark:text-gray-500 text-sm">
      {{ t('home.setBudgetsInSettings') }}
    </div>

    <div v-else>
      <div class="text-2xl font-bold" :class="exceeded ? 'text-red-500' : 'text-gray-900 dark:text-gray-300'">
        {{ formatCurrency(Math.abs(remaining)) }}
        <span v-if="exceeded" class="text-sm font-normal text-red-500">{{ t('home.budgetExceeded') }}</span>
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('home.outOf', { amount: totalBudget.toFixed(0) }) }}</p>
      <div class="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all"
          :class="exceeded ? 'bg-red-500' : 'bg-purple-500'"
          :style="{ width: `${progressPct}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>
