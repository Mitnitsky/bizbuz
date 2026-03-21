<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted, watchEffect } from 'vue'
import type { Transaction } from '@/types'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useI18n } from 'vue-i18n'
import { updateCategoryOrder } from '@/services/firestore'
import draggable from 'vuedraggable'
import CycleSelector from '@/components/spendings/CycleSelector.vue'
import OwnerFilterChip from '@/components/OwnerFilterChip.vue'
import InboxPanel from '@/components/spendings/InboxPanel.vue'
import CategoryCard from '@/components/spendings/CategoryCard.vue'
import TransactionDetailDialog from '@/components/spendings/TransactionDetailDialog.vue'
import SplitDialog from '@/components/spendings/SplitDialog.vue'
import CreateRuleDialog from '@/components/spendings/CreateRuleDialog.vue'
import AddTransactionDialog from '@/components/spendings/AddTransactionDialog.vue'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

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

// --- Category grouping ---
const categorizedTransactions = computed(() => {
  return txnStore.cycleTransactions.filter(t => t.status !== 'pending_categorization')
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

watchEffect(() => {
  const order = familyStore.familySettings.categoryOrder
  const allCats = [...transactionsByCategory.value.keys()]
  const ordered: string[] = []
  for (const cat of order) {
    if (allCats.includes(cat)) ordered.push(cat)
  }
  for (const cat of allCats) {
    if (!ordered.includes(cat)) ordered.push(cat)
  }
  categoryItems.value = ordered.map(key => ({ key }))
})

async function onCategoryReorder() {
  const order = categoryItems.value.map(item => item.key)
  const familyId = familyStore.family?.id
  if (familyId) {
    await updateCategoryOrder(familyId, order)
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
  <div class="flex flex-col h-full min-h-0">
    <!-- App Bar -->
    <div class="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100 mr-2">{{ t('nav.spendings') }}</h1>
      <CycleSelector />
      <OwnerFilterChip v-if="showOwnerFilter" />
      <div class="flex-1" />
      <button
        class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        @click="toggleExpandAll"
      >{{ allCategoriesExpanded ? t('spendings.collapseAll') : t('spendings.expandAll') }}</button>
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
        <draggable
          v-else
          v-model="categoryItems"
          item-key="key"
          handle=".category-drag-handle"
          class="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-2 min-[1600px]:grid-cols-3"
          @end="onCategoryReorder"
        >
          <template #item="{ element }">
            <CategoryCard
              :category="element.key"
              :transactions="transactionsByCategory.get(element.key) ?? []"
            />
          </template>
        </draggable>
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
        >{{ t('spendings.inbox') }} ({{ txnStore.inboxCount }})</button>
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
          <div v-else class="grid grid-cols-1 gap-4">
            <CategoryCard
              v-for="item in categoryItems"
              :key="item.key"
              :category="item.key"
              :transactions="transactionsByCategory.get(item.key) ?? []"
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
