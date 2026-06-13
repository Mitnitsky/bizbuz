<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { onRules, addRule, updateRule, deleteRule } from '@/services/firestore'
import { getEffectiveCategories, categoryDisplayName } from '@/composables/useCategories'
import { useFamilyStore } from '@/stores/family'
import { useIcons } from '@/composables/useIcons'
import { useConfirm } from '@/composables/useConfirm'
import type { Rule } from '@/types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const prefsStore = usePreferencesStore()
const { icon } = useIcons()
const familyStore = useFamilyStore()

const dataLoading = computed(() => !familyStore.familyLoaded)

const familyId = computed(() => authStore.familyId)
const effectiveCategories = computed(() => getEffectiveCategories(familyStore.familySettings.categories, locale.value))
const locale = computed(() => prefsStore.locale)

const rules = ref<Rule[]>([])
const editingRule = ref<Rule | null>(null)
const editingRuleIsNew = ref(false)
const saving = ref(false)
const collapsedCategories = ref<Set<string>>(new Set())
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
const fieldSortOrder: Record<string, number> = { description: 0, source: 1, companyId: 2, chargedAmount: 3 }

function ruleSortKey(rule: Rule): string {
  const first = rule.conditions[0]
  const fieldOrder = fieldSortOrder[first?.field] ?? 9
  const value = String(first?.value || '').toLowerCase()
  return `${fieldOrder}-${value}`
}

const rulesByCategory = computed(() => {
  const map = new Map<string, Rule[]>()
  for (const rule of rules.value) {
    const cat = rule.actionCategory
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(rule)
  }
  return [...map.entries()]
    .map(([cat, catRules]) => [cat, [...catRules].sort((a, b) => ruleSortKey(a).localeCompare(ruleSortKey(b)))] as [string, Rule[]])
    .sort((a, b) =>
      categoryDisplayName(a[0], locale.value, effectiveCategories.value).localeCompare(categoryDisplayName(b[0], locale.value, effectiveCategories.value))
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

function conditionKey(c: { field: string; operator: string; value: string }): string {
  return `${c.field}|${c.operator}|${c.value}`
}

// Convert an amount condition to a numeric range [min, max]
function amountRange(cond: { operator: string; value: string }): [number, number] {
  const v = parseFloat(cond.value)
  if (cond.operator === 'equals') return [v, v]
  if (cond.operator === 'greater_than') return [v, Infinity]
  if (cond.operator === 'less_than') return [-Infinity, v]
  if (cond.operator === 'between') {
    const [a, b] = cond.value.split(',').map(Number)
    return [Math.min(a, b), Math.max(a, b)]
  }
  return [-Infinity, Infinity]
}

// Check if range A fully covers range B
function rangeCoverage(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[0] && a[1] >= b[1]
}

function rulesOverlap(a: Rule, b: Rule): boolean {
  // Split into non-amount and amount conditions
  const aNonAmt = a.conditions.filter(c => c.field !== 'chargedAmount')
  const bNonAmt = b.conditions.filter(c => c.field !== 'chargedAmount')
  const aAmt = a.conditions.filter(c => c.field === 'chargedAmount')
  const bAmt = b.conditions.filter(c => c.field === 'chargedAmount')

  // Non-amount conditions must be exactly equal (order-independent)
  if (aNonAmt.length !== bNonAmt.length) return false
  const aNonSet = new Set(aNonAmt.map(conditionKey))
  if (!bNonAmt.every(c => aNonSet.has(conditionKey(c)))) return false

  // Amount conditions: mutual coverage check
  // Both have none → equal
  if (aAmt.length === 0 && bAmt.length === 0) return true
  // One has amount, other doesn't → not mutual (different specificity)
  if (aAmt.length === 0 || bAmt.length === 0) return false
  // Both have amount → check mutual coverage
  const aRange = amountRange(aAmt[0])
  const bRange = amountRange(bAmt[0])
  return rangeCoverage(aRange, bRange) && rangeCoverage(bRange, aRange)
}

// Pre-compute a fingerprint per rule for fast grouping
function ruleFingerprint(rule: Rule): string {
  const nonAmt = rule.conditions
    .filter(c => c.field !== 'chargedAmount')
    .map(conditionKey)
    .sort()
    .join('||')
  const amt = rule.conditions
    .filter(c => c.field === 'chargedAmount')
    .map(c => `${c.operator}:${c.value}`)
    .join('||')
  return `${nonAmt}###${amt}`
}

const duplicateRuleIds = computed(() => {
  const ids = new Set<string>()
  const fpMap = new Map<string, Rule[]>()
  for (const rule of rules.value) {
    const fp = ruleFingerprint(rule)
    if (!fpMap.has(fp)) fpMap.set(fp, [])
    fpMap.get(fp)!.push(rule)
  }
  for (const group of fpMap.values()) {
    if (group.length > 1) {
      for (const r of group) { if (r.id) ids.add(r.id!) }
    }
  }
  return ids
})

// Groups of duplicate rules — only used when modal opens
function computeDuplicateGroups(): Rule[][] {
  const fpMap = new Map<string, Rule[]>()
  for (const rule of rules.value) {
    const fp = ruleFingerprint(rule)
    if (!fpMap.has(fp)) fpMap.set(fp, [])
    fpMap.get(fp)!.push(rule)
  }
  return [...fpMap.values()].filter(g => g.length > 1)
}

const showDuplicateModal = ref(false)
const selectedForDeletion = ref<Set<string>>(new Set())
const modalGroups = ref<Rule[][]>([])

function ruleRichness(rule: Rule): number {
  let score = rule.conditions.length
  if (rule.actionOverrideDescription) score += 2
  if (rule.isDefault) score += 1
  return score
}

function openDuplicateModal() {
  modalGroups.value = computeDuplicateGroups()
  const sel = new Set<string>()
  for (const group of modalGroups.value) {
    const sorted = [...group].sort((a, b) => ruleRichness(b) - ruleRichness(a))
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].id) sel.add(sorted[i].id!)
    }
  }
  selectedForDeletion.value = sel
  showDuplicateModal.value = true
}

function toggleDeletionSelection(id: string) {
  const s = new Set(selectedForDeletion.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedForDeletion.value = s
}

async function deleteSelectedDuplicates() {
  if (!familyId.value || selectedForDeletion.value.size === 0) return
  saving.value = true
  try {
    for (const id of selectedForDeletion.value) {
      await deleteRule(familyId.value, id)
    }
  } finally {
    saving.value = false
    showDuplicateModal.value = false
    selectedForDeletion.value = new Set()
  }
}

function findDuplicateRule(): Rule | null {
  if (!editingRule.value) return null
  for (const rule of rules.value) {
    if (rule.id === editingRule.value.id) continue
    if (rulesOverlap(rule, editingRule.value)) return rule
  }
  return null
}

async function saveRule() {
  if (!editingRule.value || !familyId.value) return
  const dup = findDuplicateRule()
  if (dup) {
    const dupCat = categoryDisplayName(dup.actionCategory, locale.value, effectiveCategories.value)
    const ok = await confirm(t('rules.duplicateWarning', { category: dupCat }))
    if (!ok) return
  }
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

async function removeRuleFromEdit(id: string) {
  if (!familyId.value) return
  if (!(await confirm(t('common.confirmDelete')))) return
  editingRule.value = null
  saving.value = true
  try { await deleteRule(familyId.value, id) } finally { saving.value = false }
}

function toggleCategory(cat: string) {
  const s = new Set(collapsedCategories.value)
  s.has(cat) ? s.delete(cat) : s.add(cat)
  collapsedCategories.value = s
}

const allCollapsed = computed(() =>
  rulesByCategory.value.length > 0 && collapsedCategories.value.size === rulesByCategory.value.length
)

function toggleAll() {
  if (allCollapsed.value) {
    collapsedCategories.value = new Set()
  } else {
    collapsedCategories.value = new Set(rulesByCategory.value.map(([cat]) => cat))
  }
}

const fieldLabelMap: Record<string, string> = {
  description: 'settings.ruleFieldDescription',
  source: 'settings.ruleFieldSource',
  companyId: 'settings.ruleFieldCompany',
  chargedAmount: 'settings.ruleFieldAmount',
}

const fieldColorMap: Record<string, string> = {
  description: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  source: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  companyId: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  chargedAmount: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
}

function opDisplayLabel(op: string): string {
  if (op === 'greater_than') return '>'
  if (op === 'less_than') return '<'
  const keyMap: Record<string, string> = {
    contains: 'settings.ruleOpContains',
    equals: 'settings.ruleOpEquals',
    starts_with: 'settings.ruleOpStartsWith',
    not_in: 'settings.ruleOpNotIn',
    between: 'settings.ruleOpBetween',
  }
  return keyMap[op] ? t(keyMap[op]) : op
}

function condValue(cond: { operator: string; value: string }): string {
  if (cond.operator === 'between') {
    const [a, b] = cond.value.split(',')
    return `${a} – ${b}`
  }
  return cond.value
}
</script>

<template>
  <div class="max-w-3xl mx-auto w-full p-4">
    <!-- Skeleton loading state -->
    <template v-if="dataLoading">
      <div class="animate-pulse">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="h-9 w-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div class="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div class="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div v-for="i in 3" :key="i" class="mb-6">
          <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div class="space-y-2">
            <div v-for="j in 2" :key="j" class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <div class="flex gap-1.5 mb-2">
                    <div class="h-6 w-44 bg-gray-200 dark:bg-gray-700 rounded-md" />
                  </div>
                  <div class="flex gap-1.5">
                    <div class="h-6 w-56 bg-gray-200 dark:bg-gray-700 rounded-md" />
                  </div>
                </div>
                <div class="flex gap-1">
                  <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 rtl:rotate-180"
          @click="router.push('/settings')"
        >←</button>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-300">{{ t('settings.categorizationRules') }}</h1>
        <span class="text-sm text-gray-500 dark:text-gray-400">({{ rules.length }})</span>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
        @click="startNewRule"
      >+ {{ t('settings.addRule') }}</button>
    </div>

    <!-- Duplicate warning banner -->
    <div v-if="duplicateRuleIds.size > 0" class="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 flex items-center gap-2 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" @click="openDuplicateModal">
      <span class="text-amber-600 dark:text-amber-400 text-lg">⚠</span>
      <span class="text-sm text-amber-800 dark:text-amber-300 flex-1">{{ t('rules.duplicatesFound', { count: duplicateRuleIds.size }) }}</span>
      <span class="text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline">{{ t('rules.manageDuplicates') }}</span>
    </div>

    <!-- Collapse/Expand All -->
    <div v-if="rulesByCategory.length > 1" class="flex justify-end mb-3">
      <button
        class="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        @click="toggleAll"
      >{{ allCollapsed ? t('rules.expandAll') : t('rules.collapseAll') }}</button>
    </div>

    <!-- Edit / New form (only shown at top for NEW rules) -->
    <div v-if="editingRule && editingRuleIsNew" ref="editFormRef" class="border border-purple-300 dark:border-purple-700 rounded-xl p-5 mb-6 bg-purple-50/50 dark:bg-purple-900/20">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        {{ t('settings.newRule') }}
      </h3>

      <!-- Conditions -->
      <div class="space-y-2 mb-4">
        <div v-for="(cond, i) in editingRule.conditions" :key="i" class="flex flex-wrap items-center gap-2">
          <select v-model="cond.field" class="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm">
            <option value="description">{{ t('settings.ruleFieldDescription') }}</option>
            <option value="source">{{ t('settings.ruleFieldSource') }}</option>
            <option value="companyId">{{ t('settings.ruleFieldCompany') }}</option>
            <option value="chargedAmount">{{ t('settings.ruleFieldAmount') }}</option>
          </select>
          <select v-model="cond.operator" class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm">
            <option value="contains">{{ t('settings.ruleOpContains') }}</option>
            <option value="equals">{{ t('settings.ruleOpEquals') }}</option>
            <option value="starts_with">{{ t('settings.ruleOpStartsWith') }}</option>
            <option value="not_in">{{ t('settings.ruleOpNotIn') }}</option>
            <option value="greater_than">></option>
            <option value="less_than">&lt;</option>
            <option value="between">{{ t('settings.ruleOpBetween') }}</option>
          </select>
          <template v-if="cond.operator === 'between'">
            <div class="relative w-24">
              <input :value="cond.value.split(',')[0] || ''" @input="cond.value = ($event.target as HTMLInputElement).value + ',' + (cond.value.split(',')[1] || '')" type="number" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 pt-4 pb-1 text-sm no-spinners" placeholder=" " />
              <span class="absolute start-3 top-0.5 text-[10px] text-gray-400 dark:text-gray-500 pointer-events-none">{{ t('settings.ruleRangeMin') }}</span>
            </div>
            <span class="text-gray-400 text-sm">–</span>
            <div class="relative w-24">
              <input :value="cond.value.split(',')[1] || ''" @input="cond.value = (cond.value.split(',')[0] || '') + ',' + ($event.target as HTMLInputElement).value" type="number" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 pt-4 pb-1 text-sm no-spinners" placeholder=" " />
              <span class="absolute start-3 top-0.5 text-[10px] text-gray-400 dark:text-gray-500 pointer-events-none">{{ t('settings.ruleRangeMax') }}</span>
            </div>
          </template>
          <input v-else v-model="cond.value" type="text" class="flex-1 min-w-[120px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm" :placeholder="t('settings.ruleValuePlaceholder')" />
          <button v-if="editingRule.conditions.length > 1" class="text-red-500 hover:text-red-700 text-sm px-2 py-1" @click="removeCondition(i)">✕</button>
        </div>
      </div>
      <button class="text-sm text-purple-600 dark:text-purple-400 hover:underline mb-4 block" @click="addCondition">+ {{ t('settings.addCondition') }}</button>

      <!-- Action -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.ruleCategory') }}</label>
          <select v-model="editingRule.actionCategory" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm">
            <option v-for="catDef in effectiveCategories" :key="catDef.id" :value="catDef.id">{{ categoryDisplayName(catDef.id, locale, effectiveCategories) }}</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('settings.ruleOverrideDesc') }}</label>
          <input v-model="editingRule.actionOverrideDescription" type="text" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm" :placeholder="t('settings.optionalOverride')" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" @click="editingRule = null">{{ t('common.cancel') }}</button>
        <button class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50" :disabled="saving || !editingRule.actionCategory || editingRule.conditions.some(c => !c.value)" @click="saveRule">{{ t('common.save') }}</button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="rules.length === 0 && !editingRule" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <component :is="icon('rules')" class="w-8 h-8 text-gray-400 mb-2 mx-auto" />
      <p class="text-sm">{{ t('settings.noRules') }}</p>
    </div>

    <!-- Rules grouped by category -->
    <div v-else class="space-y-4">
      <div v-for="[cat, catRules] in rulesByCategory" :key="cat" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <!-- Category header -->
        <button
          class="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors cursor-pointer"
          @click="toggleCategory(cat)"
        >
          <span class="text-xs text-gray-400 transition-transform duration-200 rtl:-scale-x-100" :class="{ 'rotate-90 rtl:-rotate-90': !collapsedCategories.has(cat) }">▶</span>
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1 text-start">{{ categoryDisplayName(cat, locale, effectiveCategories) }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">({{ catRules.length }})</span>
        </button>

        <div v-show="!collapsedCategories.has(cat)" class="divide-y divide-gray-100 dark:divide-gray-700">
          <template v-for="rule in catRules" :key="rule.id">
            <!-- Expanded inline edit -->
            <div v-if="editingRule && !editingRuleIsNew && editingRule.id === rule.id" class="bg-purple-50/50 dark:bg-purple-900/20">
              <!-- Clickable header to collapse -->
              <div class="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-800/30 transition-colors border-b border-purple-200/50 dark:border-purple-700/30" @click="editingRule = null">
                <span class="text-xs text-purple-500 shrink-0">▾</span>
                <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                  <span
                    v-for="(cond, i) in rule.conditions"
                    :key="i"
                    class="inline-flex items-center rounded-full text-[11px] overflow-hidden"
                  >
                    <span class="px-2 py-0.5 font-medium" :class="fieldColorMap[cond.field] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'">{{ t(fieldLabelMap[cond.field] || cond.field) }}</span>
                    <span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-purple-600 dark:text-purple-400 font-medium">{{ opDisplayLabel(cond.operator) }}</span>
                    <span class="px-2 py-0.5 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-200">{{ condValue(cond) }}</span>
                  </span>
                </div>
              </div>
              <div class="p-4">
              <div class="space-y-2 mb-3">
                <div v-for="(cond, i) in editingRule.conditions" :key="i" class="flex flex-wrap items-center gap-2">
                  <select v-model="cond.field" class="w-28 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1.5 text-xs">
                    <option value="description">{{ t('settings.ruleFieldDescription') }}</option>
                    <option value="source">{{ t('settings.ruleFieldSource') }}</option>
                    <option value="companyId">{{ t('settings.ruleFieldCompany') }}</option>
                    <option value="chargedAmount">{{ t('settings.ruleFieldAmount') }}</option>
                  </select>
                  <select v-model="cond.operator" class="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1.5 text-xs">
                    <option value="contains">{{ t('settings.ruleOpContains') }}</option>
                    <option value="equals">{{ t('settings.ruleOpEquals') }}</option>
                    <option value="starts_with">{{ t('settings.ruleOpStartsWith') }}</option>
                    <option value="not_in">{{ t('settings.ruleOpNotIn') }}</option>
                    <option value="greater_than">></option>
                    <option value="less_than">&lt;</option>
                    <option value="between">{{ t('settings.ruleOpBetween') }}</option>
                  </select>
                  <template v-if="cond.operator === 'between'">
                    <div class="relative w-20">
                      <input :value="cond.value.split(',')[0] || ''" @input="cond.value = ($event.target as HTMLInputElement).value + ',' + (cond.value.split(',')[1] || '')" type="number" class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 pt-3.5 pb-1 text-xs no-spinners" placeholder=" " />
                      <span class="absolute start-2 top-0.5 text-[9px] text-gray-400 pointer-events-none">{{ t('settings.ruleRangeMin') }}</span>
                    </div>
                    <span class="text-gray-400 text-xs">–</span>
                    <div class="relative w-20">
                      <input :value="cond.value.split(',')[1] || ''" @input="cond.value = (cond.value.split(',')[0] || '') + ',' + ($event.target as HTMLInputElement).value" type="number" class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 pt-3.5 pb-1 text-xs no-spinners" placeholder=" " />
                      <span class="absolute start-2 top-0.5 text-[9px] text-gray-400 pointer-events-none">{{ t('settings.ruleRangeMax') }}</span>
                    </div>
                  </template>
                  <input v-else v-model="cond.value" type="text" class="flex-1 min-w-[100px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1.5 text-xs" :placeholder="t('settings.ruleValuePlaceholder')" />
                  <button v-if="editingRule.conditions.length > 1" class="text-red-500 hover:text-red-700 text-xs" @click="removeCondition(i)">✕</button>
                </div>
              </div>
              <button class="text-xs text-purple-600 dark:text-purple-400 hover:underline mb-3 block" @click="addCondition">+ {{ t('settings.addCondition') }}</button>
              <div class="flex flex-wrap gap-2 items-end mb-3">
                <div class="flex-1 min-w-[140px]">
                  <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">{{ t('settings.ruleCategory') }}</label>
                  <select v-model="editingRule.actionCategory" class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1.5 text-xs">
                    <option v-for="catDef in effectiveCategories" :key="catDef.id" :value="catDef.id">{{ categoryDisplayName(catDef.id, locale, effectiveCategories) }}</option>
                  </select>
                </div>
                <div class="flex-1 min-w-[140px]">
                  <label class="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">{{ t('settings.ruleOverrideDesc') }}</label>
                  <input v-model="editingRule.actionOverrideDescription" type="text" class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1.5 text-xs" :placeholder="t('settings.optionalOverride')" />
                </div>
              </div>
              <div class="flex gap-2 justify-between items-center">
                <button class="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" :title="t('common.delete')" @click.stop="removeRuleFromEdit(rule.id!)">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
                <div class="flex gap-2">
                  <button class="px-3 py-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs" @click="editingRule = null">{{ t('common.cancel') }}</button>
                  <button class="px-3 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-700 disabled:opacity-50" :disabled="saving || !editingRule.actionCategory || editingRule.conditions.some(c => !c.value)" @click="saveRule">{{ t('common.save') }}</button>
                </div>
              </div>
              </div>
            </div>
            <!-- Collapsed row — click to expand -->
            <div
              v-else
              class="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
              :class="{ 'bg-amber-50/50 dark:bg-amber-900/10 border-s-2 border-amber-400 dark:border-amber-600': duplicateRuleIds.has(rule.id!) }"
              @click="startEditRule(rule)"
            >
              <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                <span v-if="duplicateRuleIds.has(rule.id!)" class="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium shrink-0">{{ t('rules.duplicate') }}</span>
                <span v-if="rule.isDefault" class="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-medium shrink-0">{{ t('settings.defaultRule') }}</span>
                <span
                  v-for="(cond, i) in rule.conditions"
                  :key="i"
                  class="inline-flex items-center rounded-full text-[11px] overflow-hidden"
                >
                  <span class="px-2 py-0.5 font-medium" :class="fieldColorMap[cond.field] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'">{{ t(fieldLabelMap[cond.field] || cond.field) }}</span>
                  <span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-purple-600 dark:text-purple-400 font-medium">{{ opDisplayLabel(cond.operator) }}</span>
                  <span class="px-2 py-0.5 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-200">{{ condValue(cond) }}</span>
                </span>
                <span v-if="rule.actionOverrideDescription" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 1 1 3.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  {{ t('settings.overrideTo') }}: {{ rule.actionOverrideDescription }}
                </span>
              </div>
              <button
                class="p-1.5 rounded text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
                :title="t('common.delete')"
                @click.stop="removeRule(rule.id!)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
    </template>

    <!-- Duplicate Management Modal -->
    <Teleport to="body">
    <Transition name="dup-fade">
      <div v-if="showDuplicateModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="showDuplicateModal = false">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col">
          <!-- Modal header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <span class="text-amber-500 text-xl">⚠</span>
            <h2 class="text-base font-semibold text-gray-800 dark:text-gray-200 flex-1">{{ t('rules.manageDuplicates') }}</h2>
            <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none" @click="showDuplicateModal = false">✕</button>
          </div>

          <!-- Modal body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('rules.duplicateModalHint') }}</p>

            <div v-for="(group, gi) in modalGroups" :key="gi" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <!-- Group header -->
              <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                {{ t('rules.overlapGroup') }} ({{ group.length }}×)
              </div>

              <!-- Each rule in the group -->
              <div class="divide-y divide-gray-100 dark:divide-gray-700">
                <label
                  v-for="rule in group"
                  :key="rule.id"
                  class="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                  :class="{ 'bg-red-50/50 dark:bg-red-900/10': selectedForDeletion.has(rule.id!) }"
                >
                  <input
                    type="checkbox"
                    :checked="selectedForDeletion.has(rule.id!)"
                    class="mt-1 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500"
                    @change="toggleDeletionSelection(rule.id!)"
                  />
                  <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-1">
                      <span
                        v-for="(cond, ci) in rule.conditions"
                        :key="ci"
                        class="inline-flex items-center rounded-full text-[10px] overflow-hidden"
                      >
                        <span class="px-1.5 py-0.5 font-medium" :class="fieldColorMap[cond.field] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'">{{ t(fieldLabelMap[cond.field] || cond.field) }}</span>
                        <span class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-purple-600 dark:text-purple-400 font-medium">{{ opDisplayLabel(cond.operator) }}</span>
                        <span class="px-1.5 py-0.5 bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-200">{{ condValue(cond) }}</span>
                      </span>
                    </div>
                    <div class="flex items-center gap-2 text-xs">
                      <span class="text-gray-500 dark:text-gray-400">→ {{ categoryDisplayName(rule.actionCategory, locale, effectiveCategories) }}</span>
                      <span v-if="rule.actionOverrideDescription" class="text-emerald-600 dark:text-emerald-400">
                        ({{ t('settings.overrideTo') }}: {{ rule.actionOverrideDescription }})
                      </span>
                    </div>
                  </div>
                  <span v-if="selectedForDeletion.has(rule.id!)" class="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium shrink-0 mt-1">{{ t('common.delete') }}</span>
                  <span v-else class="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 font-medium shrink-0 mt-1">{{ t('rules.keep') }}</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Modal footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('rules.selectedForDeletion', { count: selectedForDeletion.size }) }}</span>
            <div class="flex gap-2">
              <button class="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" @click="showDuplicateModal = false">{{ t('common.cancel') }}</button>
              <button
                class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                :disabled="saving || selectedForDeletion.size === 0"
                @click="deleteSelectedDuplicates"
              >{{ t('rules.deleteSelected') }}</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
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
.dup-fade-enter-from,
.dup-fade-leave-to {
  opacity: 0;
}
.dup-fade-enter-from .relative,
.dup-fade-leave-to .relative {
  transform: scale(0.95);
}
.dup-fade-enter-active,
.dup-fade-leave-active {
  transition: opacity 0.15s ease;
}
.dup-fade-enter-active .relative,
.dup-fade-leave-active .relative {
  transition: transform 0.15s ease;
}
</style>
