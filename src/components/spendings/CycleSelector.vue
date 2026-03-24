<script setup lang="ts">
import { computed } from 'vue'
import { format, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { computeCycleRange } from '@/composables/useBillingCycle'

const ui = useUiStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const cycleLabel = computed(() => {
  const today = startOfDay(new Date())
  const range = computeCycleRange(today, familyStore.familySettings.cycleStartDay, ui.cycleOffset)
  const loc = prefsStore.locale === 'he' ? { locale: he } : {}
  return `${format(range.start, 'dd MMM', loc)} – ${format(range.end, 'dd MMM, yyyy', loc)}`
})

function prev() { ui.cycleOffset-- }
function next() { ui.cycleOffset++ }
function reset() { ui.cycleOffset = 0 }
</script>

<template>
  <div class="inline-flex items-center gap-1 text-sm">
    <button
      class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
      @click="prev"
    >‹</button>
    <button
      class="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-gray-800 dark:text-gray-300 min-w-[160px] text-center"
      @click="reset"
      :title="'Reset to current cycle'"
    >{{ cycleLabel }}</button>
    <button
      class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
      @click="next"
    >›</button>
  </div>
</template>
