<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const txnStore = useTransactionsStore()

const totalObligations = computed(() => {
  return txnStore.visibleTransactions
    .filter(txn => txn.installments && txn.installments.total > 0)
    .reduce((sum, txn) => {
      const installments = txn.installments!
      const remaining = txn.originalAmount - (txn.chargedAmount * installments.number)
      return sum + Math.max(0, remaining)
    }, 0)
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('home.futurePayments') }}</h3>
    <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalObligations) }}</div>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('home.totalInstallmentObligations') }}</p>
  </div>
</template>
