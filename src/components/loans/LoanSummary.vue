<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/composables/useFormatters'

const { t } = useI18n()

defineProps<{
  totalRemaining: number
  loanCount: number
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-4">
    <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('loans.totalOpenDebt') }}</div>
    <div class="text-3xl font-bold text-gray-900 dark:text-gray-300 mt-1">{{ formatCurrency(totalRemaining) }}</div>
    <div class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('loans.nLoans', { n: loanCount }) }}</div>
  </div>
</template>
