<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import type { Transaction, Rule } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { addRule, onRules } from '@/services/firestore'
import { getEffectiveCategories, categoryDisplayName } from '@/composables/useCategories'
import { formatCurrency } from '@/composables/useFormatters'
import { useI18n } from 'vue-i18n'
import { useConfirm } from '@/composables/useConfirm'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  transaction: Transaction | null
}>()

const emit = defineEmits<{
  close: []
}>()

const show = defineModel<boolean>({ default: false })

const { t } = useI18n()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const authStore = useAuthStore()
const { confirm } = useConfirm()

const conditions = ref<Array<{ field: string; operator: string; value: string }>>([])
const actionCategory = ref('')
const actionDescription = ref('')
const saving = ref(false)
const existingRules = ref<Rule[]>([])
let unsubRules: (() => void) | null = null

onMounted(() => {
  if (authStore.familyId) {
    unsubRules = onRules(authStore.familyId, (r) => { existingRules.value = r })
  }
})
onUnmounted(() => { unsubRules?.() })

const locale = computed(() => prefsStore.locale)
const overrides = computed(() => familyStore.familySettings.categoryNameOverrides)
const effectiveCategories = computed(() => getEffectiveCategories(familyStore.familySettings.categories, locale.value))

const fieldOptions = ['description', 'source', 'companyId', 'chargedAmount'] as const
const operatorOptions = ['equals', 'contains', 'starts_with', 'not_in', 'greater_than', 'less_than', 'between'] as const

const fieldLabels: Record<string, string> = {
  description: 'settings.ruleFieldDescription',
  source: 'settings.ruleFieldSource',
  companyId: 'settings.ruleFieldCompany',
  chargedAmount: 'settings.ruleFieldAmount',
}

const operatorLabels: Record<string, string> = {
  contains: 'settings.ruleOpContains',
  equals: 'settings.ruleOpEquals',
  starts_with: 'settings.ruleOpStartsWith',
  not_in: 'settings.ruleOpNotIn',
  greater_than: '>',
  less_than: '<',
  between: 'settings.ruleOpBetween',
}

function opLabel(op: string): string {
  const key = operatorLabels[op]
  if (!key) return op
  if (key === '>' || key === '<') return key
  return t(key)
}

function onOperatorChange(cond: { field: string; operator: string; value: string }) {
  if (cond.field !== 'chargedAmount' || !props.transaction) return
  const amt = Math.abs(props.transaction.chargedAmount)
  switch (cond.operator) {
    case 'equals':
      cond.value = String(amt)
      break
    case 'greater_than':
      cond.value = String(amt)
      break
    case 'less_than':
      cond.value = String(amt)
      break
    case 'between':
      cond.value = `${Math.max(0, amt - 1)},${amt + 1}`
      break
  }
}

function onFieldChange(cond: { field: string; operator: string; value: string }) {
  if (cond.field === 'chargedAmount' && props.transaction) {
    if (!['equals', 'greater_than', 'less_than', 'between'].includes(cond.operator)) {
      cond.operator = 'equals'
    }
    onOperatorChange(cond)
  } else {
    cond.value = ''
  }
}

watch(show, (val) => {
  if (val && props.transaction) {
    conditions.value = [
      { field: 'description', operator: 'contains', value: props.transaction.description },
    ]
    actionCategory.value = props.transaction.category || ''
    actionDescription.value = props.transaction.overrideDescription || ''
    saving.value = false
  }
})

function addCondition() {
  conditions.value.push({ field: 'description', operator: 'equals', value: '' })
}

function removeCondition(index: number) {
  conditions.value.splice(index, 1)
}

async function onSave() {
  const familyId = familyStore.family?.id
  if (!familyId || conditions.value.length === 0) return

  // Check for duplicate
  const dup = existingRules.value.find(rule =>
    rule.conditions.length === conditions.value.length &&
    rule.conditions.every((c, i) => c.field === conditions.value[i].field && c.operator === conditions.value[i].operator && c.value === conditions.value[i].value)
  )
  if (dup) {
    const dupCat = categoryDisplayName(dup.actionCategory, locale.value, effectiveCategories.value, overrides.value)
    const ok = await confirm(t('rules.duplicateWarning', { category: dupCat }))
    if (!ok) return
  }

  saving.value = true
  await addRule(familyId, {
    conditions: conditions.value,
    actionCategory: actionCategory.value,
    actionOverrideDescription: actionDescription.value,
  })

  saving.value = false
  show.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="show = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('spendings.createRule') }}</h2>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl p-1" @click="show = false">✕</button>
        </div>

        <!-- Transaction context -->
        <div v-if="transaction" class="mb-5 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{{ transaction.overrideDescription || transaction.description }}</span>
            <span class="text-sm font-semibold shrink-0" :class="transaction.chargedAmount < 0 ? 'text-red-500' : 'text-green-600'">{{ formatCurrency(transaction.chargedAmount) }}</span>
          </div>
          <div v-if="transaction.account" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ transaction.account }}</div>
        </div>

        <!-- Conditions -->
        <div class="mb-6">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('settings.addCondition').replace(/^\+ ?/, '') }}</div>
          <div
            v-for="(cond, idx) in conditions"
            :key="idx"
            class="flex gap-2 mb-2 items-start flex-wrap"
          >
            <select
              v-model="cond.field"
              class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 w-28"
              @change="onFieldChange(cond)"
            >
              <option v-for="f in fieldOptions" :key="f" :value="f">{{ t(fieldLabels[f]) }}</option>
            </select>
            <select
              v-model="cond.operator"
              class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 w-24"
              @change="onOperatorChange(cond)"
            >
              <option v-for="op in operatorOptions" :key="op" :value="op">{{ opLabel(op) }}</option>
            </select>
            <template v-if="cond.operator === 'between'">
              <div class="relative w-24">
                <input
                  :value="cond.value.split(',')[0] || ''"
                  @input="cond.value = ($event.target as HTMLInputElement).value + ',' + (cond.value.split(',')[1] || '')"
                  type="number"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 pt-4 pb-1 text-sm text-gray-900 dark:text-gray-100 no-spinners peer"
                  placeholder=" "
                />
                <span class="absolute start-3 top-0.5 text-[10px] text-gray-400 dark:text-gray-500 pointer-events-none">{{ t('settings.ruleRangeMin') }}</span>
              </div>
              <span class="text-gray-400 text-sm self-center">–</span>
              <div class="relative w-24">
                <input
                  :value="cond.value.split(',')[1] || ''"
                  @input="cond.value = (cond.value.split(',')[0] || '') + ',' + ($event.target as HTMLInputElement).value"
                  type="number"
                  class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 pt-4 pb-1 text-sm text-gray-900 dark:text-gray-100 no-spinners peer"
                  placeholder=" "
                />
                <span class="absolute start-3 top-0.5 text-[10px] text-gray-400 dark:text-gray-500 pointer-events-none">{{ t('settings.ruleRangeMax') }}</span>
              </div>
            </template>
            <input
              v-else
              v-model="cond.value"
              class="flex-1 min-w-[100px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              :placeholder="t('settings.ruleValuePlaceholder')"
            />
            <button
              v-if="conditions.length > 1"
              class="p-2 text-red-500 hover:text-red-700 text-sm"
              @click="removeCondition(idx)"
            >✕</button>
          </div>
          <button
            class="text-sm text-purple-600 dark:text-purple-400 hover:underline mt-1"
            @click="addCondition"
          >+ {{ t('settings.addCondition') }}</button>
        </div>

        <!-- Actions -->
        <div class="mb-6 space-y-3">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('spendings.actionCategory') }}</div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.ruleCategory') }}</label>
            <select
              v-model="actionCategory"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              <option v-for="catDef in effectiveCategories" :key="catDef.id" :value="catDef.id">
                {{ categoryDisplayName(catDef.id, locale, effectiveCategories, overrides) }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.ruleOverrideDesc') }}</label>
            <input
              v-model="actionDescription"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              :placeholder="t('settings.optionalOverride')"
            />
          </div>
        </div>

        <!-- Save -->
        <button
          class="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="conditions.length === 0 || !actionCategory || saving"
          @click="onSave"
        >{{ saving ? '...' : t('common.save') }}</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.no-spinners::-webkit-outer-spin-button,
.no-spinners::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spinners {
  -moz-appearance: textfield;
}
</style>
