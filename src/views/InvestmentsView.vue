<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { collection, orderBy, query, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { extractTrackerFields } from '@/composables/useTracker'
import InvestmentCard from '@/components/investments/InvestmentCard.vue'
import InvestmentSummary from '@/components/investments/InvestmentSummary.vue'
import AddInvestmentDialog from '@/components/investments/AddInvestmentDialog.vue'
import type { InvestmentItem } from '@/components/investments/InvestmentCard.vue'
import type { Unsubscribe } from 'firebase/firestore'

const { t } = useI18n()
const authStore = useAuthStore()
const familyStore = useFamilyStore()

const investments = ref<InvestmentItem[]>([])
const loaded = ref(false)
let unsub: Unsubscribe | null = null

const dataLoading = computed(() => !loaded.value || !familyStore.familyLoaded)

const addDialogOpen = ref(false)
const editingInvestment = ref<InvestmentItem | null>(null)

const totalInvested = computed(() => investments.value.reduce((s, i) => s + i.investedAmount, 0))
const totalCurrentValue = computed(() => investments.value.reduce((s, i) => s + i.currentValue, 0))

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate()
  if (val instanceof Date) return val
  if (typeof val === 'string') return new Date(val)
  return new Date()
}

onMounted(() => {
  const familyId = authStore.familyId
  if (!familyId) return
  const q = query(collection(db, 'families', familyId, 'investments'), orderBy('name'))
  unsub = onSnapshot(q, (snapshot) => {
    investments.value = snapshot.docs.map((doc) => {
      const d = doc.data()
      const tracker = extractTrackerFields(d)
      return {
        id: doc.id,
        name: d.name ?? '',
        investedAmount: d.invested_amount ?? 0,
        currentValue: d.current_value ?? 0,
        lastUpdated: toDate(d.last_updated),
        ...tracker,
      }
    })
    loaded.value = true
  })
})

onUnmounted(() => { unsub?.() })

function openEdit(item: InvestmentItem) {
  editingInvestment.value = item
  addDialogOpen.value = true
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <!-- Skeleton loading state -->
    <template v-if="dataLoading">
      <div class="animate-pulse">
        <div class="flex items-center justify-between mb-4">
          <div class="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <!-- Summary skeleton -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5 mb-4">
          <div class="grid grid-cols-3 gap-4">
            <div v-for="i in 3" :key="i">
              <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div class="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
        <!-- Investment cards skeleton -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="i in 2" :key="i" class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div class="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div class="h-3 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ t('nav.investments') }}</h1>
      <button
        class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
        @click="editingInvestment = null; addDialogOpen = true"
      >{{ t('investments.addInvestment') }}</button>
    </div>

    <template v-if="investments.length > 0">
      <InvestmentSummary
        :total-current-value="totalCurrentValue"
        :total-invested="totalInvested"
        :asset-count="investments.length"
      />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InvestmentCard
          v-for="inv in investments"
          :key="inv.id"
          :investment="inv"
          @edit="openEdit"
        />
      </div>
    </template>

    <template v-else>
      <div class="text-center py-16">
        <p class="text-gray-500 dark:text-gray-400 text-lg">{{ t('investments.noInvestments') }}</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">{{ t('investments.addInvestmentToTrack') }}</p>
      </div>
    </template>

    </template>

    <AddInvestmentDialog :open="addDialogOpen" :investment="editingInvestment" @close="addDialogOpen = false; editingInvestment = null" />
  </div>
</template>
