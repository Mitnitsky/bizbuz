<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '@/stores/transactions'
import { useUiStore } from '@/stores/ui'
import { INCOME_CATEGORY } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const txnStore = useTransactionsStore()
const uiStore = useUiStore()

const hasIncome = computed(() => txnStore.cycleIncome > 0)

function goToIncome() {
  uiStore.highlightedCategory = INCOME_CATEGORY
  router.push('/spendings')
}
</script>

<template>
  <div v-if="hasIncome" class="bg-emerald-50 dark:bg-green-900/20 rounded-xl shadow p-5 hover:shadow-md transition-shadow cursor-pointer" @click="goToIncome">
    <h2 class="text-sm font-medium text-emerald-800 dark:text-green-300 mb-1">{{ t('home.income') }}</h2>
    <div class="text-2xl font-bold text-emerald-900 dark:text-green-100">{{ formatCurrency(txnStore.cycleIncome) }}</div>
    <p class="text-sm text-emerald-700 dark:text-green-400 mt-1">{{ t('home.incomeThisCycle') }}</p>
  </div>
</template>
