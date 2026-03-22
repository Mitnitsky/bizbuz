<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import type { Transaction, Rule } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import {
  categorizeTransaction,
  updateOwnerTag,
  updateTransactionOverride,
  setTransactionLock,
  deleteTransaction,
  onRules,
} from '@/services/firestore'
import { getEffectiveCategories, categoryDisplayName } from '@/composables/useCategories'
import { formatCurrency, formatDate } from '@/composables/useFormatters'
import { useIcons } from '@/composables/useIcons'
import { useConfirm } from '@/composables/useConfirm'
import { useRouter } from 'vue-router'
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
const router = useRouter()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const { icon } = useIcons()

const editCategory = ref('')
const editOwner = ref('')
const editOverrideDesc = ref('')

const rules = ref<Rule[]>([])
let unsubRules: (() => void) | null = null

watch(() => familyStore.family?.id, (fid) => {
  unsubRules?.()
  if (fid) {
    unsubRules = onRules(fid, (r) => { rules.value = r })
  }
}, { immediate: true })

onUnmounted(() => { unsubRules?.() })

const matchedRule = computed(() => {
  const ruleId = props.transaction?.appliedRuleId
  if (!ruleId) return null
  return rules.value.find(r => r.id === ruleId) ?? null
})

function formatRuleConditions(rule: Rule): string {
  return rule.conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' & ')
}

watch(show, (val) => {
  if (val && props.transaction) {
    editCategory.value = props.transaction.category
    editOwner.value = props.transaction.ownerTag
    editOverrideDesc.value = props.transaction.overrideDescription
  }
})

const locale = computed(() => prefsStore.locale)
const overrides = computed(() => familyStore.familySettings.categoryNameOverrides)
const effectiveCategories = computed(() => getEffectiveCategories(familyStore.familySettings.categories, locale.value))

const accountAlias = computed(() => {
  const labels = familyStore.familySettings.paymentMethodLabels
  const txn = props.transaction
  if (!txn) return ''
  if (txn.companyId && labels[txn.companyId]) return labels[txn.companyId]
  if (txn.account && labels[txn.account]) return labels[txn.account]
  return ''
})

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

const { confirm } = useConfirm()

async function onDelete(txn: Transaction) {
  const familyId = familyStore.family?.id
  if (!familyId) return
  if (!(await confirm(t('common.confirmDelete')))) return
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

const isPending = computed(() => props.transaction?.status === 'pending_categorization')

async function onCategorize() {
  const txn = props.transaction
  const familyId = familyStore.family?.id
  if (!txn || !familyId) return
  if (editCategory.value !== txn.category) {
    await categorizeTransaction(familyId, txn.id, editCategory.value)
  }
  show.value = false
  emit('close')
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
          <div class="text-gray-900 dark:text-gray-100">{{ formatDate(transaction.date, locale) }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.processedDate') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ formatDate(transaction.processedDate, locale) }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.category') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ categoryDisplayName(transaction.category, locale, effectiveCategories, overrides) }}</div>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.owner') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ familyStore.resolveOwnerName(transaction.ownerTag) }}</div>

          <template v-if="prefsStore.userPreferences?.showPaymentSource">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.source') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.source || '—' }}</div>
          </template>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.originalAmount') }}</div>
          <div class="text-gray-900 dark:text-gray-100">{{ formatCurrency(transaction.originalAmount) }}</div>

          <template v-if="transaction.installments">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.installments') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.installments.number }} / {{ transaction.installments.total }}</div>
          </template>

          <template v-if="transaction.account">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.account') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.account }}<span v-if="accountAlias" class="text-purple-600 dark:text-purple-400 ml-1">({{ accountAlias }})</span></div>
          </template>

          <template v-if="transaction.memo">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.memo') }}</div>
            <div class="text-gray-900 dark:text-gray-100">{{ transaction.memo }}</div>
          </template>

          <template v-if="transaction.categoryHint">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.categoryHint') }}</div>
            <div class="text-gray-900 dark:text-gray-100">
              <span class="px-2 py-0.5 rounded-full text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300">{{ transaction.categoryHint }}</span>
            </div>
          </template>

          <template v-if="matchedRule">
            <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.appliedRule') }}</div>
            <div class="text-gray-900 dark:text-gray-100">
              <button
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-mono hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                @click="show = false; router.push({ path: '/settings/rules', query: { edit: transaction.appliedRuleId } })"
              >
                {{ formatRuleConditions(matchedRule) }}
              </button>
            </div>
          </template>

          <div class="text-gray-500 dark:text-gray-400">{{ t('spendings.locked') }}</div>
          <div class="text-gray-900 dark:text-gray-100"><component :is="transaction.userLocked ? icon('lock') : icon('unlock')" class="w-4 h-4 inline" /></div>
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
              <option v-for="catDef in effectiveCategories" :key="catDef.id" :value="catDef.id">
                {{ categoryDisplayName(catDef.id, locale, effectiveCategories, overrides) }}
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

          <div class="flex items-center gap-3">
            <button
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
              @click="toggleLock(transaction!)"
            >
              <component :is="transaction.userLocked ? icon('unlock') : icon('lock')" class="w-4 h-4" />
              {{ transaction.userLocked ? t('spendings.unlock') : t('spendings.lock') }}
            </button>
            <button
              class="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              @click="onDelete(transaction!)"
            >
              <component :is="icon('trash')" class="w-4 h-4" />
              {{ t('spendings.deleteTransaction') }}
            </button>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            v-if="isPending"
            class="flex-1 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            @click="onCategorize"
          >{{ t('spendings.categorize') }}</button>
          <button
            class="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
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
