<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { formatCurrency, formatDateShort } from '@/composables/useFormatters'
import { categoryDisplayName } from '@/composables/useCategories'
import { usePreferencesStore } from '@/stores/preferences'
import { useI18n } from 'vue-i18n'
import type { Transaction } from '@/types'

const { t } = useI18n()
const txnStore = useTransactionsStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const locale = computed(() => prefsStore.locale)

type SortKey = 'remaining' | 'endDate' | 'monthly' | 'category'
const sortBy = ref<SortKey>('remaining')

interface InstallmentItem {
  transaction: Transaction
  monthlyAmount: number
  remainingPayments: number
  remainingAmount: number
  estimatedEndDate: Date
  progress: number
}

const installmentItems = computed<InstallmentItem[]>(() => {
  return txnStore.cycleTransactions
    .filter(txn => txn.installments && txn.installments.total > 1)
    .map(txn => {
      const inst = txn.installments!
      const monthly = Math.abs(txn.chargedAmount)
      const remaining = inst.total - inst.number
      const remainingAmount = remaining * monthly
      const endDate = new Date(txn.date)
      endDate.setMonth(endDate.getMonth() + remaining)
      return {
        transaction: txn,
        monthlyAmount: monthly,
        remainingPayments: remaining,
        remainingAmount,
        estimatedEndDate: endDate,
        progress: (inst.number / inst.total) * 100,
      }
    })
})

const sortedItems = computed(() => {
  const items = [...installmentItems.value]
  switch (sortBy.value) {
    case 'remaining': return items.sort((a, b) => b.remainingAmount - a.remainingAmount)
    case 'endDate': return items.sort((a, b) => a.estimatedEndDate.getTime() - b.estimatedEndDate.getTime())
    case 'monthly': return items.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
    case 'category': return items.sort((a, b) => a.transaction.category.localeCompare(b.transaction.category))
    default: return items
  }
})

const totalMonthly = computed(() => installmentItems.value.reduce((s, i) => s + i.monthlyAmount, 0))
const totalRemaining = computed(() => installmentItems.value.reduce((s, i) => s + i.remainingAmount, 0))

function cardLabel(txn: Transaction) {
  const labels = familyStore.familySettings.paymentMethodLabels
  if (txn.companyId && labels[txn.companyId]) return labels[txn.companyId]
  if (txn.account && labels[txn.account]) return labels[txn.account]
  return txn.account || ''
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ t('installments.title') }}</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ t('installments.subtitle') }}</p>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('installments.activeCount') }}</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ installmentItems.length }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('installments.monthlyTotal') }}</div>
        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(totalMonthly) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('installments.totalRemaining') }}</div>
        <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">{{ formatCurrency(totalRemaining) }}</div>
      </div>
    </div>

    <!-- Sort -->
    <div class="flex items-center gap-2 mb-4">
      <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('installments.sortBy') }}:</span>
      <select v-model="sortBy" class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm">
        <option value="remaining">{{ t('installments.sortRemaining') }}</option>
        <option value="endDate">{{ t('installments.sortEndDate') }}</option>
        <option value="monthly">{{ t('installments.sortMonthly') }}</option>
        <option value="category">{{ t('installments.sortCategory') }}</option>
      </select>
    </div>

    <!-- Installments list -->
    <div v-if="sortedItems.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <div class="text-4xl mb-2">✅</div>
      <div class="text-lg">{{ t('installments.noActive') }}</div>
    </div>

    <div v-else class="space-y-3">
      <div v-for="item in sortedItems" :key="item.transaction.id" class="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ item.transaction.overrideDescription || item.transaction.description }}</div>
            <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{{ categoryDisplayName(item.transaction.category, locale) }}</span>
              <span v-if="cardLabel(item.transaction)" class="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{{ cardLabel(item.transaction) }}</span>
              <span>{{ formatDateShort(item.transaction.date) }}</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(item.monthlyAmount) }}<span class="text-xs text-gray-500 dark:text-gray-400">/{{ t('installments.month') }}</span></div>
            <div class="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {{ item.transaction.installments!.number }}/{{ item.transaction.installments!.total }}
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="mt-3">
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{{ t('installments.paid') }}: {{ formatCurrency(item.transaction.installments!.number * item.monthlyAmount) }}</span>
            <span>{{ t('installments.remaining') }}: {{ formatCurrency(item.remainingAmount) }}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all" :style="{ width: item.progress + '%' }"></div>
          </div>
          <div class="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>{{ t('installments.total') }}: {{ formatCurrency(item.transaction.installments!.total * item.monthlyAmount) }}</span>
            <span>{{ t('installments.endsBy') }} {{ formatDateShort(item.estimatedEndDate) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
