<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Transaction } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransactionsStore } from '@/stores/transactions'
import { useIcons } from '@/composables/useIcons'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'

const { t } = useI18n()
const { icon } = useIcons()

const props = defineProps<{
  transaction: Transaction
  draggable?: boolean
  mutedAmount?: boolean
}>()

const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const txnStore = useTransactionsStore()
const openDetail = inject<(txn: Transaction) => void>('openTransactionDetail')

const isNew = computed(() => txnStore.isNewTransaction(props.transaction))

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
  if (props.mutedAmount) return 'text-gray-400 dark:text-gray-500'
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
        <span v-if="isNew" class="px-1 py-0.5 rounded text-[10px] leading-none font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex-shrink-0">NEW</span>
        <component v-if="isAutoCategorized" :is="icon('bot')" class="w-3.5 h-3.5 text-purple-400 flex-shrink-0" title="Auto-categorized" />
        <span
          v-if="transaction.isSplit"
          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] leading-none font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex-shrink-0"
        ><component :is="icon('scissors')" class="w-2.5 h-2.5" /> {{ t('spendings.split') }}</span>
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        <span>{{ formatDateShort(transaction.date) }}</span>
        <span
          v-if="transaction.installments && transaction.installments.total > 1"
          class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
        >{{ t('installments.payment', { n: transaction.installments.number, total: transaction.installments.total }) }}</span>
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
