<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'
import { trackerDaysRemaining } from '@/composables/useTracker'
import { useIcons } from '@/composables/useIcons'
import type { TrackerType } from '@/types'

const { t } = useI18n()
const { icon } = useIcons()

export interface LoanItem {
  id: string
  name: string
  principal: number
  remaining: number
  lastUpdated: Date
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
}

const props = defineProps<{
  loan: LoanItem
}>()

const emit = defineEmits<{
  (e: 'openTracker', item: LoanItem): void
  (e: 'edit', item: LoanItem): void
}>()

const paid = computed(() => props.loan.principal - props.loan.remaining)
const paidPct = computed(() => {
  if (props.loan.principal === 0) return 0
  return (paid.value / props.loan.principal) * 100
})

const daysLeft = computed(() => trackerDaysRemaining(props.loan, props.loan.lastUpdated))

const trackerLabel = computed(() => {
  if (daysLeft.value === null) return null
  if (daysLeft.value < 0) return t('home.overdue')
  return t('home.daysLeft', { n: daysLeft.value })
})

const trackerColor = computed(() => {
  if (daysLeft.value === null) return ''
  return daysLeft.value < 0
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
    @click="emit('openTracker', loan)"
  >
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg font-bold text-gray-900 dark:text-white">{{ loan.name }}</span>
      <component :is="icon('loans')" class="w-4 h-4 text-gray-500" />
      <div class="flex-1" />
      <button
        class="text-gray-400 hover:text-purple-500 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        @click.stop="emit('edit', loan)"
        :title="t('common.edit')"
      ><component :is="icon('edit')" class="w-4 h-4" /></button>
    </div>

    <span
      v-if="trackerLabel"
      class="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3"
      :class="trackerColor"
    >{{ trackerLabel }}</span>

    <!-- Progress bar -->
    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
      <div
        class="bg-green-500 h-2 rounded-full transition-all"
        :style="{ width: `${Math.min(paidPct, 100)}%` }"
      ></div>
    </div>

    <!-- Three-column stats -->
    <div class="flex justify-between text-sm mb-2">
      <div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('loans.paid') }}</div>
        <div class="font-medium text-green-600 dark:text-green-400">{{ formatCurrency(paid) }}</div>
      </div>
      <div class="text-center">
        <div class="text-xs text-gray-500 dark:text-gray-400">&nbsp;</div>
        <div class="font-bold text-gray-900 dark:text-white">{{ paidPct.toFixed(0) }}%</div>
      </div>
      <div class="text-right">
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('loans.remaining') }}</div>
        <div class="font-medium text-red-600 dark:text-red-400">{{ formatCurrency(loan.remaining) }}</div>
      </div>
    </div>

    <div class="text-xs text-gray-500 dark:text-gray-400">
      {{ t('loans.totalPrefix', { amount: formatCurrency(loan.principal) }) }}
    </div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
      {{ t('home.lastUpdated') }}: {{ formatDateShort(loan.lastUpdated) }}
    </div>
  </div>
</template>
