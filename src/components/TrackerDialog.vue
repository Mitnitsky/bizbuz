<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrackerType } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  trackerType?: TrackerType
  trackerDate?: Date
  trackerIntervalDays?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: { trackerType: TrackerType | null; trackerDate: Date | null; trackerIntervalDays: number | null }): void
}>()

type Mode = 'none' | 'once' | 'interval'
const mode = ref<Mode>('none')
const dateValue = ref('')
const intervalDays = ref(30)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    mode.value = props.trackerType ?? 'none'
    dateValue.value = props.trackerDate
      ? props.trackerDate.toISOString().slice(0, 10)
      : ''
    intervalDays.value = props.trackerIntervalDays ?? 30
  }
})

function handleSave() {
  if (mode.value === 'none') {
    emit('save', { trackerType: null, trackerDate: null, trackerIntervalDays: null })
  } else if (mode.value === 'once') {
    emit('save', {
      trackerType: 'once',
      trackerDate: dateValue.value ? new Date(dateValue.value) : null,
      trackerIntervalDays: null,
    })
  } else {
    emit('save', {
      trackerType: 'interval',
      trackerDate: null,
      trackerIntervalDays: intervalDays.value,
    })
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('home.trackers') }}</h3>

        <!-- Segmented toggle -->
        <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 mb-4">
          <button
            v-for="opt in (['none', 'once', 'interval'] as Mode[])"
            :key="opt"
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="mode === opt
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
            @click="mode = opt"
          >
            {{ opt === 'none' ? t('common.cancel') : opt === 'once' ? t('home.trackOnce') : t('home.trackInterval') }}
          </button>
        </div>

        <!-- One-time date -->
        <div v-if="mode === 'once'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('home.trackUpdateBy') }}</label>
          <input
            v-model="dateValue"
            type="date"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <!-- Interval days -->
        <div v-if="mode === 'interval'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('home.trackEveryNDays') }}</label>
          <input
            v-model.number="intervalDays"
            type="number"
            min="1"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-3 justify-end">
          <button
            class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="emit('close')"
          >{{ t('common.cancel') }}</button>
          <button
            class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            @click="handleSave"
          >{{ t('common.save') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
