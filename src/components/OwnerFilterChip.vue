<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import { useI18n } from 'vue-i18n'
import type { OwnerTag } from '@/types'

const ui = useUiStore()
const familyStore = useFamilyStore()
const { t } = useI18n()

const options = computed<Array<{ value: 'all' | OwnerTag; label: string }>>(() => {
  const names = familyStore.ownerTagNames
  return [
    { value: 'all', label: t('ownerFilter.all') },
    { value: 'userA', label: names.userA ? names.userA.charAt(0) + '.' : 'A' },
    { value: 'userB', label: names.userB ? names.userB.charAt(0) + '.' : 'B' },
  ]
})
</script>

<template>
  <div class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="px-3 py-1 transition-colors"
      :class="ui.ownerFilter === opt.value
        ? 'bg-purple-600 text-white'
        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
      @click="ui.ownerFilter = opt.value"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
