<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavingsStore } from '@/stores/savings'
import { useFamilyStore } from '@/stores/family'
import { formatCurrency } from '@/composables/useFormatters'
import { useIcons } from '@/composables/useIcons'
import SavingsEntryCard from '@/components/savings/SavingsEntryCard.vue'
import AddSavingsDialog from '@/components/savings/AddSavingsDialog.vue'
import type { SavingsEntry, SavingsType } from '@/types'

const { t } = useI18n()
const savingsStore = useSavingsStore()
const familyStore = useFamilyStore()
const { icon } = useIcons()

const dataLoading = computed(() => !savingsStore.loaded || !familyStore.familyLoaded)

const liquidOpen = ref(true)
const lockedOpen = ref(true)
const addDialogOpen = ref(false)
const addDialogType = ref<SavingsType>('liquid')
const editingEntry = ref<SavingsEntry | null>(null)

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
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4 space-y-6">
    <!-- Skeleton loading state -->
    <template v-if="dataLoading">
      <div class="animate-pulse space-y-6">
        <div v-for="i in 2" :key="i" class="bg-white dark:bg-gray-800 rounded-xl shadow">
          <div class="p-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                <div>
                  <div class="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                  <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
              <div class="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div class="flex items-center justify-between mt-3">
              <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              <div class="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
          <div class="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            <div v-for="j in 3" :key="j" class="px-5 py-4 flex items-center justify-between">
              <div>
                <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div class="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
    <!-- Liquid Money Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="icon('savings')" class="w-8 h-8 text-green-500" />
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-300">{{ t('savings.liquidMoney') }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('savings.liquidMoneySubtitle') }}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ formatCurrency(savingsStore.liquidTotal) }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3">
          <button
            class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            @click="liquidOpen = !liquidOpen"
          >
            <component :is="liquidOpen ? icon('chevronUp') : icon('chevronDown')" class="w-3.5 h-3.5 inline" />
            {{ savingsStore.liquidEntries.length }} {{ t('savings.items') }}</button>
          <button
            class="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
            @click="openAddDialog('liquid')"
          >{{ t('savings.addAccount') }}</button>
        </div>
      </div>
      <div v-if="liquidOpen && savingsStore.liquidEntries.length > 0">
        <SavingsEntryCard
          v-for="entry in savingsStore.liquidEntries"
          :key="entry.id"
          :entry="entry"
          @edit="openEdit"
        />
      </div>
    </div>

    <!-- Locked Funds Section -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <component :is="icon('lock')" class="w-8 h-8 text-purple-500" />
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-300">{{ t('savings.lockedFunds') }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('savings.lockedFundsSubtitle') }}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ formatCurrency(savingsStore.lockedTotal) }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between mt-3">
          <button
            class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            @click="lockedOpen = !lockedOpen"
          >
            <component :is="lockedOpen ? icon('chevronUp') : icon('chevronDown')" class="w-3.5 h-3.5 inline" />
            {{ savingsStore.lockedEntries.length }} {{ t('savings.items') }}</button>
          <button
            class="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
            @click="openAddDialog('locked')"
          >{{ t('savings.addFund') }}</button>
        </div>
      </div>
      <div v-if="lockedOpen && savingsStore.lockedEntries.length > 0">
        <SavingsEntryCard
          v-for="entry in savingsStore.lockedEntries"
          :key="entry.id"
          :entry="entry"
          @edit="openEdit"
        />
      </div>
    </div>

    </template>

    <!-- Dialogs -->
    <AddSavingsDialog
      :open="addDialogOpen"
      :initial-type="addDialogType"
      :entry="editingEntry"
      @close="addDialogOpen = false; editingEntry = null"
    />
  </div>
</template>
