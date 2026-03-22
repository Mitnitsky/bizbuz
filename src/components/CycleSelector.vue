<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { computeCycleRange } from '@/composables/useBillingCycle'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { startOfDay } from 'date-fns'

const uiStore = useUiStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const cycleRange = computed(() => {
  const today = startOfDay(new Date())
  return computeCycleRange(today, familyStore.familySettings.cycleStartDay, uiStore.cycleOffset)
})

const cycleLabel = computed(() => {
  const range = cycleRange.value
  const loc = prefsStore.locale === 'he' ? { locale: he } : {}
  return `${format(range.start, 'dd MMM', loc)} – ${format(range.end, 'dd MMM', loc)}`
})

const isCurrent = computed(() => uiStore.cycleOffset === 0)

function prev() { uiStore.cycleOffset-- }
function next() { uiStore.cycleOffset++ }
function reset() { uiStore.cycleOffset = 0 }
</script>

<template>
  <div class="flex items-center justify-center gap-2">
    <button
      @click="prev"
      class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition rtl:rotate-180"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div
      class="px-4 py-1.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
      :class="isCurrent ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
    >
      {{ cycleLabel }}
      <button
        v-if="!isCurrent"
        @click="reset"
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        title="Reset to current cycle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <button
      @click="next"
      class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition rtl:rotate-180"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>
</template>
