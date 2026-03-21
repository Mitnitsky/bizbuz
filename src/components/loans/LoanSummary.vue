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
  <div class="bg-red-600 dark:bg-red-700 rounded-xl shadow p-5 text-white mb-4">
    <div class="text-sm opacity-80">{{ t('loans.totalOpenDebt') }}</div>
    <div class="text-3xl font-bold mt-1">{{ formatCurrency(totalRemaining) }}</div>
    <div class="text-sm opacity-90 mt-2">{{ t('loans.nLoans', { n: loanCount }) }}</div>
  </div>
</template>
