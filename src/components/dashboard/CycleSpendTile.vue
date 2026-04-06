<script setup lang="ts">
import { computed } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { computeCycleRange } from '@/composables/useBillingCycle'
import { formatCurrency } from '@/composables/useFormatters'
import { format, startOfDay } from 'date-fns'
import { he } from 'date-fns/locale'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const uiStore = useUiStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const cycleRange = computed(() => {
  const today = startOfDay(new Date())
  return computeCycleRange(today, familyStore.familySettings.cycleStartDay, uiStore.cycleOffset)
})

const dateRange = computed(() => {
  const range = cycleRange.value
  const loc = prefsStore.locale === 'he' ? { locale: he } : {}
  return `${format(range.start, 'dd MMM', loc)} – ${format(range.end, 'dd MMM', loc)}`
})
</script>

<template>
  <router-link to="/spendings" class="block bg-purple-50 dark:bg-purple-900/30 rounded-xl shadow p-5 hover:shadow-md transition-shadow cursor-pointer">
    <h3 class="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">{{ t('home.cycleSpending') }}</h3>
    <div class="text-3xl font-bold text-purple-900 dark:text-purple-100">{{ formatCurrency(txnStore.cycleSpend) }}</div>
    <p class="text-sm text-purple-600 dark:text-purple-400 mt-1">{{ dateRange }}</p>
  </router-link>
</template>
