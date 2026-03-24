<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'
import { trackerDaysRemaining } from '@/composables/useTracker'
import { useIcons } from '@/composables/useIcons'
import type { TrackerType } from '@/types'

const { t } = useI18n()
const { icon } = useIcons()

export interface InvestmentItem {
  id: string
  name: string
  investedAmount: number
  currentValue: number
  lastUpdated: Date
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
}

const props = defineProps<{
  investment: InvestmentItem
}>()

const emit = defineEmits<{
  (e: 'edit', item: InvestmentItem): void
}>()

const gainLossPct = computed(() => {
  const { investedAmount, currentValue } = props.investment
  if (investedAmount === 0) return 0
  return ((currentValue - investedAmount) / investedAmount) * 100
})

const isPositive = computed(() => gainLossPct.value >= 0)

const daysLeft = computed(() => trackerDaysRemaining(props.investment, props.investment.lastUpdated))

const trackerLabel = computed(() => {
  if (daysLeft.value === null) return null
  if (daysLeft.value < 0) return t('tracker.updateOverdue')
  return t('tracker.updateIn', { n: daysLeft.value })
})

const trackerColor = computed(() => {
  if (daysLeft.value === null) return ''
  return daysLeft.value < 0
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
    @click="emit('edit', investment)"
  >
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold text-gray-900 dark:text-gray-200">{{ investment.name }}</span>
        <component :is="icon('investments')" class="w-4 h-4 text-green-500" />
      </div>
      <span
        class="text-xs font-medium px-2 py-0.5 rounded-full"
        :class="isPositive
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'"
      >{{ isPositive ? '+' : '' }}{{ gainLossPct.toFixed(1) }}%</span>
    </div>

    <span
      v-if="trackerLabel"
      class="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3"
      :class="trackerColor"
    >{{ trackerLabel }}</span>

    <div class="text-xs text-gray-500 dark:text-gray-400 mb-3">
      {{ t('home.lastUpdated') }}: {{ formatDateShort(investment.lastUpdated) }}
    </div>

    <div class="flex justify-between">
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('investments.invested') }}</div>
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ formatCurrency(investment.investedAmount) }}</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('investments.currentValue') }}</div>
        <div class="text-sm font-bold text-gray-900 dark:text-gray-200">{{ formatCurrency(investment.currentValue) }}</div>
      </div>
    </div>
  </div>
</template>
