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
  <div class="bg-blue-600 dark:bg-blue-700 rounded-xl shadow p-5 text-white mb-4">
    <div class="text-sm opacity-80">{{ t('investments.totalPortfolio') }}</div>
    <div class="text-3xl font-bold mt-1">{{ formatCurrency(totalCurrentValue) }}</div>
    <div class="flex items-center gap-4 mt-2 text-sm opacity-90">
      <span>{{ t('investments.nAssets', { n: assetCount }) }}</span>
      <span v-if="totalInvested > 0">
        {{ ((totalCurrentValue - totalInvested) / totalInvested * 100).toFixed(1) }}%
      </span>
    </div>
  </div>
</template>
