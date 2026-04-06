<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, provide } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { onRules, autoCategorizeTransaction, uncategorizeTransaction, deleteTransaction } from '@/services/firestore'
import { useIcons } from '@/composables/useIcons'
import { useFamilyStore } from '@/stores/family'
import { matchRule } from '@/composables/useRuleMatcher'
import type { Rule } from '@/types'
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
const familyStore = useFamilyStore()
const { icon } = useIcons()

const inboxSort = ref<InboxSort>('date')
const inboxSortDir = ref<'asc' | 'desc'>('desc')
const rules = ref<Rule[]>([])
const rerunning = ref(false)
const rerunResult = ref<{ matched: number; total: number } | null>(null)
let unsubRules: (() => void) | null = null

const isDragOver = ref(false)
const dragEnterCount = ref(0)

// Multi-select state
const selectionMode = ref(false)
const selectedIds = ref(new Set<string>())

// Auto-exit selection mode when all selected items leave the inbox
watch(() => txnStore.inboxTransactions, (inbox) => {
  if (!selectionMode.value || selectedIds.value.size === 0) return
  const inboxIds = new Set(inbox.map(t => t.id))
  const remaining = new Set([...selectedIds.value].filter(id => inboxIds.has(id)))
  if (remaining.size === 0) {
    selectionMode.value = false
    selectedIds.value = new Set()
  } else if (remaining.size !== selectedIds.value.size) {
    selectedIds.value = remaining
  }
})

provide('inboxSelectionMode', selectionMode)
provide('inboxSelectedIds', selectedIds)

function toggleSelection(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
  if (s.size === 0) selectionMode.value = false
}
provide('toggleInboxSelection', toggleSelection)
provide('exitInboxSelection', exitSelectionMode)

function selectAll() {
  selectedIds.value = new Set(inboxTransactions.value.map(t => t.id))
}
function selectNone() {
  selectedIds.value = new Set()
}
function exitSelectionMode() {
  selectionMode.value = false
  selectedIds.value = new Set()
}

async function deleteSelected() {
  const familyId = familyStore.family?.id
  if (!familyId || selectedIds.value.size === 0) return
  const ids = [...selectedIds.value]
  exitSelectionMode()
  for (const id of ids) {
    await deleteTransaction(familyId, id)
  }
}

function onInboxDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('text/x-transaction-id')) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
}
function onInboxDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types.includes('text/x-transaction-id')) {
    dragEnterCount.value++
    isDragOver.value = true
  }
}
function onInboxDragLeave() {
  dragEnterCount.value--
  if (dragEnterCount.value <= 0) {
    dragEnterCount.value = 0
    isDragOver.value = false
  }
}
async function onInboxDrop(e: DragEvent) {
  e.preventDefault()
  dragEnterCount.value = 0
  isDragOver.value = false
  const txnId = e.dataTransfer?.getData('text/x-transaction-id')
  if (!txnId) return
  const familyId = familyStore.family?.id
  if (!familyId) return
  await uncategorizeTransaction(familyId, txnId)
}

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

async function rerunRules() {
  if (!authStore.familyId || rerunning.value) return
  rerunning.value = true
  rerunResult.value = null
  let matched = 0
  const inbox = txnStore.inboxTransactions
  for (const txn of inbox) {
    const rule = matchRule(txn, rules.value)
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

const inboxFilter = ref<'all' | 'unique' | 'new'>('all')

const inboxTransactions = computed(() => {
  let txns = [...txnStore.inboxTransactions]

  // Apply filter
  if (inboxFilter.value === 'unique') {
    txns = txns.filter(t => txnStore.isUniqueTransaction(t))
  } else if (inboxFilter.value === 'new') {
    txns = txns.filter(t => txnStore.isNewTransaction(t))
  }

  const flip = inboxSortDir.value === 'asc' ? 1 : -1
  switch (inboxSort.value) {
    case 'name':
      return txns.sort((a, b) => flip * a.description.localeCompare(b.description))
    case 'amount':
      return txns.sort((a, b) => flip * (Math.abs(b.chargedAmount) - Math.abs(a.chargedAmount)))
    case 'date':
    default:
      return txns.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0
        const db = b.date ? new Date(b.date).getTime() : 0
        return flip * (db - da)
      })
  }
})
const inboxCount = computed(() => txnStore.inboxCount)

// Telegram-style leave animation: capture height, then animate out
function onBeforeLeave(el: Element) {
  const htmlEl = el as HTMLElement
  const { height } = htmlEl.getBoundingClientRect()
  htmlEl.style.height = height + 'px'
  htmlEl.style.overflow = 'hidden'
}

function onLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  // Force reflow so the initial state is applied
  void htmlEl.offsetHeight
  htmlEl.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
  htmlEl.style.height = '0px'
  htmlEl.style.opacity = '0'
  htmlEl.style.paddingTop = '0px'
  htmlEl.style.paddingBottom = '0px'
  htmlEl.style.marginTop = '0px'
  htmlEl.style.marginBottom = '0px'
  htmlEl.style.transform = 'translateX(-30px)'
  htmlEl.addEventListener('transitionend', done, { once: true })
}
</script>

<template>
  <div
    class="flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 relative transition-all duration-200"
    :class="[
      collapsible ? '' : 'w-full border-r-0',
      isDragOver ? 'ring-2 ring-purple-400 dark:ring-purple-500 bg-purple-50/50 dark:bg-purple-900/20' : ''
    ]"
    :style="collapsible ? { width: collapsed ? '48px' : panelWidth + 'px' } : undefined"
    @dragover="onInboxDragOver"
    @dragenter="onInboxDragEnter"
    @dragleave="onInboxDragLeave"
    @drop="onInboxDrop"
  >
    <!-- Collapsed strip -->
    <div v-if="collapsible && collapsed" class="flex flex-col items-center py-4 gap-2">
      <button
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        @click="emit('toggle')"
        title="Expand inbox"
      >
        <component :is="icon('inbox')" class="w-5 h-5" />
      </button>
      <span
        v-if="inboxCount > 0"
        class="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center"
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
        <div class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs font-medium">
          <button
            class="px-2 py-1 transition-colors flex items-center gap-1"
            :class="inboxSort === 'date'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="inboxSort === 'date' ? (inboxSortDir = inboxSortDir === 'desc' ? 'asc' : 'desc') : (inboxSort = 'date', inboxSortDir = 'desc')"
          >{{ t('spendings.date') }}<span v-if="inboxSort === 'date'" class="text-[10px]">{{ inboxSortDir === 'desc' ? '▼' : '▲' }}</span></button>
          <button
            class="px-2 py-1 border-x border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-1"
            :class="inboxSort === 'name'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="inboxSort === 'name' ? (inboxSortDir = inboxSortDir === 'desc' ? 'asc' : 'desc') : (inboxSort = 'name', inboxSortDir = 'asc')"
          >{{ t('spendings.description') }}<span v-if="inboxSort === 'name'" class="text-[10px]">{{ inboxSortDir === 'desc' ? '▼' : '▲' }}</span></button>
          <button
            class="px-2 py-1 transition-colors flex items-center gap-1"
            :class="inboxSort === 'amount'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="inboxSort === 'amount' ? (inboxSortDir = inboxSortDir === 'desc' ? 'asc' : 'desc') : (inboxSort = 'amount', inboxSortDir = 'desc')"
          >{{ t('spendings.amount') }}<span v-if="inboxSort === 'amount'" class="text-[10px]">{{ inboxSortDir === 'desc' ? '▼' : '▲' }}</span></button>
        </div>
        <!-- Filter pills -->
        <div class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs font-medium">
          <button
            class="px-2 py-1 transition-colors"
            :class="inboxFilter === 'all'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="inboxFilter = 'all'"
          >{{ t('common.all') }}</button>
          <button
            class="px-2 py-1 border-x border-gray-300 dark:border-gray-600 transition-colors"
            :class="inboxFilter === 'unique'
              ? 'bg-violet-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="inboxFilter = inboxFilter === 'unique' ? 'all' : 'unique'"
          >🦄</button>
          <button
            class="px-2 py-1 transition-colors"
            :class="inboxFilter === 'new'
              ? 'bg-emerald-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="inboxFilter = inboxFilter === 'new' ? 'all' : 'new'"
          >{{ t('common.new') }}</button>
        </div>
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
          v-if="inboxCount > 0"
          class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
          :class="selectionMode
            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="selectionMode ? exitSelectionMode() : (selectionMode = true)"
          :title="selectionMode ? t('common.cancel') : t('spendings.select')"
        ><component :is="icon('edit')" class="w-3.5 h-3.5" /></button>
        <button
          class="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
          @click="emit('addTransaction')"
        ><component :is="icon('plus')" class="w-3.5 h-3.5" /> {{ t('spendings.addTransaction') }}</button>
      </div>

      <!-- Bulk action bar -->
      <div
        v-if="selectionMode"
        class="px-3 py-1.5 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20 flex-shrink-0"
      >
        <button
          class="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
          @click="selectedIds.size === inboxTransactions.length ? selectNone() : selectAll()"
        >{{ selectedIds.size === inboxTransactions.length ? t('common.selectNone') : t('common.selectAll') }}</button>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ selectedIds.size }} {{ t('common.selected') }}</span>
        <div class="flex-1" />
        <button
          v-if="selectedIds.size > 0"
          class="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
          @click="deleteSelected"
        ><component :is="icon('trash')" class="w-3 h-3" /> {{ t('common.delete') }}</button>
      </div>

      <!-- Transaction list -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="inboxTransactions.length === 0" class="flex flex-col items-center justify-center py-12 px-4 text-center">
          <span class="text-3xl mb-2">✓</span>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ t('spendings.inboxZero') }}</p>
        </div>
        <TransitionGroup
          v-else
          tag="div"
          class="py-1"
          name="inbox-item"
          @before-leave="onBeforeLeave"
          @leave="onLeave"
        >
          <TransactionListItem
            v-for="txn in inboxTransactions"
            :key="txn.id"
            :transaction="txn"
            :draggable="true"
          />
        </TransitionGroup>
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

<style scoped>
/* Sibling items slide up smoothly when one is removed */
.inbox-item-move {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Items leaving are taken out of flow so siblings can animate */
.inbox-item-leave-active {
  position: relative;
  z-index: 0;
}

/* Enter animation for new items */
.inbox-item-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.inbox-item-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
