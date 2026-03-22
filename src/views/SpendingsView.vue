<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted, watchEffect } from 'vue'
import type { Transaction, CategorySortMode } from '@/types'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import { CATEGORIES, TRANSFER_CATEGORY, categoryDisplayName, NON_BUDGET_CATEGORY } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { updateCategoryOrder, updateUserPreferences } from '@/services/firestore'
import draggable from 'vuedraggable'
import CycleSelector from '@/components/spendings/CycleSelector.vue'
import OwnerFilterChip from '@/components/OwnerFilterChip.vue'
import InboxPanel from '@/components/spendings/InboxPanel.vue'
import CategoryCard from '@/components/spendings/CategoryCard.vue'
import TransactionListItem from '@/components/spendings/TransactionListItem.vue'
import TransactionDetailDialog from '@/components/spendings/TransactionDetailDialog.vue'
import SplitDialog from '@/components/spendings/SplitDialog.vue'
import CreateRuleDialog from '@/components/spendings/CreateRuleDialog.vue'
import AddTransactionDialog from '@/components/spendings/AddTransactionDialog.vue'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const authStore = useAuthStore()
const uiStore = useUiStore()

// --- Sort mode ---
const SORT_MODE_KEY = 'bizbuz:categorySortMode'
const SORT_DIR_KEY = 'bizbuz:categorySortDir'
const sortMode = ref<CategorySortMode>(
  (localStorage.getItem(SORT_MODE_KEY) as CategorySortMode) || 'custom'
)
const sortDir = ref<'asc' | 'desc'>(
  (localStorage.getItem(SORT_DIR_KEY) as 'asc' | 'desc') || 'desc'
)

function setSortMode(mode: CategorySortMode) {
  if (sortMode.value === mode) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortMode.value = mode
    sortDir.value = mode === 'name' ? 'asc' : 'desc'
  }
  localStorage.setItem(SORT_MODE_KEY, sortMode.value)
  localStorage.setItem(SORT_DIR_KEY, sortDir.value)
}

// --- View mode (cards vs list) ---
type ViewMode = 'cards' | 'list'
const VIEW_MODE_KEY = 'bizbuz:categoryViewMode'
const viewMode = ref<ViewMode>(
  (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'cards'
)
function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  localStorage.setItem(VIEW_MODE_KEY, mode)
}

// List view: expanded groups
const expandedGroups = ref<Set<string>>(new Set())
function toggleGroup(cat: string) {
  if (expandedGroups.value.has(cat)) {
    expandedGroups.value.delete(cat)
  } else {
    expandedGroups.value.add(cat)
  }
  expandedGroups.value = new Set(expandedGroups.value) // trigger reactivity
}

// --- Responsive layout ---
const isWide = ref(true)
let mql: MediaQueryList | null = null

onMounted(() => {
  mql = window.matchMedia('(min-width: 800px)')
  isWide.value = mql.matches
  const handler = (e: MediaQueryListEvent) => { isWide.value = e.matches }
  mql.addEventListener('change', handler)
  onUnmounted(() => mql?.removeEventListener('change', handler))
})

// --- Tabs (narrow layout) ---
const activeTab = ref<'inbox' | 'category'>('inbox')

// --- Inbox collapse (wide layout) ---
const inboxCollapsed = ref(false)

// --- Expand/collapse all categories ---
const allCategoriesExpanded = ref(true)
provide('allCategoriesExpanded', allCategoriesExpanded)

function toggleExpandAll() {
  allCategoriesExpanded.value = !allCategoriesExpanded.value
}

// --- Owner-filtered transactions (local to this page) ---
const ownerFilteredTransactions = computed(() => {
  const filter = uiStore.ownerFilter
  if (filter === 'all') return txnStore.cycleTransactions
  return txnStore.cycleTransactions.filter(t => t.ownerTag === filter)
})

// --- Category grouping ---
const categorizedTransactions = computed(() => {
  return ownerFilteredTransactions.value.filter(t => t.status !== 'pending_categorization')
})

const transactionsByCategory = computed(() => {
  const map = new Map<string, Transaction[]>()
  for (const t of categorizedTransactions.value) {
    const cat = t.category || 'אחר'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(t)
  }
  return map
})

// Ordered list of category items for vuedraggable (wrapped as objects)
const categoryItems = ref<Array<{ key: string }>>([])

function collectAllCategories(): string[] {
  const allCats: string[] = [...CATEGORIES.filter(c => c !== TRANSFER_CATEGORY)]
  for (const cat of transactionsByCategory.value.keys()) {
    if (!allCats.includes(cat) && cat !== TRANSFER_CATEGORY) allCats.push(cat)
  }
  return allCats
}

function categorySpending(cat: string): number {
  const txns = transactionsByCategory.value.get(cat)
  if (!txns) return 0
  return txns.reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
}

// --- Pinned categories ---
const pinnedCategories = computed(() => prefsStore.userPreferences?.pinnedCategories ?? [])

async function togglePin(category: string) {
  console.log('[PIN] togglePin called for', category)
  const familyId = familyStore.family?.id
  const uid = authStore.user?.uid
  if (!familyId || !uid) { console.log('[PIN] no familyId or uid'); return }
  const current = [...pinnedCategories.value]
  const idx = current.indexOf(category)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(category)
  console.log('[PIN] saving', current)
  await updateUserPreferences(familyId, uid, { pinned_categories: current })
}

watchEffect(() => {
  const allCats = collectAllCategories()
  const locale = prefsStore.locale
  const overrides = familyStore.familySettings.categoryNameOverrides
  const pinned = pinnedCategories.value
  const dir = sortDir.value

  let sorted: string[]

  switch (sortMode.value) {
    case 'spending':
      sorted = [...allCats].sort((a, b) =>
        dir === 'desc'
          ? categorySpending(b) - categorySpending(a)
          : categorySpending(a) - categorySpending(b)
      )
      break
    case 'name':
      sorted = [...allCats].sort((a, b) => {
        const nameA = categoryDisplayName(a, locale, overrides)
        const nameB = categoryDisplayName(b, locale, overrides)
        const cmp = nameA.localeCompare(nameB, locale === 'he' ? 'he' : 'en')
        return dir === 'asc' ? cmp : -cmp
      })
      break
    case 'custom':
    default: {
      const order = prefsStore.userPreferences?.categoryOrder ?? []
      sorted = []
      for (const cat of order) {
        if (allCats.includes(cat)) sorted.push(cat)
      }
      for (const cat of allCats) {
        if (!sorted.includes(cat)) sorted.push(cat)
      }
      if (dir === 'asc') sorted.reverse()
      break
    }
  }

  // Pinned always first, preserving their relative order
  if (pinned.length > 0) {
    const pinnedItems = sorted.filter(c => pinned.includes(c))
    const unpinned = sorted.filter(c => !pinned.includes(c))
    pinnedItems.sort((a, b) => pinned.indexOf(a) - pinned.indexOf(b))
    sorted = [...pinnedItems, ...unpinned]
  }

  categoryItems.value = sorted.map(key => ({ key }))
})

async function onCategoryReorder() {
  const order = categoryItems.value.map(item => item.key)
  const familyId = familyStore.family?.id
  const uid = authStore.user?.uid
  if (familyId && uid) {
    await updateCategoryOrder(familyId, uid, order)
  }
  if (sortMode.value !== 'custom') {
    setSortMode('custom')
  }
}

// --- Dialogs ---
const selectedTransaction = ref<Transaction | null>(null)
const showDetailDialog = ref(false)
const showSplitDialog = ref(false)
const showCreateRuleDialog = ref(false)
const showAddDialog = ref(false)

function openDetail(txn: Transaction) {
  selectedTransaction.value = txn
  showDetailDialog.value = true
}
provide('openTransactionDetail', openDetail)

function openSplit() {
  showDetailDialog.value = false
  showSplitDialog.value = true
}

function openCreateRule() {
  showDetailDialog.value = false
  showCreateRuleDialog.value = true
}

function openAddTransaction() {
  showAddDialog.value = true
}

// --- Preferences ---
const showOwnerFilter = computed(() => prefsStore.userPreferences?.showOwnerFilter ?? true)
</script>

<template>
  <div class="flex flex-col h-full min-h-0 overflow-hidden">
    <!-- App Bar -->
    <div class="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100 mr-2">{{ t('nav.spendings') }}</h1>
      <CycleSelector />
      <OwnerFilterChip v-if="showOwnerFilter && familyStore.family && familyStore.family.memberUids.length > 1" />
      <div class="flex-1" />
      <!-- Sort mode toggle -->
      <div class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs font-medium">
        <button
          class="px-2.5 py-1.5 transition-colors flex items-center gap-1"
          :class="sortMode === 'spending'
            ? 'bg-purple-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="setSortMode('spending')"
        >{{ t('spendings.sortBySpending') }}<span v-if="sortMode === 'spending'" class="text-[10px]">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></button>
        <button
          class="px-2.5 py-1.5 border-x border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-1"
          :class="sortMode === 'name'
            ? 'bg-purple-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="setSortMode('name')"
        >{{ t('spendings.sortByName') }}<span v-if="sortMode === 'name'" class="text-[10px]">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></button>
        <button
          class="px-2.5 py-1.5 transition-colors flex items-center gap-1"
          :class="sortMode === 'custom'
            ? 'bg-purple-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="setSortMode('custom')"
        >{{ t('spendings.sortCustom') }}<span v-if="sortMode === 'custom'" class="text-[10px]">{{ sortDir === 'desc' ? '▼' : '▲' }}</span></button>
      </div>
      <button
        class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        @click="toggleExpandAll"
      >{{ allCategoriesExpanded ? t('spendings.collapseAll') : t('spendings.expandAll') }}</button>
      <!-- View mode toggle (desktop only) -->
      <div v-if="isWide" class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs font-medium">
        <button
          class="px-2.5 py-1.5 transition-colors"
          :class="viewMode === 'cards'
            ? 'bg-purple-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="setViewMode('cards')"
        >{{ t('spendings.viewCards') }}</button>
        <button
          class="px-2.5 py-1.5 transition-colors"
          :class="viewMode === 'list'
            ? 'bg-purple-600 text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="setViewMode('list')"
        >{{ t('spendings.viewList') }}</button>
      </div>
    </div>

    <!-- Wide layout: split panel -->
    <div v-if="isWide" class="flex flex-1 min-h-0 overflow-hidden">
      <InboxPanel
        :collapsed="inboxCollapsed"
        :collapsible="true"
        @toggle="inboxCollapsed = !inboxCollapsed"
        @add-transaction="openAddTransaction"
      />
      <div class="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
        <div v-if="categoryItems.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
          <p class="text-lg">{{ t('spendings.noTransactionsYet') }}</p>
        </div>

        <!-- Cards view -->
        <draggable
          v-else-if="viewMode === 'cards'"
          v-model="categoryItems"
          item-key="key"
          handle=".category-drag-handle"
          :disabled="sortMode !== 'custom'"
          :group="{ name: 'categories', pull: true, put: false }"
          :animation="300"
          ghost-class="dragging-ghost"
          chosen-class="dragging-chosen"
          drag-class="dragging-drag"
          class="-mt-2 columns-1 min-[1000px]:columns-2 min-[1600px]:columns-3 [&>*]:mt-2 [&>*]:break-inside-avoid"
          @end="onCategoryReorder"
        >
          <template #item="{ element }">
            <CategoryCard
              :category="element.key"
              :transactions="transactionsByCategory.get(element.key) ?? []"
              :pinned="pinnedCategories.includes(element.key)"
              @toggle-pin="togglePin"
            />
          </template>
        </draggable>

        <!-- List view -->
        <div v-else class="space-y-1">
          <template v-for="item in categoryItems" :key="item.key">
            <div
              v-if="(transactionsByCategory.get(item.key)?.length ?? 0) > 0 || expandedGroups.has(item.key)"
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <!-- Group header -->
              <button
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                @click="toggleGroup(item.key)"
                @dragover.prevent
                @dragenter="($event: DragEvent) => { if ($event.dataTransfer?.types.includes('text/x-transaction-id')) ($event.currentTarget as HTMLElement).classList.add('bg-purple-50', 'dark:bg-purple-900/20') }"
                @dragleave="($event: DragEvent) => { ($event.currentTarget as HTMLElement).classList.remove('bg-purple-50', 'dark:bg-purple-900/20') }"
                @drop="async ($event: DragEvent) => {
                  $event.preventDefault();
                  ($event.currentTarget as HTMLElement).classList.remove('bg-purple-50', 'dark:bg-purple-900/20');
                  const familyId = familyStore.family?.id;
                  if (!familyId) return;
                  const multiIds = $event.dataTransfer?.getData('text/x-transaction-ids');
                  if (multiIds) {
                    const ids: string[] = JSON.parse(multiIds);
                    const { categorizeTransaction } = await import('@/services/firestore');
                    for (const id of ids) await categorizeTransaction(familyId, id, item.key);
                    return;
                  }
                  const txnId = $event.dataTransfer?.getData('text/x-transaction-id');
                  if (txnId) {
                    const { categorizeTransaction } = await import('@/services/firestore');
                    await categorizeTransaction(familyId, txnId, item.key);
                  }
                }"
              >
                <span class="text-xs text-gray-400 transition-transform" :class="{ 'rotate-90': expandedGroups.has(item.key) }">▶</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left truncate">
                  {{ categoryDisplayName(item.key, prefsStore.locale, familyStore.familySettings.categoryNameOverrides) }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {{ transactionsByCategory.get(item.key)?.length ?? 0 }}
                </span>
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums min-w-[5rem] text-right">
                  {{ formatCurrency((transactionsByCategory.get(item.key) ?? []).reduce((s, t) => s + Math.abs(t.chargedAmount), 0)) }}
                </span>
              </button>
              <!-- Expanded transactions -->
              <div v-if="expandedGroups.has(item.key)" class="border-t border-gray-100 dark:border-gray-700">
                <TransactionListItem
                  v-for="txn in transactionsByCategory.get(item.key) ?? []"
                  :key="txn.id"
                  :transaction="txn"
                  :draggable="true"
                  :muted-amount="item.key === NON_BUDGET_CATEGORY"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Narrow layout: tabs -->
    <template v-else>
      <!-- Segmented toggle -->
      <div class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        <button
          class="flex-1 py-2.5 text-sm font-medium text-center transition-colors"
          :class="activeTab === 'inbox'
            ? 'text-purple-600 border-b-2 border-purple-600'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="activeTab = 'inbox'"
        >{{ t('spendings.inbox') }} <span v-if="txnStore.inboxCount > 0" class="inline-flex items-center justify-center ml-1 px-1.5 py-0.5 text-xs font-semibold leading-none rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 min-w-[1.25rem]">{{ txnStore.inboxCount }}</span></button>
        <button
          class="flex-1 py-2.5 text-sm font-medium text-center transition-colors"
          :class="activeTab === 'category'
            ? 'text-purple-600 border-b-2 border-purple-600'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="activeTab = 'category'"
        >{{ t('spendings.byCategory') }}</button>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="activeTab === 'inbox'" class="h-full">
          <InboxPanel
            :collapsed="false"
            :collapsible="false"
            @add-transaction="openAddTransaction"
          />
        </div>
        <div v-else class="p-4 bg-gray-50 dark:bg-gray-900 min-h-full">
          <div v-if="categoryItems.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <p class="text-lg">{{ t('spendings.noTransactionsYet') }}</p>
          </div>
          <div v-else class="grid grid-cols-1 gap-4 items-start">
            <CategoryCard
              v-for="item in categoryItems"
              :key="item.key"
              :category="item.key"
              :transactions="transactionsByCategory.get(item.key) ?? []"
              :pinned="pinnedCategories.includes(item.key)"
              @toggle-pin="togglePin"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Dialogs -->
    <TransactionDetailDialog
      v-model="showDetailDialog"
      :transaction="selectedTransaction"
      @close="showDetailDialog = false"
      @split="openSplit"
      @create-rule="openCreateRule"
    />
    <SplitDialog
      v-model="showSplitDialog"
      :transaction="selectedTransaction"
      @close="showSplitDialog = false"
    />
    <CreateRuleDialog
      v-model="showCreateRuleDialog"
      :transaction="selectedTransaction"
      @close="showCreateRuleDialog = false"
    />
    <AddTransactionDialog
      v-model="showAddDialog"
      @close="showAddDialog = false"
    />
  </div>
</template>

<style scoped>
.dragging-ghost {
  opacity: 0.4;
}
.dragging-chosen {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  transform: scale(1.02);
  z-index: 50;
}
.dragging-drag {
  transform: rotate(1.5deg) scale(1.03);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
}
</style>
