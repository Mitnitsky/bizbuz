<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { EXCEPTIONAL_CATEGORY } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const txnStore = useTransactionsStore()

const exceptionalTotal = computed(() => {
  return txnStore.cycleTransactions
    .filter((t) => t.category === EXCEPTIONAL_CATEGORY && t.chargedAmount < 0)
    .reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
})

const exceptionalCount = computed(() => {
  return txnStore.cycleTransactions.filter((t) => t.category === EXCEPTIONAL_CATEGORY && t.chargedAmount < 0).length
})
</script>

<template>
  <div v-if="exceptionalCount > 0" class="bg-amber-50 dark:bg-amber-900/30 rounded-xl shadow p-5">
    <h3 class="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">{{ t('home.exceptionalExpenses') }}</h3>
    <div class="text-3xl font-bold text-amber-900 dark:text-amber-100">{{ formatCurrency(exceptionalTotal) }}</div>
    <p class="text-sm text-amber-600 dark:text-amber-400 mt-1">{{ t('home.exceptionalCount', { n: exceptionalCount }) }}</p>
  </div>
</template>
