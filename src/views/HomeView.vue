<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue'
import draggable from 'vuedraggable'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { updateDashboardTileOrder } from '@/services/firestore'
import CycleSelector from '@/components/CycleSelector.vue'
import CycleSpendTile from '@/components/dashboard/CycleSpendTile.vue'
import CategoryPieTile from '@/components/dashboard/CategoryPieTile.vue'
import BudgetRemainingTile from '@/components/dashboard/BudgetRemainingTile.vue'
import InstallmentsTile from '@/components/dashboard/InstallmentsTile.vue'
import BudgetsTile from '@/components/dashboard/BudgetsTile.vue'
import TrackersTile from '@/components/dashboard/TrackersTile.vue'

const DEFAULT_TILES = ['cycle_spend', 'category_pie', 'budget_remaining', 'installments', 'budgets', 'trackers']

const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const tileComponents: Record<string, Component> = {
  cycle_spend: CycleSpendTile,
  category_pie: CategoryPieTile,
  budget_remaining: BudgetRemainingTile,
  installments: InstallmentsTile,
  budgets: BudgetsTile,
  trackers: TrackersTile,
}

const tiles = ref<Array<{ id: string }>>([])

watch(() => prefsStore.userPreferences?.dashboardTileOrder, (order) => {
  const ids = (order && order.length > 0) ? order : DEFAULT_TILES
  tiles.value = ids.map(id => ({ id }))
}, { immediate: true })

function onDragEnd() {
  const order = tiles.value.map(t => t.id)
  if (authStore.familyId && authStore.user) {
    updateDashboardTileOrder(authStore.familyId, authStore.user.uid, order)
  }
}

const familyName = computed(() => familyStore.family?.name ?? 'BizBuz')
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6">
    <!-- App Bar -->
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">{{ familyName }}</h1>

    <!-- Cycle Selector -->
    <CycleSelector class="mb-6" />

    <!-- Draggable Tiles -->
    <draggable
      v-model="tiles"
      item-key="id"
      handle=".drag-handle"
      :animation="200"
      @end="onDragEnd"
    >
      <template #item="{ element }">
        <div class="mb-4 relative group">
          <div class="drag-handle absolute top-3 right-3 z-10 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <component :is="tileComponents[element.id]" />
        </div>
      </template>
    </draggable>
  </div>
</template>
