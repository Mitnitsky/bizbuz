<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { differenceInDays } from 'date-fns'
import type { SavingsEntry } from '@/types'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'
import { trackerDaysRemaining } from '@/composables/useTracker'
import { useIcons } from '@/composables/useIcons'

const { t } = useI18n()
const { icon } = useIcons()

const props = defineProps<{
  entry: SavingsEntry
}>()

const emit = defineEmits<{
  (e: 'openTracker', entry: SavingsEntry): void
  (e: 'edit', entry: SavingsEntry): void
}>()

const isStale = computed(() => differenceInDays(new Date(), props.entry.lastUpdated) > 30)

const daysLeft = computed(() => trackerDaysRemaining(props.entry, props.entry.lastUpdated))

const trackerLabel = computed(() => {
  if (daysLeft.value === null) return null
  if (daysLeft.value < 0) return t('home.overdue')
  return t('home.daysLeft', { n: daysLeft.value })
})

const trackerColor = computed(() => {
  if (daysLeft.value === null) return ''
  if (daysLeft.value < 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
})
</script>

<template>
  <div
    class="flex items-center justify-between py-3 px-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
    @click="emit('openTracker', entry)"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-medium text-gray-900 dark:text-white truncate">{{ entry.name }}</span>
        <span v-if="isStale" class="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">
          ⚠️ {{ t('savings.notUpdated30Days') }}
        </span>
      </div>
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        <span v-if="entry.firmName" class="text-gray-400 dark:text-gray-500">{{ entry.firmName }}</span>
        <span>{{ t('savings.updatedPrefix') }}{{ formatDateShort(entry.lastUpdated) }}</span>
        <span v-if="entry.liquidityDate">{{ t('savings.liquidityPrefix') }}{{ formatDateShort(entry.liquidityDate) }}</span>
      </div>
      <div v-if="entry.notes" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ entry.notes }}</div>
      <span
        v-if="trackerLabel"
        class="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1"
        :class="trackerColor"
      >{{ trackerLabel }}</span>
    </div>
    <div class="flex items-center gap-2 ml-4 shrink-0">
      <button
        class="text-gray-400 hover:text-purple-500 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        @click.stop="emit('edit', entry)"
        :title="t('common.edit')"
      ><component :is="icon('edit')" class="w-4 h-4" /></button>
      <span class="font-bold text-gray-900 dark:text-white">{{ formatCurrency(entry.amount) }}</span>
    </div>
  </div>
</template>
