<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { updateDashboardTileOrder, updateHiddenDashboardTiles } from '@/services/firestore'
import { useIcons } from '@/composables/useIcons'
import CycleSelector from '@/components/CycleSelector.vue'
import CycleSpendTile from '@/components/dashboard/CycleSpendTile.vue'
import CategoryPieTile from '@/components/dashboard/CategoryPieTile.vue'
import BudgetRemainingTile from '@/components/dashboard/BudgetRemainingTile.vue'
import InstallmentsTile from '@/components/dashboard/InstallmentsTile.vue'
import BudgetsTile from '@/components/dashboard/BudgetsTile.vue'
import TrackersTile from '@/components/dashboard/TrackersTile.vue'
import ExceptionalTile from '@/components/dashboard/ExceptionalTile.vue'
import IncomeTile from '@/components/dashboard/IncomeTile.vue'

const { t } = useI18n()
const { icon } = useIcons()

const ALL_TILES = ['cycle_spend', 'income', 'category_pie', 'budget_remaining', 'exceptional', 'installments', 'budgets', 'trackers'] as const
const ALWAYS_VISIBLE = ['cycle_spend']

const TILE_LABELS: Record<string, string> = {
  cycle_spend: 'home.cycleExpenses',
  income: 'home.income',
  category_pie: 'home.categoryPie',
  budget_remaining: 'home.budgetRemaining',
  exceptional: 'home.exceptional',
  installments: 'home.futurePayments',
  budgets: 'home.budgets',
  trackers: 'home.trackers',
}

const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const tileComponents: Record<string, Component> = {
  cycle_spend: CycleSpendTile,
  income: IncomeTile,
  category_pie: CategoryPieTile,
  budget_remaining: BudgetRemainingTile,
  exceptional: ExceptionalTile,
  installments: InstallmentsTile,
  budgets: BudgetsTile,
  trackers: TrackersTile,
}

const hiddenTiles = ref<Set<string>>(new Set())
const tiles = ref<Array<{ id: string }>>([])
const configOpen = ref(false)

const hasBudgets = computed(() => {
  const b = familyStore.familySettings.categoryBudgets
  return b && Object.keys(b).length > 0
})

// Auto-hide budget tiles when no budgets configured
const autoHidden = computed(() => {
  const set = new Set<string>()
  if (!hasBudgets.value) {
    set.add('budget_remaining')
    set.add('budgets')
  }
  return set
})

watch(() => prefsStore.userPreferences, (prefs) => {
  const order = prefs?.dashboardTileOrder
  const ids = (order && order.length > 0) ? order : [...ALL_TILES]
  tiles.value = ids.map(id => ({ id }))
  hiddenTiles.value = new Set(prefs?.hiddenDashboardTiles ?? [])
}, { immediate: true })

function onDragEnd() {
  const order = tiles.value.map(t => t.id)
  if (authStore.familyId && authStore.user) {
    updateDashboardTileOrder(authStore.familyId, authStore.user.uid, order)
  }
}

function toggleTile(id: string) {
  const next = new Set(hiddenTiles.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  hiddenTiles.value = next
  if (authStore.familyId && authStore.user) {
    updateHiddenDashboardTiles(authStore.familyId, authStore.user.uid, [...next])
  }
}

const familyName = computed(() => familyStore.family?.name ?? 'BizBuz')
</script>

<template>
  <div class="max-w-7xl mx-auto w-full px-4 py-6">
    <!-- App Bar -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ familyName }}</h1>
      <button
        class="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        :title="t('home.configureTiles')"
        @click="configOpen = !configOpen"
      >
        <component :is="icon('settings')" class="h-5 w-5" />
      </button>
    </div>

    <!-- Tile config panel -->
    <div v-if="configOpen" class="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('home.configureTiles') }}</h3>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="tileId in ALL_TILES"
          :key="tileId"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition"
          :class="[
            ALWAYS_VISIBLE.includes(tileId)
              ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700 text-blue-700 dark:text-blue-300 opacity-60 cursor-not-allowed'
              : autoHidden.has(tileId)
                ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed'
                : hiddenTiles.has(tileId)
                  ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  : 'border-blue-300 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700 text-blue-700 dark:text-blue-300'
          ]"
        >
          <input
            type="checkbox"
            :checked="!hiddenTiles.has(tileId) && !autoHidden.has(tileId)"
            :disabled="ALWAYS_VISIBLE.includes(tileId) || autoHidden.has(tileId)"
            class="sr-only"
            @change="toggleTile(tileId)"
          />
          <span>{{ t(TILE_LABELS[tileId] ?? tileId) }}</span>
          <span v-if="autoHidden.has(tileId)" class="text-xs">({{ t('home.noBudgets') }})</span>
        </label>
      </div>
    </div>

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
        <div v-if="!hiddenTiles.has(element.id) && !autoHidden.has(element.id)" class="mb-4 relative group">
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
