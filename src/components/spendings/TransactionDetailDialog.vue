<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Transaction } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import {
  categorizeTransaction,
  updateOwnerTag,
  updateTransactionOverride,
  setTransactionLock,
  deleteTransaction,
} from '@/services/firestore'
import { CATEGORIES, categoryDisplayName } from '@/composables/useCategories'
import { formatCurrency, formatDate } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  transaction: Transaction | null
}>()

const emit = defineEmits<{
  close: []
  split: []
  createRule: []
}>()

const show = defineModel<boolean>({ default: false })

const { t } = useI18n()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const editCategory = ref('')
const editOwner = ref('')
const editOverrideDesc = ref('')

watch(show, (val) => {
  if (val && props.transaction) {
    editCategory.value = props.transaction.category
    editOwner.value = props.transaction.ownerTag
    editOverrideDesc.value = props.transaction.overrideDescription
  }
})

const locale = computed(() => prefsStore.locale)
const overrides = computed(() => familyStore.familySettings.categoryNameOverrides)

async function saveCategory(txn: Transaction) {
  const familyId = familyStore.family?.id
  if (!familyId || editCategory.value === txn.category) return
  await categorizeTransaction(familyId, txn.id, editCategory.value)
}

async function saveOwner(txn: Transaction) {
  const familyId = familyStore.family?.id
  if (!familyId || editOwner.value === txn.ownerTag) return
  await updateOwnerTag(familyId, txn.id, editOwner.value)
}

async function saveOverride(txn: Transaction) {
  const familyId = familyStore.family?.id
  if (!familyId) return
  await updateTransactionOverride(familyId, txn.id, editOverrideDesc.value)
}

async function toggleLock(txn: Transaction) {
  const familyId = familyStore.family?.id
  if (!familyId) return
  await setTransactionLock(familyId, txn.id, !txn.userLocked)
}

async function onDelete(txn: Transaction) {
  const familyId = familyStore.family?.id
  if (!familyId) return
  await deleteTransaction(familyId, txn.id)
  show.value = false
  emit('close')
}

function onSplit() {
  emit('split')
}

function onCreateRule() {
  emit('createRule')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show && transaction"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="show = false"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ transaction.overrideDescription || transaction.description }}
            </h2>
            <p
              class="text-2xl font-bold mt-1"
              :class="transaction.chargedAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >{{ formatCurrency(transaction.chargedAmount) }}</p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl p-1"
            @click="show = false"
          >✕</button>
        </div>

        <!-- Detail grid -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.date') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ formatDate(transaction.date) }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.processedDate') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ formatDate(transaction.processedDate) }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.category') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ categoryDisplayName(transaction.category, locale, overrides) }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.owner') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ familyStore.ownerTagNames[transaction.ownerTag] ?? transaction.ownerTag }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.source') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ transaction.source || '—' }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.originalAmount') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ formatCurrency(transaction.originalAmount) }}</div>

          <template v-if="transaction.installments">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.installments') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.installments.number }} / {{ transaction.installments.total }}</div>
          </template>

          <template v-if="transaction.account">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.account') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.account }}</div>
          </template>

          <template v-if="transaction.appliedRuleId">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.appliedRule') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.appliedRuleId }}</div>
          </template>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.locked') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ transaction.userLocked ? '🔒' : '🔓' }}</div>
        </div>

        <!-- Edit section -->
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
          <!-- Owner -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.owner') }}</label>
            <select
              v-model="editOwner"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              @change="saveOwner(transaction!)"
            >
              <option value="shared">{{ familyStore.ownerTagNames.shared }}</option>
              <option value="userA">{{ familyStore.ownerTagNames.userA ?? 'User A' }}</option>
              <option value="userB">{{ familyStore.ownerTagNames.userB ?? 'User B' }}</option>
            </select>
          </div>

          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.category') }}</label>
            <select
              v-model="editCategory"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              @change="saveCategory(transaction!)"
            >
              <option v-for="cat in CATEGORIES" :key="cat" :value="cat">
                {{ categoryDisplayName(cat, locale, overrides) }}
              </option>
            </select>
          </div>

          <!-- Override Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.overrideDescription') }}</label>
            <div class="flex gap-2">
              <input
                v-model="editOverrideDesc"
                class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
              <button
                class="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                @click="saveOverride(transaction!)"
              >{{ t('common.save') }}</button>
            </div>
          </div>

          <!-- Lock/Unlock + Delete row -->
          <div class="flex items-center gap-3">
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              @click="toggleLock(transaction!)"
            >{{ transaction.userLocked ? '🔓 ' + t('spendings.unlock') : '🔒 ' + t('spendings.lock') }}</button>
            <button
              class="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              @click="onDelete(transaction!)"
            >{{ t('spendings.deleteTransaction') }}</button>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            class="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            @click="onSplit"
          >{{ t('spendings.splitTransaction') }}</button>
          <button
            class="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors"
            @click="onCreateRule"
          >{{ t('spendings.createRule') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
