<script setup lang="ts">
import { ref, computed, watch, inject, type Ref } from 'vue'
import type { Transaction } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { categorizeTransaction } from '@/services/firestore'
import { categoryDisplayName, categoryTooltip, NON_BUDGET_CATEGORY } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useIcons } from '@/composables/useIcons'
import { useI18n } from 'vue-i18n'
import TransactionListItem from './TransactionListItem.vue'

const props = defineProps<{
  category: string
  transactions: Transaction[]
}>()

const { t } = useI18n()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const { icon } = useIcons()

const allCategoriesExpanded = inject<Ref<boolean>>('allCategoriesExpanded', ref(true))
const isExpanded = ref(true)
const showAll = ref(false)
const isDragOver = ref(false)
const DEFAULT_VISIBLE = 5

watch(allCategoriesExpanded, (val) => {
  isExpanded.value = val
})

const locale = computed(() => prefsStore.locale)
const overrides = computed(() => familyStore.familySettings.categoryNameOverrides)

const displayName = computed(() => {
  return categoryDisplayName(props.category, locale.value, overrides.value)
})

const tooltip = computed(() => {
  return categoryTooltip(props.category, locale.value)
})

const isNonBudget = computed(() => props.category === NON_BUDGET_CATEGORY)

const total = computed(() => {
  return props.transactions.reduce((sum, t) => sum + t.chargedAmount, 0)
})

const budget = computed(() => {
  return familyStore.familySettings.categoryBudgets[props.category] ?? 0
})

const overBudget = computed(() => {
  if (!budget.value) return false
  return Math.abs(total.value) > budget.value
})

const visibleTransactions = computed(() => {
  if (showAll.value) return props.transactions
  return props.transactions.slice(0, DEFAULT_VISIBLE)
})

const hiddenCount = computed(() => {
  return Math.max(0, props.transactions.length - DEFAULT_VISIBLE)
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

// HTML5 Drop target for transaction categorization
function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('text/x-transaction-id')) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types.includes('text/x-transaction-id')) {
    isDragOver.value = true
  }
}

function onDragLeave() {
  isDragOver.value = false
}

async function onDrop(e: DragEvent) {
  isDragOver.value = false
  const txnId = e.dataTransfer?.getData('text/x-transaction-id')
  if (!txnId) return
  const familyId = familyStore.family?.id
  if (!familyId) return
  await categorizeTransaction(familyId, txnId, props.category)
}
</script>

<template>
  <div
    class="rounded-xl border transition-all duration-200"
    :class="[
      isDragOver
        ? 'border-purple-500 ring-2 ring-purple-300 dark:ring-purple-600 shadow-lg'
        : 'border-gray-200 dark:border-gray-700 shadow-sm',
      isNonBudget
        ? 'bg-gray-50 dark:bg-gray-800/60 opacity-80'
        : 'bg-white dark:bg-gray-800'
    ]"
    @dragover="onDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
      @click="toggleExpand"
    >
      <span class="category-drag-handle cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click.stop><component :is="icon('grip')" class="w-4 h-4" /></span>
      <span class="font-semibold text-sm text-gray-900 dark:text-gray-100 flex-1 truncate" :title="tooltip">{{ displayName }}
        <span v-if="tooltip" class="text-gray-400 ml-0.5 cursor-help inline-flex align-middle" :title="tooltip"><component :is="icon('info')" class="w-3 h-3" /></span>
      </span>
      <span v-if="overBudget && !isNonBudget" class="text-xs text-red-600 dark:text-red-400 font-medium">{{ t('spendings.overBudget') }}</span>
      <span v-if="budget > 0 && !overBudget && !isNonBudget" class="text-xs text-gray-400">
        {{ formatCurrency(Math.abs(total)) }} / {{ formatCurrency(budget) }}
      </span>
      <span class="text-sm font-semibold" :class="isNonBudget ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'">{{ formatCurrency(total) }}</span>
      <component :is="icon('chevronDown')" class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" :class="isExpanded ? 'rotate-180' : ''" />
    </div>

    <!-- Transaction list -->
    <div v-if="isExpanded" class="border-t border-gray-100 dark:border-gray-700">
      <div v-if="transactions.length === 0" class="px-4 py-6 text-center text-sm text-gray-400">
        {{ t('spendings.noTransactionsYet') }}
      </div>
      <template v-else>
        <TransactionListItem
          v-for="txn in visibleTransactions"
          :key="txn.id"
          :transaction="txn"
          :draggable="true"
          :muted-amount="isNonBudget"
        />
        <button
          v-if="!showAll && hiddenCount > 0"
          class="w-full px-4 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click.stop="showAll = true"
        >{{ t('spendings.showMore', { n: hiddenCount }) }}</button>
      </template>
    </div>
  </div>
</template>
