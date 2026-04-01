<script setup lang="ts">
import { ref, computed, watch, type Component } from 'vue'
import draggable from 'vuedraggable'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransactionsStore } from '@/stores/transactions'
import { updateDashboardTileOrder } from '@/services/firestore'
import CycleSelector from '@/components/CycleSelector.vue'
import CycleSpendTile from '@/components/dashboard/CycleSpendTile.vue'
import CategoryPieTile from '@/components/dashboard/CategoryPieTile.vue'
import BudgetRemainingTile from '@/components/dashboard/BudgetRemainingTile.vue'
import InstallmentsTile from '@/components/dashboard/InstallmentsTile.vue'
import BudgetsTile from '@/components/dashboard/BudgetsTile.vue'
import TrackersTile from '@/components/dashboard/TrackersTile.vue'
import ExceptionalTile from '@/components/dashboard/ExceptionalTile.vue'
import IncomeTile from '@/components/dashboard/IncomeTile.vue'
import UncategorizedTile from '@/components/dashboard/UncategorizedTile.vue'

const { t, locale } = useI18n()

const ALL_TILES = ['uncategorized', 'cycle_spend', 'income', 'category_pie', 'budget_remaining', 'exceptional', 'installments', 'budgets', 'trackers'] as const

const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const txnStore = useTransactionsStore()

const tileComponents: Record<string, Component> = {
  cycle_spend: CycleSpendTile,
  income: IncomeTile,
  uncategorized: UncategorizedTile,
  category_pie: CategoryPieTile,
  budget_remaining: BudgetRemainingTile,
  exceptional: ExceptionalTile,
  installments: InstallmentsTile,
  budgets: BudgetsTile,
  trackers: TrackersTile,
}

const hiddenTiles = ref<Set<string>>(new Set())
const tiles = ref<Array<{ id: string }>>([])

const hasBudgets = computed(() => {
  const b = familyStore.familySettings.categoryBudgets
  return b && Object.keys(b).length > 0
})

// Auto-hide tiles when their data is empty
const autoHidden = computed(() => {
  const set = new Set<string>()
  if (!hasBudgets.value) {
    set.add('budget_remaining')
    set.add('budgets')
  }
  if (txnStore.inboxCount === 0) {
    set.add('uncategorized')
  }
  return set
})

watch(() => prefsStore.userPreferences, (prefs) => {
  const order = prefs?.dashboardTileOrder
  let ids: string[]
  if (order && order.length > 0) {
    // Prepend any new tiles not in saved order so they appear first
    const missing = ([...ALL_TILES] as string[]).filter(t => !order.includes(t))
    ids = [...missing, ...order]
    // Persist updated order if new tiles were added
    if (missing.length > 0 && authStore.familyId && authStore.user) {
      updateDashboardTileOrder(authStore.familyId, authStore.user.uid, ids)
    }
  } else {
    ids = [...ALL_TILES]
  }
  tiles.value = ids.map(id => ({ id }))
  hiddenTiles.value = new Set(prefs?.hiddenDashboardTiles ?? [])
}, { immediate: true })

// Visible tiles for draggable — filtered to exclude hidden/autoHidden
const visibleTiles = computed({
  get() {
    return tiles.value.filter(t => !hiddenTiles.value.has(t.id) && !autoHidden.value.has(t.id))
  },
  set(newVisible: Array<{ id: string }>) {
    // Rebuild full list: visible tiles in new order + hidden tiles preserving relative order
    const visibleIds = new Set(newVisible.map(t => t.id))
    const hidden = tiles.value.filter(t => !visibleIds.has(t.id))
    tiles.value = [...newVisible, ...hidden]
  }
})

function onDragEnd() {
  const order = tiles.value.map(t => t.id)
  if (authStore.familyId && authStore.user) {
    updateDashboardTileOrder(authStore.familyId, authStore.user.uid, order)
  }
}

const familyName = computed(() => familyStore.familyName || 'BizBuz')
const displayName = computed(() => {
  const user = authStore.appUser
  if (!user) return ''
  const isHe = locale.value === 'he'
  return (isHe ? (user.displayNameHe || user.displayName) : (user.displayName || user.displayNameHe)) || user.email?.split('@')[0] || ''
})
</script>

<template>
  <div class="max-w-7xl mx-auto w-full px-4 py-6">
    <!-- App Bar -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <p v-if="displayName" class="text-sm text-gray-500 dark:text-gray-400">{{ t('home.greeting', { name: displayName }) }}</p>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ t('home.familyDashboard', { family: familyName }) }}</h1>
      </div>
    </div>

    <!-- Cycle Selector -->
    <CycleSelector class="mb-6" />

    <!-- Draggable Tiles -->
    <draggable
      v-model="visibleTiles"
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
