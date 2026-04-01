<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const txnStore = useTransactionsStore()

const hasIncome = computed(() => txnStore.cycleIncome > 0)
</script>

<template>
  <div v-if="hasIncome" class="bg-emerald-50 dark:bg-green-900/20 rounded-xl shadow p-5">
    <h3 class="text-sm font-medium text-emerald-800 dark:text-green-300 mb-1">{{ t('home.income') }}</h3>
    <div class="text-2xl font-bold text-emerald-900 dark:text-green-100">{{ formatCurrency(txnStore.cycleIncome) }}</div>
    <p class="text-sm text-emerald-700 dark:text-green-400 mt-1">{{ t('home.incomeThisCycle') }}</p>
  </div>
</template>
