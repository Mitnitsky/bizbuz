<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { onRules, addRule, updateRule, deleteRule } from '@/services/firestore'
import { CATEGORIES, categoryDisplayName } from '@/composables/useCategories'
import { useIcons } from '@/composables/useIcons'
import { useConfirm } from '@/composables/useConfirm'
import type { Rule } from '@/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const prefsStore = usePreferencesStore()
const { icon } = useIcons()

const familyId = computed(() => authStore.familyId)
const locale = computed(() => prefsStore.locale)

const rules = ref<Rule[]>([])
const editingRule = ref<Rule | null>(null)
const editingRuleIsNew = ref(false)
const saving = ref(false)
let unsubRules: (() => void) | null = null

onMounted(() => {
  if (familyId.value) {
    unsubRules = onRules(familyId.value, (r) => { rules.value = r })
  }
})
onUnmounted(() => { unsubRules?.() })

// Auto-open rule editor from query param (e.g. ?edit=ruleId)
watch(rules, (newRules) => {
  const editId = route.query.edit as string | undefined
  if (editId && newRules.length > 0 && !editingRule.value) {
    const rule = newRules.find(r => r.id === editId)
    if (rule) {
      editingRule.value = JSON.parse(JSON.stringify(rule))
      editingRuleIsNew.value = false
      router.replace({ query: {} })
    }
  }
})

// Group rules by category, sorted alphabetically
const rulesByCategory = computed(() => {
  const map = new Map<string, Rule[]>()
  for (const rule of rules.value) {
    const cat = rule.actionCategory
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(rule)
  }
  return [...map.entries()].sort((a, b) =>
    categoryDisplayName(a[0], locale.value).localeCompare(categoryDisplayName(b[0], locale.value))
  )
})

function startNewRule() {
  editingRule.value = { conditions: [{ field: 'description', operator: 'contains', value: '' }], actionCategory: '' }
  editingRuleIsNew.value = true
}

function startEditRule(rule: Rule) {
  editingRule.value = JSON.parse(JSON.stringify(rule))
  editingRuleIsNew.value = false
}

function addCondition() {
  editingRule.value?.conditions.push({ field: 'description', operator: 'contains', value: '' })
}

function removeCondition(i: number) {
  editingRule.value?.conditions.splice(i, 1)
}

async function saveRule() {
  if (!editingRule.value || !familyId.value) return
  saving.value = true
  try {
    if (editingRuleIsNew.value) {
      await addRule(familyId.value, editingRule.value)
    } else {
      await updateRule(familyId.value, editingRule.value.id!, editingRule.value)
    }
    editingRule.value = null
  } finally { saving.value = false }
}

const { confirm } = useConfirm()

async function removeRule(id: string) {
  if (!familyId.value) return
  if (!(await confirm(t('common.confirmDelete')))) return
  saving.value = true
  try { await deleteRule(familyId.value, id) } finally { saving.value = false }
}
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          @click="router.push('/settings')"
        >←</button>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('settings.categorizationRules') }}</h1>
        <span class="text-sm text-gray-500 dark:text-gray-400">({{ rules.length }})</span>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
        @click="startNewRule"
      >+ {{ t('settings.addRule') }}</button>
    </div>

    <!-- Edit / New form -->
    <div v-if="editingRule" class="border border-purple-300 dark:border-purple-700 rounded-xl p-5 mb-6 bg-purple-50/50 dark:bg-purple-900/20">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        {{ editingRuleIsNew ? t('settings.newRule') : t('settings.editRule') }}
      </h3>

      <!-- Conditions -->
      <div class="space-y-2 mb-4">
        <div v-for="(cond, i) in editingRule.conditions" :key="i" class="flex flex-wrap items-center gap-2">
          <select v-model="cond.field" class="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm">
            <option value="description">{{ t('settings.ruleFieldDescription') }}</option>
            <option value="source">{{ t('settings.ruleFieldSource') }}</option>
            <option value="companyId">{{ t('settings.ruleFieldCompany') }}</option>
            <option value="chargedAmount">{{ t('settings.ruleFieldAmount') || 'Amount' }}</option>
          </select>
          <select v-model="cond.operator" class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm">
            <option value="contains">{{ t('settings.ruleOpContains') }}</option>
            <option value="equals">{{ t('settings.ruleOpEquals') }}</option>
            <option value="starts_with">{{ t('settings.ruleOpStartsWith') }}</option>
            <option value="not_in">{{ t('settings.ruleOpNotIn') }}</option>
            <option value="greater_than">></option>
            <option value="less_than">&lt;</option>
          </select>
          <input
            v-model="cond.value"
            type="text"
            class="flex-1 min-w-[120px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
            :placeholder="t('settings.ruleValuePlaceholder')"
          />
          <button
            v-if="editingRule.conditions.length > 1"
            class="text-red-500 hover:text-red-700 text-sm px-2 py-1"
            @click="removeCondition(i)"
          >✕</button>
        </div>
      </div>
      <button class="text-sm text-purple-600 dark:text-purple-400 hover:underline mb-4 block" @click="addCondition">+ {{ t('settings.addCondition') }}</button>

      <!-- Action -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.ruleCategory') }}</label>
          <select v-model="editingRule.actionCategory" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm">
            <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ categoryDisplayName(cat, locale) }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.ruleOverrideDesc') }}</label>
          <input
            v-model="editingRule.actionOverrideDescription"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
            :placeholder="t('settings.optionalOverride')"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" @click="editingRule = null">{{ t('common.cancel') }}</button>
        <button
          class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50"
          :disabled="saving || !editingRule.actionCategory || editingRule.conditions.some(c => !c.value)"
          @click="saveRule"
        >{{ t('common.save') }}</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="rules.length === 0 && !editingRule" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <component :is="icon('rules')" class="w-8 h-8 text-gray-400 mb-2 mx-auto" />
      <p class="text-sm">{{ t('settings.noRules') }}</p>
    </div>

    <!-- Rules grouped by category -->
    <div v-else class="space-y-6">
      <div v-for="[cat, catRules] in rulesByCategory" :key="cat">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
          {{ categoryDisplayName(cat, locale) }}
          <span class="text-xs font-normal normal-case text-gray-400 dark:text-gray-500">({{ catRules.length }})</span>
        </h2>
        <div class="space-y-2">
          <div
            v-for="rule in catRules"
            :key="rule.id"
            class="flex items-start justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="rule.isDefault" class="px-2 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium">{{ t('settings.defaultRule') }}</span>
                <span v-if="rule.actionOverrideDescription" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.overrideTo') }}: <span class="font-medium text-gray-700 dark:text-gray-300">{{ rule.actionOverrideDescription }}</span>
                </span>
              </div>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="(cond, i) in rule.conditions"
                  :key="i"
                  class="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono"
                >
                  {{ cond.field }} <span class="text-purple-600 dark:text-purple-400 mx-1">{{ cond.operator }}</span> "{{ cond.value }}"
                </span>
              </div>
            </div>
            <div class="flex gap-1 shrink-0">
              <button
                class="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                :title="t('settings.editRule')"
                @click="startEditRule(rule)"
              >✏️</button>
              <button
                class="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                :title="t('common.delete')"
                @click="removeRule(rule.id!)"
              >🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
