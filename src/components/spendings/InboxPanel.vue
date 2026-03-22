<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { onRules, autoCategorizeTransaction } from '@/services/firestore'
import { useIcons } from '@/composables/useIcons'
import type { Rule, Transaction } from '@/types'
import TransactionListItem from './TransactionListItem.vue'

type InboxSort = 'date' | 'name' | 'amount'

defineProps<{
  collapsed: boolean
  collapsible?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  addTransaction: []
}>()

const { t } = useI18n()
const txnStore = useTransactionsStore()
const authStore = useAuthStore()
const { icon } = useIcons()

const inboxSort = ref<InboxSort>('date')
const rules = ref<Rule[]>([])
const rerunning = ref(false)
const rerunResult = ref<{ matched: number; total: number } | null>(null)
let unsubRules: (() => void) | null = null

const MIN_WIDTH = 280
const MAX_WIDTH = 600
const panelWidth = ref(parseInt(localStorage.getItem('bizbuz:inboxWidth') || '360', 10))
const isResizing = ref(false)

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  const startW = panelWidth.value

  function onMove(ev: MouseEvent) {
    const delta = ev.clientX - startX
    panelWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + delta))
  }
  function onUp() {
    isResizing.value = false
    localStorage.setItem('bizbuz:inboxWidth', String(panelWidth.value))
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(() => {
  if (authStore.familyId) {
    unsubRules = onRules(authStore.familyId, (r) => { rules.value = r })
  }
})
onUnmounted(() => { unsubRules?.() })

function evaluateCondition(txn: Transaction, cond: { field: string; operator: string; value: string }): boolean {
  const fieldValue = (txn as unknown as Record<string, unknown>)[cond.field]
  switch (cond.operator) {
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().includes(cond.value.toLowerCase())
    case 'equals':
      return fieldValue === cond.value || (typeof fieldValue === 'number' && fieldValue === Number(cond.value))
    case 'starts_with':
      return typeof fieldValue === 'string' && fieldValue.toLowerCase().startsWith(cond.value.toLowerCase())
    case 'not_in':
      return typeof fieldValue === 'string' && !cond.value.split(',').map(v => v.trim()).includes(fieldValue)
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > Number(cond.value)
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < Number(cond.value)
    default:
      return false
  }
}

function matchRule(txn: Transaction): Rule | null {
  for (const rule of rules.value) {
    if (!rule.conditions.length || !rule.actionCategory) continue
    if (rule.conditions.every(c => evaluateCondition(txn, c))) return rule
  }
  return null
}

async function rerunRules() {
  if (!authStore.familyId || rerunning.value) return
  rerunning.value = true
  rerunResult.value = null
  let matched = 0
  const inbox = txnStore.inboxTransactions
  for (const txn of inbox) {
    const rule = matchRule(txn)
    if (rule) {
      await autoCategorizeTransaction(
        authStore.familyId,
        txn.id,
        rule.actionCategory,
        rule.id!,
        rule.actionOverrideDescription,
      )
      matched++
    }
  }
  rerunResult.value = { matched, total: inbox.length }
  rerunning.value = false
  setTimeout(() => { rerunResult.value = null }, 3000)
}

const inboxTransactions = computed(() => {
  const txns = [...txnStore.inboxTransactions]
  switch (inboxSort.value) {
    case 'name':
      return txns.sort((a, b) => a.description.localeCompare(b.description))
    case 'amount':
      return txns.sort((a, b) => Math.abs(b.chargedAmount) - Math.abs(a.chargedAmount))
    case 'date':
    default:
      return txns
  }
})
const inboxCount = computed(() => txnStore.inboxCount)
</script>

<template>
  <div
    class="flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 relative"
    :class="collapsible ? '' : 'w-full border-r-0'"
    :style="collapsible ? { width: collapsed ? '48px' : panelWidth + 'px' } : undefined"
  >
    <!-- Collapsed strip -->
    <div v-if="collapsible && collapsed" class="flex flex-col items-center py-4 gap-2">
      <button
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        @click="emit('toggle')"
        title="Expand inbox"
      >
        📥
      </button>
      <span
        v-if="inboxCount > 0"
        class="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
      >{{ inboxCount > 99 ? '99+' : inboxCount }}</span>
    </div>

    <!-- Expanded content -->
    <template v-if="!collapsible || !collapsed">
      <!-- Header row 1: title + count -->
      <div class="px-3 pt-3 pb-1 flex items-center gap-2 flex-shrink-0">
        <button
          v-if="collapsible"
          class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm"
          @click="emit('toggle')"
          title="Collapse inbox"
        >◀</button>
        <span class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ t('spendings.inbox') }}</span>
        <span
          v-if="inboxCount > 0"
          class="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
        >{{ inboxCount }}</span>
      </div>
      <!-- Header row 2: controls -->
      <div class="px-3 pb-2 flex items-center gap-1.5 flex-wrap border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <select
          v-model="inboxSort"
          class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 text-xs"
        >
          <option value="date">{{ t('spendings.date') }}</option>
          <option value="name">{{ t('spendings.description') }}</option>
          <option value="amount">{{ t('spendings.amount') }}</option>
        </select>
        <button
          v-if="inboxCount > 0"
          class="px-2 py-1 rounded-lg text-xs font-medium transition-colors"
          :class="rerunning
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 cursor-wait'
            : rerunResult
              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'"
          :disabled="rerunning"
          @click="rerunRules"
        >
          <template v-if="rerunning"><component :is="icon('loader')" class="w-3.5 h-3.5 animate-spin inline" /></template>
          <template v-else-if="rerunResult">✓ {{ rerunResult.matched }}/{{ rerunResult.total }}</template>
          <template v-else><component :is="icon('installments')" class="w-3.5 h-3.5 inline" /> {{ t('spendings.rerunRules') }}</template>
        </button>
        <div class="flex-1" />
        <button
          class="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
          @click="emit('addTransaction')"
        ><component :is="icon('plus')" class="w-3.5 h-3.5" /> {{ t('spendings.addTransaction') }}</button>
      </div>

      <!-- Transaction list -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="inboxTransactions.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center">
          <span class="text-3xl mb-2">✓</span>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ t('spendings.inboxZero') }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('spendings.allCategorized') }}</p>
        </div>
        <div v-else class="py-1">
          <TransactionListItem
            v-for="txn in inboxTransactions"
            :key="txn.id"
            :transaction="txn"
            :draggable="true"
          />
        </div>
      </div>
    </template>

    <!-- Resize handle (wide layout only) -->
    <div
      v-if="collapsible && !collapsed"
      class="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-purple-400/40 active:bg-purple-500/50 transition-colors z-10"
      @mousedown="startResize"
    />
  </div>
</template>
