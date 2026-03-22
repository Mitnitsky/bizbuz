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
  pinned?: boolean
}>()

const emit = defineEmits<{
  togglePin: [category: string]
}>()

const { t } = useI18n()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const { icon } = useIcons()

const allCategoriesExpanded = inject<Ref<boolean>>('allCategoriesExpanded', ref(true))
const isExpanded = ref(true)
const showAll = ref(false)
const isDragOver = ref(false)
const showTooltip = ref(false)
const dragEnterCount = ref(0)
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
  const hasTxn = e.dataTransfer?.types.includes('text/x-transaction-id')
  if (hasTxn) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = 'move'
  }
}

function onDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types.includes('text/x-transaction-id')) {
    e.stopPropagation()
    dragEnterCount.value++
    isDragOver.value = true
    console.log('[DND] dragenter on', props.category, 'count=', dragEnterCount.value)
  }
}

function onDragLeave(e: DragEvent) {
  e.stopPropagation()
  dragEnterCount.value--
  if (dragEnterCount.value <= 0) {
    dragEnterCount.value = 0
    isDragOver.value = false
  }
  console.log('[DND] dragleave on', props.category, 'count=', dragEnterCount.value)
}

async function onDrop(e: DragEvent) {
  console.log('[DND] DROP on', props.category, 'types=', Array.from(e.dataTransfer?.types ?? []))
  e.preventDefault()
  e.stopPropagation()
  dragEnterCount.value = 0
  isDragOver.value = false
  const txnId = e.dataTransfer?.getData('text/x-transaction-id')
  console.log('[DND] txnId=', txnId)
  if (!txnId) return
  const familyId = familyStore.family?.id
  if (!familyId) return
  await categorizeTransaction(familyId, txnId, props.category)
  console.log('[DND] categorized', txnId, '->', props.category)
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
      class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
      @click="toggleExpand"
    >
      <span class="category-drag-handle cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click.stop><component :is="icon('grip')" class="w-4 h-4" /></span>
      <button
        class="transition-colors shrink-0"
        :class="pinned ? 'text-purple-500' : 'text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400'"
        @click.stop="emit('togglePin', category)"
        :title="pinned ? 'Unpin' : 'Pin'"
      ><component :is="icon('pin')" class="w-3.5 h-3.5" /></button>
      <span class="font-semibold text-sm text-gray-900 dark:text-gray-100 flex-1 truncate">{{ displayName }}</span>
        <span
          v-if="tooltip"
          class="relative inline-flex align-middle cursor-help text-gray-400 hover:text-purple-500 transition-colors shrink-0"
          @click.stop="showTooltip = !showTooltip"
          @mouseenter="showTooltip = true"
          @mouseleave="showTooltip = false"
        >
          <component :is="icon('info')" class="w-3.5 h-3.5" />
          <Transition name="tooltip-pop">
            <div
              v-if="showTooltip"
              class="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg text-xs font-normal leading-snug whitespace-normal w-56 text-gray-100 bg-gray-900 dark:bg-gray-700 shadow-lg pointer-events-none"
            >
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px border-4 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
              {{ tooltip }}
            </div>
          </Transition>
        </span>
      <span v-if="overBudget && !isNonBudget" class="text-xs text-red-600 dark:text-red-400 font-medium">{{ t('spendings.overBudget') }}</span>
      <span v-if="budget > 0 && !overBudget && !isNonBudget" class="text-xs text-gray-400">
        {{ formatCurrency(Math.abs(total)) }} / {{ formatCurrency(budget) }}
      </span>
      <span class="text-sm font-semibold" :class="isNonBudget ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'">{{ formatCurrency(total) }}</span>
      <component :is="icon('chevronDown')" class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200" :class="isExpanded ? 'rotate-180' : ''" />
    </div>

    <!-- Drop preview slot -->
    <Transition name="drop-slot">
      <div
        v-if="isDragOver"
        class="mx-3 mb-2 h-10 rounded-lg border-2 border-dashed border-purple-400 dark:border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 flex items-center justify-center"
      >
        <span class="text-xs text-purple-500 dark:text-purple-400 animate-pulse">{{ t('spendings.dropHere') }}</span>
      </div>
    </Transition>

    <!-- Transaction list -->
    <div v-if="isExpanded" class="border-t border-gray-100 dark:border-gray-700">
      <div v-if="transactions.length === 0" class="px-4 py-6 text-center text-sm text-gray-400">
        {{ t('spendings.noTransactionsYet') }}
      </div>
      <template v-else>
        <TransitionGroup name="cat-item">
          <TransactionListItem
            v-for="txn in visibleTransactions"
            :key="txn.id"
            :transaction="txn"
            :draggable="true"
            :muted-amount="isNonBudget"
          />
        </TransitionGroup>
        <button
          v-if="!showAll && hiddenCount > 0"
          class="w-full px-4 py-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click.stop="showAll = true"
        >{{ t('spendings.showMore', { n: hiddenCount }) }}</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Drop preview slot */
.drop-slot-enter-from,
.drop-slot-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
}
.drop-slot-enter-active,
.drop-slot-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.drop-slot-enter-to,
.drop-slot-leave-from {
  opacity: 1;
  max-height: 3rem;
}

/* Items entering the category */
.cat-item-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.cat-item-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.cat-item-move {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Tooltip pop animation */
.tooltip-pop-enter-from,
.tooltip-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.95);
}
.tooltip-pop-enter-active {
  transition: all 0.15s ease-out;
}
.tooltip-pop-leave-active {
  transition: all 0.1s ease-in;
}
</style>
