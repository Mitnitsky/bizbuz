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
    class="rounded-xl shadow p-5 cursor-pointer hover:shadow-md transition-shadow"
    :class="count > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'"
    @click="router.push('/spendings')"
  >
    <h3 class="text-sm font-medium mb-1" :class="count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'">{{ t('home.uncategorized') }}</h3>
    <div v-if="count > 0" class="text-2xl font-bold text-amber-800 dark:text-amber-100">{{ count }}</div>
    <div v-else class="text-2xl font-bold text-green-800 dark:text-green-100">✓</div>
    <p class="text-sm mt-1" :class="count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'">
      {{ count > 0 ? `${formatCurrency(totalAmount)} ${t('home.uncategorizedDesc')}` : t('spendings.allCategorized') }}
    </p>
  </div>
</template>
