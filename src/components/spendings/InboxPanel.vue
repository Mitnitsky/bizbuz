<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useI18n } from 'vue-i18n'
import TransactionListItem from './TransactionListItem.vue'

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

const inboxTransactions = computed(() => txnStore.inboxTransactions)
const inboxCount = computed(() => txnStore.inboxCount)
</script>

<template>
  <div
    class="flex flex-col border-r border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800"
    :class="collapsible ? '' : 'w-full border-r-0'"
    :style="collapsible ? { width: collapsed ? '48px' : '340px' } : undefined"
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
      <!-- Header -->
      <div class="flex items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
        <div class="flex-1" />
        <button
          class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"
          @click="emit('addTransaction')"
        >+ {{ t('spendings.addTransaction') }}</button>
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
  </div>
</template>
