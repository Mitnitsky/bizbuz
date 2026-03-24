<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatCurrency } from '@/composables/useFormatters'

const { t } = useI18n()

defineProps<{
  totalCurrentValue: number
  totalInvested: number
  assetCount: number
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-4">
    <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('investments.totalPortfolio') }}</div>
    <div class="text-3xl font-bold text-gray-900 dark:text-gray-200 mt-1">{{ formatCurrency(totalCurrentValue) }}</div>
    <div class="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
      <span>{{ t('investments.nAssets', { n: assetCount }) }}</span>
      <span v-if="totalInvested > 0">
        {{ ((totalCurrentValue - totalInvested) / totalInvested * 100).toFixed(1) }}%
      </span>
    </div>
  </div>
</template>
