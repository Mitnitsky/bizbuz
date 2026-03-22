<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { collection, orderBy, query, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { updateLoanTracker } from '@/services/firestore'
import { extractTrackerFields } from '@/composables/useTracker'
import LoanCard from '@/components/loans/LoanCard.vue'
import LoanSummary from '@/components/loans/LoanSummary.vue'
import AddLoanDialog from '@/components/loans/AddLoanDialog.vue'
import TrackerDialog from '@/components/TrackerDialog.vue'
import type { TrackerType } from '@/types'
import type { LoanItem } from '@/components/loans/LoanCard.vue'
import type { Unsubscribe } from 'firebase/firestore'

const { t } = useI18n()
const authStore = useAuthStore()

const loans = ref<LoanItem[]>([])
let unsub: Unsubscribe | null = null

const addDialogOpen = ref(false)
const trackerDialogOpen = ref(false)
const trackerTarget = ref<LoanItem | null>(null)

const totalRemaining = computed(() => loans.value.reduce((s, l) => s + l.remaining, 0))

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
    loans.value = snapshot.docs.map((doc) => {
      const d = doc.data()
      const tracker = extractTrackerFields(d)
      return {
        id: doc.id,
        name: d.name ?? '',
        principal: d.principal ?? 0,
        remaining: d.remaining ?? 0,
        lastUpdated: toDate(d.last_updated),
        ...tracker,
      }
    })
  })
})

onUnmounted(() => { unsub?.() })

function openTracker(item: LoanItem) {
  trackerTarget.value = item
  trackerDialogOpen.value = true
}

async function saveTracker(payload: { trackerType: TrackerType | null; trackerDate: Date | null; trackerIntervalDays: number | null }) {
  if (!trackerTarget.value || !authStore.familyId) return
  try {
    await updateLoanTracker(
      authStore.familyId,
      trackerTarget.value.id,
      payload.trackerType,
      payload.trackerDate,
      payload.trackerIntervalDays,
    )
  } catch {
    // silent
  }
  trackerDialogOpen.value = false
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('loans.loansAndMortgages') }}</h1>
      <button
        class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
        @click="addDialogOpen = true"
      >{{ t('loans.addLoan') }}</button>
    </div>

    <template v-if="loans.length > 0">
      <LoanSummary
        :total-remaining="totalRemaining"
        :loan-count="loans.length"
      />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LoanCard
          v-for="loan in loans"
          :key="loan.id"
          :loan="loan"
          @open-tracker="openTracker"
        />
      </div>
    </template>

    <template v-else>
      <div class="text-center py-16">
        <p class="text-gray-500 dark:text-gray-400 text-lg">{{ t('loans.noLoans') }}</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">{{ t('loans.addLoanOrMortgageToTrack') }}</p>
        <button
          class="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          @click="addDialogOpen = true"
        >{{ t('loans.addLoan') }}</button>
      </div>
    </template>

    <AddLoanDialog :open="addDialogOpen" @close="addDialogOpen = false" />
    <TrackerDialog
      :open="trackerDialogOpen"
      :tracker-type="trackerTarget?.trackerType"
      :tracker-date="trackerTarget?.trackerDate"
      :tracker-interval-days="trackerTarget?.trackerIntervalDays"
      @close="trackerDialogOpen = false"
      @save="saveTracker"
    />
  </div>
</template>
