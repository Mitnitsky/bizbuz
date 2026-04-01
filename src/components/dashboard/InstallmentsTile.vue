<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '@/stores/transactions'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const txnStore = useTransactionsStore()

const installments = computed(() => {
  return txnStore.cycleTransactions
    .filter(txn => txn.installments && txn.installments.total > 1 && !txn.hiddenFromInstallments)
})

const count = computed(() => installments.value.length)

const totalRemaining = computed(() => {
  return installments.value.reduce((sum, txn) => {
    const inst = txn.installments!
    const monthly = Math.abs(txn.chargedAmount)
    const remaining = inst.total - inst.number
    return sum + remaining * monthly
  }, 0)
})

const monthlyTotal = computed(() => {
  return installments.value.reduce((sum, txn) => sum + Math.abs(txn.chargedAmount), 0)
})
</script>

<template>
  <div
    v-if="count > 0"
    class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
    @click="router.push('/installments')"
  >
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('home.futurePayments') }}</h3>
    <div class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ formatCurrency(totalRemaining) }}</div>
    <div class="flex items-center justify-between mt-1">
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ count }} {{ t('installments.activeCount').toLowerCase() }} · {{ formatCurrency(monthlyTotal) }}/{{ t('installments.month') }}</span>
    </div>
  </div>
</template>
