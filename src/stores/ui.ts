import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OwnerTag } from '@/types'

export const useUiStore = defineStore('ui', () => {
  const ownerFilter = ref<'all' | OwnerTag>('all')
  const cycleOffset = ref(0)

  return {
    ownerFilter,
    cycleOffset,
  }
})
