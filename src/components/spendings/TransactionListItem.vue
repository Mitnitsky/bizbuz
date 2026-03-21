<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Transaction } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'

const props = defineProps<{
  transaction: Transaction
  draggable?: boolean
}>()

const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const openDetail = inject<(txn: Transaction) => void>('openTransactionDetail')

const displayTitle = computed(() => {
  return props.transaction.overrideDescription || props.transaction.description
})

const isAutoCategorized = computed(() => {
  return props.transaction.status === 'auto_categorized'
})

const paymentLabel = computed(() => {
  const labels = familyStore.familySettings.paymentMethodLabels
  const t = props.transaction
  if (t.companyId && labels[t.companyId]) return labels[t.companyId]
  if (t.account && labels[t.account]) return labels[t.account]
  return ''
})

const showPaymentSource = computed(() => {
  return prefsStore.userPreferences?.showPaymentSource && paymentLabel.value
})

const amountClass = computed(() => {
  return props.transaction.chargedAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
})

function onDragStart(e: DragEvent) {
  if (!props.draggable || !e.dataTransfer) return
  e.dataTransfer.setData('text/x-transaction-id', props.transaction.id)
  e.dataTransfer.effectAllowed = 'move'
}

function onClick() {
  openDetail?.(props.transaction)
}
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
    :draggable="draggable"
    @dragstart="onDragStart"
    @click="onClick"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5">
        <span class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ displayTitle }}</span>
        <span v-if="isAutoCategorized" class="text-xs flex-shrink-0" title="Auto-categorized">🤖</span>
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        <span>{{ formatDateShort(transaction.date) }}</span>
        <span
          v-if="showPaymentSource"
          class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
        >{{ paymentLabel }}</span>
      </div>
    </div>
    <span class="text-sm font-semibold whitespace-nowrap" :class="amountClass">
      {{ formatCurrency(transaction.chargedAmount) }}
    </span>
  </div>
</template>
