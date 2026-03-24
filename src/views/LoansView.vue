<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { collection, orderBy, query, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { extractTrackerFields } from '@/composables/useTracker'
import { deserializeTracks } from '@/services/firestore'
import LoanCard from '@/components/loans/LoanCard.vue'
import LoanSummary from '@/components/loans/LoanSummary.vue'
import AddLoanDialog from '@/components/loans/AddLoanDialog.vue'
import type { LoanItem } from '@/components/loans/LoanCard.vue'
import type { LoanType } from '@/types'
import type { Unsubscribe } from 'firebase/firestore'

const { t } = useI18n()
const authStore = useAuthStore()

const allItems = ref<LoanItem[]>([])
let unsub: Unsubscribe | null = null

const addDialogOpen = ref(false)
const editingLoan = ref<LoanItem | null>(null)
const activeTab = ref<LoanType>('loan')

const loans = computed(() => allItems.value.filter((l) => l.loanType === 'loan'))
const mortgages = computed(() => allItems.value.filter((l) => l.loanType === 'mortgage'))
const activeItems = computed(() => activeTab.value === 'loan' ? loans.value : mortgages.value)
const totalRemaining = computed(() => activeItems.value.reduce((s, l) => s + l.remaining, 0))

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate()
  if (val instanceof Date) return val
  if (typeof val === 'string') return new Date(val)
  return new Date()
}

onMounted(() => {
  const familyId = authStore.familyId
  if (!familyId) return
  const q = query(collection(db, 'families', familyId, 'loans'), orderBy('name'))
  unsub = onSnapshot(q, (snapshot) => {
    allItems.value = snapshot.docs.map((doc) => {
      const d = doc.data()
      const tracker = extractTrackerFields(d)
      return {
        id: doc.id,
        name: d.name ?? '',
        loanType: (d.loan_type as LoanType) ?? 'loan',
        principal: d.principal ?? 0,
        remaining: d.remaining ?? 0,
        endDate: d.end_date ? toDate(d.end_date) : undefined,
        lastUpdated: toDate(d.last_updated),
        ...tracker,
        tracks: d.tracks ? deserializeTracks(d.tracks as unknown[]) : undefined,
      }
    })
  })
})

onUnmounted(() => { unsub?.() })

function openEdit(item: LoanItem) {
  editingLoan.value = item
  addDialogOpen.value = true
}

function openAdd() {
  editingLoan.value = null
  addDialogOpen.value = true
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('loans.loansAndMortgages') }}</h1>
      <button
        class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
        @click="openAdd"
      >{{ activeTab === 'mortgage' ? t('loans.addMortgage') : t('loans.addLoan') }}</button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1 mb-4">
      <button
        class="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
        :class="activeTab === 'loan'
          ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
        @click="activeTab = 'loan'"
      >
        {{ t('loans.loans') }}
        <span v-if="loans.length" class="ml-1 text-xs opacity-70">({{ loans.length }})</span>
      </button>
      <button
        class="flex-1 py-2 text-sm font-medium rounded-md transition-colors"
        :class="activeTab === 'mortgage'
          ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'"
        @click="activeTab = 'mortgage'"
      >
        {{ t('loans.mortgages') }}
        <span v-if="mortgages.length" class="ml-1 text-xs opacity-70">({{ mortgages.length }})</span>
      </button>
    </div>

    <template v-if="activeItems.length > 0">
      <LoanSummary
        :total-remaining="totalRemaining"
        :loan-count="activeItems.length"
      />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LoanCard
          v-for="item in activeItems"
          :key="item.id"
          :loan="item"
          @edit="openEdit"
        />
      </div>
    </template>

    <template v-else>
      <div class="text-center py-16">
        <p class="text-gray-500 dark:text-gray-400 text-lg">
          {{ activeTab === 'mortgage' ? t('loans.noMortgages') : t('loans.noLoans') }}
        </p>
        <button
          class="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          @click="openAdd"
        >{{ activeTab === 'mortgage' ? t('loans.addMortgage') : t('loans.addLoan') }}</button>
      </div>
    </template>

    <AddLoanDialog
      :open="addDialogOpen"
      :loan="editingLoan"
      :default-type="activeTab"
      @close="addDialogOpen = false; editingLoan = null"
    />
  </div>
</template>
