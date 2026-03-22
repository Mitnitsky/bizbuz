<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavingsStore } from '@/stores/savings'
import { useAuthStore } from '@/stores/auth'
import { formatCurrency } from '@/composables/useFormatters'
import { useIcons } from '@/composables/useIcons'
import { updateSavingsTracker } from '@/services/firestore'
import SavingsEntryCard from '@/components/savings/SavingsEntryCard.vue'
import AddSavingsDialog from '@/components/savings/AddSavingsDialog.vue'
import TrackerDialog from '@/components/TrackerDialog.vue'
import type { SavingsEntry, SavingsType, TrackerType } from '@/types'

const { t } = useI18n()
const savingsStore = useSavingsStore()
const authStore = useAuthStore()
const { icon } = useIcons()

const liquidOpen = ref(true)
const lockedOpen = ref(true)
const addDialogOpen = ref(false)
const addDialogType = ref<SavingsType>('liquid')
const editingEntry = ref<SavingsEntry | null>(null)

const trackerDialogOpen = ref(false)
const trackerTarget = ref<SavingsEntry | null>(null)

function openAddDialog(type: SavingsType) {
  editingEntry.value = null
  addDialogType.value = type
  addDialogOpen.value = true
}

function openEdit(entry: SavingsEntry) {
  editingEntry.value = entry
  addDialogType.value = entry.savingsType
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
  <div class="max-w-7xl mx-auto w-full p-4 space-y-6">
    <!-- Liquid Money Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="icon('savings')" class="w-8 h-8 text-green-500" />
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
          >
            <component :is="liquidOpen ? icon('chevronUp') : icon('chevronDown')" class="w-3.5 h-3.5 inline" />
            {{ savingsStore.liquidEntries.length }} items</button>
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
          @edit="openEdit"
        />
      </div>
    </div>

    <!-- Locked Funds Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="icon('lock')" class="w-8 h-8 text-blue-500" />
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
          >
            <component :is="lockedOpen ? icon('chevronUp') : icon('chevronDown')" class="w-3.5 h-3.5 inline" />
            {{ savingsStore.lockedEntries.length }} items</button>
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
          @edit="openEdit"
        />
      </div>
    </div>

    <!-- Dialogs -->
    <AddSavingsDialog
      :open="addDialogOpen"
      :initial-type="addDialogType"
      :entry="editingEntry"
      @close="addDialogOpen = false; editingEntry = null"
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
