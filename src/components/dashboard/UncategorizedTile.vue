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
    class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
    @click="router.push('/spendings')"
  >
    <h3 class="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-1">{{ t('home.uncategorized') }}</h3>
    <div class="text-2xl font-bold text-orange-700 dark:text-orange-300">{{ count }}</div>
    <p class="text-sm text-orange-500 dark:text-orange-400/80 mt-1">{{ formatCurrency(totalAmount) }} {{ t('home.uncategorizedDesc') }}</p>
  </div>
</template>
