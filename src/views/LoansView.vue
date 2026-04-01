<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { collection, orderBy, query, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { extractTrackerFields } from '@/composables/useTracker'
import { deserializeTracks } from '@/services/firestore'
import LoanCard from '@/components/loans/LoanCard.vue'
import AddLoanDialog from '@/components/loans/AddLoanDialog.vue'
import type { LoanItem } from '@/components/loans/LoanCard.vue'
import type { LoanType } from '@/types'
import type { Unsubscribe } from 'firebase/firestore'

const { t } = useI18n()
const authStore = useAuthStore()
const familyStore = useFamilyStore()

const allItems = ref<LoanItem[]>([])
const loaded = ref(false)
let unsub: Unsubscribe | null = null

const dataLoading = computed(() => !loaded.value || !familyStore.familyLoaded)

const addDialogOpen = ref(false)
const editingLoan = ref<LoanItem | null>(null)
const addType = ref<LoanType>('loan')

const loans = computed(() => allItems.value.filter((l) => l.loanType === 'loan'))
const mortgages = computed(() => allItems.value.filter((l) => l.loanType === 'mortgage'))

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
    loaded.value = true
  })
})

onUnmounted(() => { unsub?.() })

function openEdit(item: LoanItem) {
  editingLoan.value = item
  addType.value = item.loanType
  addDialogOpen.value = true
}

function openAdd() {
  editingLoan.value = null
  addDialogOpen.value = true
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <!-- Skeleton loading state -->
    <template v-if="dataLoading">
      <div class="animate-pulse">
        <div class="flex items-center justify-between mb-4">
          <div class="h-7 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <!-- Loan section skeleton -->
        <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div class="space-y-4 mb-6">
          <div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div class="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div>
                <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded ms-auto" />
              </div>
            </div>
            <div class="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ t('loans.loansAndMortgages') }}</h1>
      <button
        class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
        @click="openAdd"
      >+ {{ t('common.add') }}</button>
    </div>

    <template v-if="allItems.length > 0">
      <!-- Loans section -->
      <template v-if="loans.length > 0">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-300 mb-3">{{ t('loans.loans') }}</h2>
        <div class="space-y-4 mb-6">
          <LoanCard
            v-for="item in loans"
            :key="item.id"
            :loan="item"
            @edit="openEdit"
          />
        </div>
      </template>

      <!-- Mortgages section -->
      <template v-if="mortgages.length > 0">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-300 mb-3">{{ t('loans.mortgages') }}</h2>
        <div class="space-y-4">
          <LoanCard
            v-for="item in mortgages"
            :key="item.id"
            :loan="item"
            @edit="openEdit"
          />
        </div>
      </template>
    </template>

    <template v-else>
      <div class="text-center py-16">
        <p class="text-gray-500 dark:text-gray-400 text-lg">{{ t('loans.noLoans') }}</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">{{ t('loans.addLoanOrMortgageToTrack') }}</p>
        <button
          class="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          @click="openAdd"
        >+ {{ t('common.add') }}</button>
      </div>
    </template>

    </template>

    <AddLoanDialog
      :open="addDialogOpen"
      :loan="editingLoan"
      :default-type="addType"
      @close="addDialogOpen = false; editingLoan = null"
    />
  </div>
</template>
