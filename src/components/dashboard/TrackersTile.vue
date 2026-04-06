<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSavingsStore } from '@/stores/savings'
import { useAuthStore } from '@/stores/auth'
import { onInvestments, onLoans } from '@/services/firestore'
import { trackerDaysRemaining } from '@/composables/useTracker'
import type { InvestmentEntry, LoanEntry } from '@/types'
import type { Unsubscribe } from 'firebase/firestore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const savingsStore = useSavingsStore()
const authStore = useAuthStore()

const investments = ref<InvestmentEntry[]>([])
const loans = ref<LoanEntry[]>([])
let unsubInvestments: Unsubscribe | null = null
let unsubLoans: Unsubscribe | null = null

onMounted(() => {
  const familyId = authStore.familyId
  if (familyId) {
    unsubInvestments = onInvestments(familyId, (items) => { investments.value = items })
    unsubLoans = onLoans(familyId, (items) => { loans.value = items })
  }
})

onUnmounted(() => {
  unsubInvestments?.()
  unsubLoans?.()
})

interface TrackerItem {
  name: string
  type: 'savings' | 'investment' | 'loan'
  daysRemaining: number | null
}

const trackerItems = computed<TrackerItem[]>(() => {
  const items: TrackerItem[] = []

  for (const entry of savingsStore.entries) {
    if (!entry.trackerType) continue
    items.push({
      name: entry.name,
      type: 'savings',
      daysRemaining: trackerDaysRemaining(entry, entry.lastUpdated),
    })
  }

  for (const entry of investments.value) {
    if (!entry.trackerType) continue
    items.push({
      name: entry.name,
      type: 'investment',
      daysRemaining: trackerDaysRemaining(entry, entry.lastUpdated),
    })
  }

  for (const entry of loans.value) {
    if (!entry.trackerType) continue
    items.push({
      name: entry.name,
      type: 'loan',
      daysRemaining: trackerDaysRemaining(entry, entry.lastUpdated),
    })
  }

  items.sort((a, b) => {
    const aOverdue = (a.daysRemaining ?? 0) < 0 ? 0 : 1
    const bOverdue = (b.daysRemaining ?? 0) < 0 ? 0 : 1
    if (aOverdue !== bOverdue) return aOverdue - bOverdue
    return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0)
  })

  return items
})

const hasTrackers = computed(() => trackerItems.value.length > 0)

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'savings': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'investment': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'loan': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'savings': return t('nav.savings')
    case 'investment': return t('nav.investments')
    case 'loan': return t('nav.loans')
    default: return type
  }
}

function daysLabel(days: number | null): string {
  if (days === null) return ''
  if (days < 0) return t('tracker.updateOverdue')
  return t('tracker.updateIn', { n: days })
}

function typeRoute(type: string): string {
  switch (type) {
    case 'savings': return '/savings'
    case 'investment': return '/investments'
    case 'loan': return '/loans'
    default: return '/'
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{{ t('home.trackers') }}</h3>

    <div v-if="!hasTrackers" class="text-gray-400 dark:text-gray-500 text-sm">{{ t('home.noTrackers') }}</div>

    <div v-else class="space-y-2.5">
      <router-link
        v-for="(item, idx) in trackerItems"
        :key="`${item.type}-${item.name}-${idx}`"
        :to="typeRoute(item.type)"
        class="flex items-center gap-2 rounded-md px-1 py-0.5 -mx-1 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      >
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{{ item.name }}</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
          :class="typeBadgeClass(item.type)"
        >
          {{ typeLabel(item.type) }}
        </span>
        <span
          class="ml-auto text-sm shrink-0"
          :class="(item.daysRemaining ?? 0) < 0 ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'"
        >
          {{ daysLabel(item.daysRemaining) }}
        </span>
      </router-link>
    </div>
  </div>
</template>
