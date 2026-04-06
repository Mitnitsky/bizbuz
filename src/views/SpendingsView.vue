<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted, watchEffect, nextTick } from 'vue'
import type { Transaction, CategorySortMode } from '@/types'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'
import { TRANSFER_CATEGORY, INCOME_CATEGORY, categoryDisplayName, NON_BUDGET_CATEGORY, DEFAULT_CATEGORY, getEffectiveCategories, isSharedCategory } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { updateCategoryOrder, updateUserPreferences, onRules, autoCategorizeTransaction } from '@/services/firestore'
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

const dataLoading = computed(() => !txnStore.loaded || !familyStore.familyLoaded)

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
  // Sync collapse state to the target view
  if (mode === 'list') {
    if (allCategoriesExpanded.value) {
      expandedGroups.value = new Set(categoryItems.value.map(i => i.key))
    } else {
      expandedGroups.value = new Set()
    }
  } else {
    // Switching to cards — sync allCategoriesExpanded from list state
    allCategoriesExpanded.value = expandedGroups.value.size >= categoryItems.value.length
  }
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
const activeTab = ref<'inbox' | 'category'>(
  uiStore.highlightedCategory ? 'category' :
  txnStore.inboxCount > 0 ? 'inbox' : 'category'
)

// --- Inbox collapse (wide layout) ---
const inboxCollapsed = ref(txnStore.inboxCount === 0)

// --- Highlighted category (from pie chart navigation) ---
const highlightedCategory = ref<string | null>(uiStore.highlightedCategory)

function clearHighlight() {
  highlightedCategory.value = null
  uiStore.highlightedCategory = null
}

onMounted(() => {
  if (highlightedCategory.value) {
    activeTab.value = 'category'
    nextTick(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-category="${highlightedCategory.value}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    })
    const clear = () => {
      clearHighlight()
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('click', clear, true)
      window.removeEventListener('touchstart', clear, true)
    }
    // Auto-clear after 3 seconds
    const timer = setTimeout(clear, 3000)
    // Also clear on interaction (after short grace period for scroll-into-view)
    setTimeout(() => {
      const earlyDismiss = () => { clearTimeout(timer); clear() }
      window.addEventListener('scroll', earlyDismiss, { capture: true, once: true })
      window.addEventListener('click', earlyDismiss, { capture: true, once: true })
      window.addEventListener('touchstart', earlyDismiss, { capture: true, once: true })
    }, 800)
  }
})

// --- Expand/collapse all categories ---
const EXPAND_KEY = 'bizbuz:categoriesExpanded'
const allCategoriesExpanded = ref(localStorage.getItem(EXPAND_KEY) !== 'false')
provide('allCategoriesExpanded', allCategoriesExpanded)

function toggleExpandAll() {
  allCategoriesExpanded.value = !allCategoriesExpanded.value
  localStorage.setItem(EXPAND_KEY, String(allCategoriesExpanded.value))
  // Sync list view expanded groups
  if (allCategoriesExpanded.value) {
    expandedGroups.value = new Set(categoryItems.value.map(i => i.key))
  } else {
    expandedGroups.value = new Set()
  }
}

// --- Owner-filtered transactions (local to this page) ---
const ownerFilteredTransactions = computed(() => {
  const filter = uiStore.ownerFilter
  if (filter === 'all') return txnStore.cycleTransactions
  const cats = familyStore.familySettings.categories
  if (filter === 'shared') {
    // Shared view: ownerTag=shared + any txn in a shared category
    return txnStore.cycleTransactions.filter(t =>
      t.ownerTag === 'shared' || isSharedCategory(t.category, cats)
    )
  }
  // User view: only this owner's txns, excluding shared categories
  return txnStore.cycleTransactions.filter(t =>
    t.ownerTag === filter && !isSharedCategory(t.category, cats)
  )
})

// Total spending for filtered transactions (expenses only, excludes transfers)
const filteredTotalSpending = computed(() => {
  return filteredCategorizedTransactions.value
    .filter(t => t.chargedAmount < 0
      && t.category !== TRANSFER_CATEGORY
      && t.category !== NON_BUDGET_CATEGORY)
    .reduce((sum, t) => sum + Math.abs(t.chargedAmount), 0)
})

// --- Category grouping ---
const categorizedTransactions = computed(() => {
  return ownerFilteredTransactions.value.filter(t => {
    if (t.status === 'pending_categorization') return false
    return true
  })
})

// --- "New only" filter ---
const showNewOnly = ref(false)
const newTransactionCount = computed(() =>
  categorizedTransactions.value.filter(t => t.isNew).length
)

// --- Search filter ---
const searchQuery = ref('')
provide('searchQuery', searchQuery)

// --- Re-run rules on all transactions ---
import { matchRule } from '@/composables/useRuleMatcher'
import type { Rule } from '@/types'

const rerunningRules = ref(false)
const rerunRulesResult = ref<{ moved: number; total: number } | null>(null)
const movedTxnIds = ref<Set<string>>(new Set())
const movedTxnDetails = ref<Map<string, { from: string; to: string; ruleDesc: string }>>(new Map())
const showMovedOnly = ref(false)
const allRules = ref<Rule[]>([])
let unsubAllRules: (() => void) | null = null

onMounted(() => {
  if (authStore.familyId) {
    unsubAllRules = onRules(authStore.familyId, (r) => { allRules.value = r })
  }
})
onUnmounted(() => { unsubAllRules?.() })

async function rerunRulesOnAll() {
  if (!authStore.familyId || rerunningRules.value) return
  rerunningRules.value = true
  rerunRulesResult.value = null
  const moved = new Set<string>()
  const details = new Map<string, { from: string; to: string; ruleDesc: string }>()
  const allTxns = txnStore.cycleTransactions
  for (const txn of allTxns) {
    const rule = matchRule(txn, allRules.value)
    if (rule && rule.actionCategory !== txn.category) {
      const fromCat = txn.category || DEFAULT_CATEGORY
      details.set(txn.id, {
        from: fromCat,
        to: rule.actionCategory,
        ruleDesc: rule.conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(', '),
      })
      await autoCategorizeTransaction(
        authStore.familyId,
        txn.id,
        rule.actionCategory,
        rule.id!,
        rule.actionOverrideDescription,
      )
      moved.add(txn.id)
    }
  }
  movedTxnIds.value = moved
  movedTxnDetails.value = details
  rerunRulesResult.value = { moved: moved.size, total: allTxns.length }
  rerunningRules.value = false
  if (moved.size > 0) showMovedOnly.value = true
  else setTimeout(() => { rerunRulesResult.value = null }, 3000)
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1])
    }
    prev = curr
  }
  return prev[n]
}

function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (q.length < 3) return t.includes(q)
  if (t.includes(q)) return true
  // Sliding window over full text (preserving spaces) with edit distance ≤ 2
  const lo = Math.max(1, q.length - 1)
  const hi = q.length + 1
  for (let len = lo; len <= Math.min(hi, t.length); len++) {
    for (let start = 0; start <= t.length - len; start++) {
      if (levenshtein(t.slice(start, start + len), q) <= 1) return true
    }
  }
  return false
}

function txnMatchesSearch(txn: Transaction): boolean {
  const q = searchQuery.value.trim()
  if (!q) return true
  const name = txn.overrideDescription || txn.description
  return fuzzyMatch(name, q)
}

const filteredCategorizedTransactions = computed(() => {
  if (!showNewOnly.value) return categorizedTransactions.value
  return categorizedTransactions.value.filter(t => t.isNew)
})

const transactionsByCategory = computed(() => {
  const map = new Map<string, Transaction[]>()
  for (const t of filteredCategorizedTransactions.value) {
    // Skip income — we'll use the deduped list below
    if (t.category === INCOME_CATEGORY) continue
    const cat = t.category || DEFAULT_CATEGORY
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(t)
  }
  // Use deduped income transactions (earliest per description, extended window)
  const incomeTxns = txnStore.cycleIncomeTransactions
  if (incomeTxns.length > 0) {
    map.set(INCOME_CATEGORY, [...incomeTxns])
  }
  return map
})

// Ordered list of category items for vuedraggable (wrapped as objects)
const categoryItems = ref<Array<{ key: string }>>([])

// Search-filtered views
const displayTransactionsByCategory = computed(() => {
  if (!searchQuery.value.trim()) return transactionsByCategory.value
  const map = new Map<string, Transaction[]>()
  for (const [cat, txns] of transactionsByCategory.value) {
    const filtered = txns.filter(txnMatchesSearch)
    if (filtered.length > 0) map.set(cat, filtered)
  }
  return map
})

const displayCategoryItems = computed(() => {
  if (!searchQuery.value.trim()) return categoryItems.value
  const matchingCats = displayTransactionsByCategory.value
  return categoryItems.value.filter(item => matchingCats.has(item.key))
})

// When search or "new" filter is active, show a flat list instead of cards/list
const isFilterActive = computed(() => !!searchQuery.value.trim() || showNewOnly.value || showMovedOnly.value)

const filteredFlatList = computed(() => {
  if (!isFilterActive.value) return []
  const results: Array<{ txn: Transaction; category: string }> = []
  const seen = new Set<string>()
  for (const [cat, txns] of displayTransactionsByCategory.value) {
    for (const txn of txns) {
      if (seen.has(txn.id)) continue
      if (showMovedOnly.value) {
        if (movedTxnIds.value.has(txn.id)) {
          seen.add(txn.id)
          // Use the "to" category from move details (the transaction's new home)
          const detail = movedTxnDetails.value.get(txn.id)
          results.push({ txn, category: detail?.to || cat })
        }
      } else if (showNewOnly.value) {
        if (txn.isNew) { seen.add(txn.id); results.push({ txn, category: cat }) }
      } else if (txnMatchesSearch(txn)) {
        seen.add(txn.id)
        results.push({ txn, category: cat })
      }
    }
  }
  return results
})

function collectAllCategories(): string[] {
  const effective = getEffectiveCategories(familyStore.familySettings.categories)
  const allCats: string[] = effective.map(c => c.id).filter(c => c !== TRANSFER_CATEGORY)
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
        const nameA = categoryDisplayName(a, locale, getEffectiveCategories(familyStore.familySettings.categories), overrides)
        const nameB = categoryDisplayName(b, locale, getEffectiveCategories(familyStore.familySettings.categories), overrides)
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
    <!-- Skeleton loading state -->
    <template v-if="dataLoading">
      <div class="animate-pulse flex flex-col h-full">
        <!-- App bar skeleton -->
        <div class="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div class="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div class="flex-1" />
          <div class="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <!-- Content skeleton -->
        <div class="flex-1 overflow-hidden p-4 bg-gray-50 dark:bg-gray-900">
          <div class="columns-1 min-[1000px]:columns-2 min-[1600px]:columns-3 gap-4">
            <div v-for="i in 6" :key="i" class="mb-4 break-inside-avoid bg-white dark:bg-gray-800 rounded-xl shadow p-5">
              <div class="flex items-center justify-between mb-3">
                <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div class="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full mb-3" />
              <div class="space-y-2">
                <div v-for="j in 3" :key="j" class="flex items-center justify-between">
                  <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded" :style="{ width: (100 + j * 20) + 'px' }" />
                  <div class="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
    <!-- App Bar -->
    <div class="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100 mr-2">{{ t('nav.spendings') }}</h1>
      <CycleSelector />
      <OwnerFilterChip v-if="showOwnerFilter && familyStore.family && familyStore.family.memberUids.length > 1" />
      <button
        v-if="newTransactionCount > 0"
        class="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
        :class="showNewOnly
          ? 'bg-emerald-600 text-white'
          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50'"
        @click="showNewOnly = !showNewOnly"
      >{{ t('common.new') }} {{ newTransactionCount }}</button>
      <!-- Re-run rules button -->
      <button
        class="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50"
        :class="rerunRulesResult && rerunRulesResult.moved === 0
          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
          : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50'"
        :disabled="rerunningRules"
        @click="rerunRulesOnAll"
      >
        <span v-if="rerunningRules" class="animate-spin inline-block w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full" />
        <span v-else-if="rerunRulesResult && rerunRulesResult.moved === 0">✓ {{ t('spendings.noChanges') }}</span>
        <span v-else>{{ t('spendings.rerunRules') }}</span>
      </button>
      <!-- Moved filter chip -->
      <button
        v-if="movedTxnIds.size > 0"
        class="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
        :class="showMovedOnly
          ? 'bg-amber-600 text-white'
          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50'"
        @click="showMovedOnly = !showMovedOnly"
      >{{ t('spendings.moved') }} {{ movedTxnIds.size }}</button>
      <span class="text-sm font-semibold text-purple-700 dark:text-purple-300">{{ formatCurrency(filteredTotalSpending) }}</span>
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('spendings.searchPlaceholder')"
          class="w-40 lg:w-56 px-3 py-1.5 ps-8 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
        />
        <svg class="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke-linecap="round" stroke-width="2"/></svg>
        <button v-if="searchQuery" class="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="searchQuery = ''">✕</button>
      </div>
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
        <div v-if="isFilterActive && filteredFlatList.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
          <p v-if="searchQuery.trim()" class="text-lg">{{ t('spendings.noSearchResults') }}</p>
          <p v-else class="text-lg">{{ t('spendings.noTransactionsYet') }}</p>
        </div>

        <!-- Flat filtered list (search or "new" active) -->
        <div v-else-if="isFilterActive" class="space-y-1 max-w-3xl mx-auto">
          <div
            v-for="item in filteredFlatList"
            :key="item.txn.id"
            class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
          >
            <div class="flex items-center gap-2 px-3 pt-1.5 pb-0 flex-wrap">
              <span class="text-[11px] text-purple-600 dark:text-purple-400 font-medium truncate">{{ categoryDisplayName(item.category, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}</span>
              <template v-if="showMovedOnly && movedTxnDetails.has(item.txn.id)">
                <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  {{ categoryDisplayName(movedTxnDetails.get(item.txn.id)!.from, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}
                  <span class="rtl:-scale-x-100 inline-block">→</span>
                  {{ categoryDisplayName(movedTxnDetails.get(item.txn.id)!.to, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}
                </span>
                <span class="text-[9px] text-gray-400 dark:text-gray-500 truncate max-w-[200px]" :title="movedTxnDetails.get(item.txn.id)!.ruleDesc">
                  {{ movedTxnDetails.get(item.txn.id)!.ruleDesc }}
                </span>
              </template>
            </div>
            <TransactionListItem
              :transaction="item.txn"
              :draggable="false"
              :muted-amount="item.category === NON_BUDGET_CATEGORY"
            />
          </div>
        </div>

        <div v-else-if="displayCategoryItems.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
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
            <div
              v-if="displayTransactionsByCategory.has(element.key)"
              :data-category="element.key"
              class="transition-all duration-500"
              :class="{ 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900 rounded-xl': highlightedCategory === element.key }"
            >
              <CategoryCard
                :category="element.key"
                :transactions="displayTransactionsByCategory.get(element.key) ?? []"
                :pinned="pinnedCategories.includes(element.key)"
                @toggle-pin="togglePin"
              />
            </div>
          </template>
        </draggable>

        <!-- List view -->
        <div v-else class="space-y-1">
          <template v-for="item in displayCategoryItems" :key="item.key">
            <div
              v-if="(displayTransactionsByCategory.get(item.key)?.length ?? 0) > 0 || expandedGroups.has(item.key)"
              :data-category="item.key"
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-all duration-500"
              :class="{ 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900': highlightedCategory === item.key }"
            >
              <!-- Group header -->
              <button
                type="button"
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
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
                <span class="text-xs text-gray-400 transition-transform rtl:-scale-x-100" :class="{ 'rotate-90 rtl:-rotate-90': expandedGroups.has(item.key) }">▶</span>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-300 flex-1 text-start truncate">
                  {{ categoryDisplayName(item.key, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {{ displayTransactionsByCategory.get(item.key)?.length ?? 0 }}
                </span>
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums min-w-[5rem] text-end">
                  {{ formatCurrency((displayTransactionsByCategory.get(item.key) ?? []).reduce((s, t) => s + Math.abs(t.chargedAmount), 0)) }}
                </span>
              </button>
              <!-- Expanded transactions -->
              <div v-if="expandedGroups.has(item.key)" class="border-t border-gray-100 dark:border-gray-700">
                <TransactionListItem
                  v-for="txn in displayTransactionsByCategory.get(item.key) ?? []"
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
          <!-- Mobile search -->
          <div class="relative mb-3">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('spendings.searchPlaceholder')"
              class="w-full px-3 py-2 ps-8 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <svg class="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke-linecap="round" stroke-width="2"/></svg>
            <button v-if="searchQuery" class="absolute end-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="searchQuery = ''">✕</button>
          </div>
          <div v-if="isFilterActive && filteredFlatList.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <p v-if="searchQuery.trim()" class="text-lg">{{ t('spendings.noSearchResults') }}</p>
            <p v-else class="text-lg">{{ t('spendings.noTransactionsYet') }}</p>
          </div>

          <!-- Flat filtered list (search or "new" active) -->
          <div v-else-if="isFilterActive" class="space-y-2">
            <div
              v-for="item in filteredFlatList"
              :key="item.txn.id"
              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <div class="flex items-center gap-2 px-3 pt-1.5 pb-0 flex-wrap">
                <span class="text-[11px] text-purple-600 dark:text-purple-400 font-medium truncate">{{ categoryDisplayName(item.category, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}</span>
                <template v-if="showMovedOnly && movedTxnDetails.has(item.txn.id)">
                  <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    {{ categoryDisplayName(movedTxnDetails.get(item.txn.id)!.from, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}
                    <span class="rtl:-scale-x-100 inline-block">→</span>
                    {{ categoryDisplayName(movedTxnDetails.get(item.txn.id)!.to, prefsStore.locale, getEffectiveCategories(familyStore.familySettings.categories), familyStore.familySettings.categoryNameOverrides) }}
                  </span>
                  <span class="text-[9px] text-gray-400 dark:text-gray-500 truncate max-w-[200px]" :title="movedTxnDetails.get(item.txn.id)!.ruleDesc">
                    {{ movedTxnDetails.get(item.txn.id)!.ruleDesc }}
                  </span>
                </template>
              </div>
              <TransactionListItem
                :transaction="item.txn"
                :draggable="false"
                :muted-amount="item.category === NON_BUDGET_CATEGORY"
              />
            </div>
          </div>

          <div v-else-if="displayCategoryItems.length === 0" class="flex flex-col items-center justify-center py-20 text-gray-400">
            <p class="text-lg">{{ t('spendings.noTransactionsYet') }}</p>
          </div>
          <div v-else class="grid grid-cols-1 gap-4 items-start">
            <div
              v-for="item in displayCategoryItems"
              :key="item.key"
              :data-category="item.key"
              class="transition-all duration-500"
              :class="{ 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-gray-900 rounded-xl': highlightedCategory === item.key }"
            >
              <CategoryCard
                :category="item.key"
                :transactions="displayTransactionsByCategory.get(item.key) ?? []"
                :pinned="pinnedCategories.includes(item.key)"
                @toggle-pin="togglePin"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

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
