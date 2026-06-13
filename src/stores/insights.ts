import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { WatchStopHandle } from 'vue'
import type { InsightsDoc } from '@/types'
import { onInsights } from '@/services/firestore'
import { computeCycleRange, cycleKey } from '@/composables/useBillingCycle'
import { useFamilyStore } from '@/stores/family'
import { startOfDay } from 'date-fns'
import type { Unsubscribe } from 'firebase/firestore'

export const useInsightsStore = defineStore('insights', () => {
  const doc = ref<InsightsDoc | null>(null)
  const loaded = ref(false)
  let unsub: Unsubscribe | null = null
  let stopWatcher: WatchStopHandle | null = null
  let currentKey: string | null = null
  let currentFamilyId: string | null = null

  const dismissedIds = computed(() => doc.value?.dismissedIds ?? [])
  const insights = computed(() => {
    const all = doc.value?.insights ?? []
    if (dismissedIds.value.length === 0) return all
    const dismissed = new Set(dismissedIds.value)
    return all.filter((i) => !dismissed.has(i.id))
  })
  const generatedAt = computed(() => doc.value?.generatedAt ?? null)
  const hasInsights = computed(() => insights.value.length > 0)

  /**
   * Subscribe to the insights doc for the current cycle.
   * Re-subscribes automatically when family settings load (cycleStartDay changes).
   */
  function bind(familyId: string) {
    // If already bound (or bound to a different family), tear down first
    // to avoid leaking watchers / Firestore listeners across rebinds.
    unbind()

    const familyStore = useFamilyStore()
    currentFamilyId = familyId

    // Watch family settings so we re-bind once cycleStartDay is loaded
    stopWatcher = watch(
      () => familyStore.familySettings.cycleStartDay,
      (cycleStartDay) => {
        if (currentFamilyId !== familyId) return
        const today = startOfDay(new Date())
        const range = computeCycleRange(today, cycleStartDay, 0)
        const key = cycleKey(range.start)
        if (key === currentKey) return
        currentKey = key
        unsub?.()
        loaded.value = false
        unsub = onInsights(familyId, key, (d) => {
          doc.value = d
          loaded.value = true
        })
      },
      { immediate: true },
    )
  }

  function unbind() {
    stopWatcher?.()
    stopWatcher = null
    unsub?.()
    unsub = null
    currentKey = null
    currentFamilyId = null
    doc.value = null
    loaded.value = false
  }

  return {
    doc,
    loaded,
    insights,
    generatedAt,
    hasInsights,
    bind,
    unbind,
  }
})
