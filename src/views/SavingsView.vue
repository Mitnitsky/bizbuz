<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavingsStore } from '@/stores/savings'
import { useAuthStore } from '@/stores/auth'
import { formatCurrency } from '@/composables/useFormatters'
import { updateSavingsTracker } from '@/services/firestore'
import SavingsEntryCard from '@/components/savings/SavingsEntryCard.vue'
import AddSavingsDialog from '@/components/savings/AddSavingsDialog.vue'
import TrackerDialog from '@/components/TrackerDialog.vue'
import type { SavingsEntry, SavingsType, TrackerType } from '@/types'

const { t } = useI18n()
const savingsStore = useSavingsStore()
const authStore = useAuthStore()

const liquidOpen = ref(true)
const lockedOpen = ref(true)
const addDialogOpen = ref(false)
const addDialogType = ref<SavingsType>('liquid')

const trackerDialogOpen = ref(false)
const trackerTarget = ref<SavingsEntry | null>(null)

function openAddDialog(type: SavingsType) {
  addDialogType.value = type
  addDialogOpen.value = true
}

function openTracker(entry: SavingsEntry) {
  trackerTarget.value = entry
  trackerDialogOpen.value = true
}

async function saveTracker(payload: { trackerType: TrackerType | null; trackerDate: Date | null; trackerIntervalDays: number | null }) {
  if (!trackerTarget.value || !authStore.familyId) return
  try {
    await updateSavingsTracker(
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
  <div class="p-4 max-w-3xl mx-auto space-y-6">
    <!-- Liquid Money Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-3xl">💰</span>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('savings.liquidMoney') }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('savings.liquidMoneySubtitle') }}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ formatCurrency(savingsStore.liquidTotal) }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3">
          <button
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            @click="liquidOpen = !liquidOpen"
          >{{ liquidOpen ? '▲' : '▼' }} {{ savingsStore.liquidEntries.length }} items</button>
          <button
            class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
            @click="openAddDialog('liquid')"
          >{{ t('savings.addAccount') }}</button>
        </div>
      </div>
      <div v-if="liquidOpen && savingsStore.liquidEntries.length > 0">
        <SavingsEntryCard
          v-for="entry in savingsStore.liquidEntries"
          :key="entry.id"
          :entry="entry"
          @open-tracker="openTracker"
        />
      </div>
    </div>

    <!-- Locked Funds Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🔒</span>
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('savings.lockedFunds') }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('savings.lockedFundsSubtitle') }}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ formatCurrency(savingsStore.lockedTotal) }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3">
          <button
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            @click="lockedOpen = !lockedOpen"
          >{{ lockedOpen ? '▲' : '▼' }} {{ savingsStore.lockedEntries.length }} items</button>
          <button
            class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            @click="openAddDialog('locked')"
          >{{ t('savings.addFund') }}</button>
        </div>
      </div>
      <div v-if="lockedOpen && savingsStore.lockedEntries.length > 0">
        <SavingsEntryCard
          v-for="entry in savingsStore.lockedEntries"
          :key="entry.id"
          :entry="entry"
          @open-tracker="openTracker"
        />
      </div>
    </div>

    <!-- Dialogs -->
    <AddSavingsDialog
      :open="addDialogOpen"
      :initial-type="addDialogType"
      @close="addDialogOpen = false"
    />
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
