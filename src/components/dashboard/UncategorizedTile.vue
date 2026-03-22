<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const router = useRouter()

const count = computed(() => txnStore.inboxCount)
const totalAmount = computed(() =>
  txnStore.inboxTransactions
    .filter(tx => tx.chargedAmount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.chargedAmount), 0)
)
</script>

<template>
  <div
    v-if="count > 0"
    class="bg-amber-50 dark:bg-amber-900/20 rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
    @click="router.push('/spendings')"
  >
    <h3 class="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">{{ t('home.uncategorized') }}</h3>
    <div class="text-2xl font-bold text-amber-800 dark:text-amber-100">{{ count }}</div>
    <p class="text-sm text-amber-600 dark:text-amber-400 mt-1">{{ formatCurrency(totalAmount) }} {{ t('home.uncategorizedDesc') }}</p>
  </div>
</template>
