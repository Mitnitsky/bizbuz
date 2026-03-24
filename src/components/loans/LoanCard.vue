<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'
import { trackerDaysRemaining } from '@/composables/useTracker'
import { useIcons } from '@/composables/useIcons'
import { differenceInMonths, differenceInDays, addMonths } from 'date-fns'
import type { TrackerType, MortgageTrack, LoanType } from '@/types'

const { t } = useI18n()
const { icon } = useIcons()

export interface LoanItem {
  id: string
  name: string
  loanType: LoanType
  principal: number
  remaining: number
  endDate?: Date
  lastUpdated: Date
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
  tracks?: MortgageTrack[]
}

const props = defineProps<{
  loan: LoanItem
}>()

const emit = defineEmits<{
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
  if (daysLeft.value < 0) return t('tracker.updateOverdue')
  return t('tracker.updateIn', { n: daysLeft.value })
})

const trackerColor = computed(() => {
  if (daysLeft.value === null) return ''
  return daysLeft.value < 0
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
})

function formatTimeLeft(target: Date): string {
  const now = new Date()
  const months = differenceInMonths(target, now)
  if (months <= 0) {
    const days = differenceInDays(target, now)
    if (days <= 0) return t('home.overdue')
    return `${days}d`
  }
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years > 0 && rem > 0) return `${years}y ${rem}m`
  if (years > 0) return `${years}y`
  return `${rem}m`
}

const payoffLabel = computed(() => {
  // If explicit endDate, use it
  if (props.loan.endDate) {
    const now = new Date()
    if (props.loan.endDate <= now) return t('home.overdue')
    return t('loans.payoffIn', { text: formatTimeLeft(props.loan.endDate) })
  }
  // If tracks, derive from longest term
  if (props.loan.tracks && props.loan.tracks.length > 0) {
    const maxTermMonths = Math.max(...props.loan.tracks.map(tr => tr.termMonths || 0))
    if (maxTermMonths > 0) {
      const estimated = addMonths(props.loan.lastUpdated, maxTermMonths)
      const now = new Date()
      if (estimated <= now) return t('home.overdue')
      return t('loans.payoffIn', { text: formatTimeLeft(estimated) })
    }
  }
  return null
})

function indexLinkIcon(link: string): string {
  return link === 'cpiLinked' ? '📈' : '📊'
}

const sortedTracks = computed(() => {
  if (!props.loan.tracks) return []
  return [...props.loan.tracks].sort((a, b) => b.remaining - a.remaining)
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
    @click="emit('edit', loan)"
  >
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg font-bold text-gray-900 dark:text-white">{{ loan.name }}</span>
      <component :is="icon('loans')" class="w-4 h-4 text-gray-500" />
    </div>

    <div class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-if="trackerLabel"
        class="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
        :class="trackerColor"
      >{{ trackerLabel }}</span>
      <span
        v-if="payoffLabel"
        class="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
        :class="payoffLabel === t('home.overdue')
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
      >{{ payoffLabel }}</span>
    </div>

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

    <!-- Tracks -->
    <div v-if="loan.tracks && loan.tracks.length > 0" class="mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{{ t('loans.tracks') }}</div>
      <div class="space-y-1">
        <div
          v-for="track in sortedTracks"
          :key="track.id"
          class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2 py-1"
        >
          <span class="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[80px]">{{ track.name }}</span>
          <span class="text-purple-600 dark:text-purple-400">{{ track.interestRate }}%</span>
          <span>{{ indexLinkIcon(track.indexLink) }}</span>
          <span class="ml-auto font-medium">{{ formatCurrency(track.remaining) }}</span>
        </div>
      </div>
    </div>

    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      {{ t('loans.totalPrefix', { amount: formatCurrency(loan.principal) }) }}
    </div>
    <div v-if="loan.endDate" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
      {{ t('loans.endsOn', { date: formatDateShort(loan.endDate) }) }}
    </div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
      {{ t('home.lastUpdated') }}: {{ formatDateShort(loan.lastUpdated) }}
    </div>
  </div>
</template>
