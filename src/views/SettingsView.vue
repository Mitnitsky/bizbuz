<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransactionsStore } from '@/stores/transactions'
import {
  updateDisplayName,
  updateLocale,
  updateUserPreferences,
  updateCycleStartDay,
  updateIncomeAnchor,
  updateCategoryBudgets,
  updatePaymentMethodLabels,
  updatePaymentMethodOwners,
  updateCategoryNameOverrides,
  updateFamilyName,
  getAllTransactions,
  onRules,
} from '@/services/firestore'
import { CATEGORIES, categoryDisplayName } from '@/composables/useCategories'
import { formatDate } from '@/composables/useFormatters'
import { useIcons, ICON_SET_LABELS } from '@/composables/useIcons'
import { useAccentColor } from '@/composables/useAccentColor'
import type { Transaction, Rule } from '@/types'

const { t } = useI18n()
const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const transactionsStore = useTransactionsStore()
const { activeSet: activeIconSet, setIconSet } = useIcons()
const iconSetLabels = ICON_SET_LABELS
const { activeColor: activeAccent, setAccentColor, accentColors } = useAccentColor()

// --- Dialog state ---
const editNameOpen = ref(false)
const editNameValue = ref('')
const editFamilyNameOpen = ref(false)
const editFamilyNameValue = ref('')
const billingCycleOpen = ref(false)
const incomeAnchorOpen = ref(false)
const budgetsOpen = ref(false)
const paymentMethodsOpen = ref(false)
const categoryAliasesOpen = ref(false)
const csvDialogOpen = ref(false)
const csvContent = ref('')
const saving = ref(false)
const rules = ref<Rule[]>([])
let unsubRules: (() => void) | null = null

onMounted(() => {
  if (familyId.value) {
    unsubRules = onRules(familyId.value, (r) => { rules.value = r })
  }
})
onUnmounted(() => { unsubRules?.() })

// --- Computed ---
const familyId = computed(() => authStore.familyId)
const uid = computed(() => authStore.user?.uid)
const email = computed(() => authStore.appUser?.email ?? '')
const displayName = computed(() => authStore.appUser?.displayName ?? '')
const familyName = computed(() => familyStore.family?.name ?? '')
const memberCount = computed(() => familyStore.family?.memberUids.length ?? 0)
const inviteCode = computed(() => (familyStore.family?.id ?? '').slice(0, 8).toUpperCase())
const locale = computed(() => prefsStore.locale)
const themeMode = computed(() => prefsStore.themeMode)
const showOwnerFilter = computed(() => prefsStore.userPreferences?.showOwnerFilter ?? true)
const showPaymentSource = computed(() => prefsStore.userPreferences?.showPaymentSource ?? false)
const cycleStartDay = computed(() => familyStore.familySettings.cycleStartDay)
const incomeAnchorDay = computed(() => familyStore.familySettings.incomeAnchorDay)
const incomeAnchorGraceDays = computed(() => familyStore.familySettings.incomeAnchorGraceDays)
const budgets = computed(() => familyStore.familySettings.categoryBudgets)
const budgetCount = computed(() => Object.values(budgets.value).filter((v) => v > 0).length)
const paymentLabels = computed(() => familyStore.familySettings.paymentMethodLabels)
const paymentLabelCount = computed(() => Object.keys(paymentLabels.value).length)
const categoryOverrides = computed(() => familyStore.familySettings.categoryNameOverrides)
const categoryOverrideCount = computed(() => Object.values(categoryOverrides.value).filter((v) => v).length)

// Discover unique payment sources from transactions
const paymentSources = computed(() => {
  const sources = new Set<string>()
  transactionsStore.transactions.forEach((t) => {
    if (t.account) sources.add(t.account)
    if (t.companyId) sources.add(t.companyId)
  })
  return [...sources].sort()
})

// --- Edit temp state ---
const tempBudgets = ref<Record<string, string>>({})
const tempPaymentLabels = ref<Record<string, string>>({})
const tempPaymentOwners = ref<Record<string, string>>({})
const tempCategoryOverrides = ref<Record<string, string>>({})

// --- Locale/Theme ---
async function setLocale(loc: string) {
  if (!familyId.value || !uid.value) return
  try { await updateLocale(familyId.value, uid.value, loc) } catch { /* silent */ }
}

async function setTheme(mode: string) {
  if (!familyId.value || !uid.value) return
  try { await updateUserPreferences(familyId.value, uid.value, { theme_mode: mode }) } catch { /* silent */ }
}

async function toggleOwnerFilter() {
  if (!familyId.value || !uid.value) return
  try { await updateUserPreferences(familyId.value, uid.value, { show_owner_filter: !showOwnerFilter.value }) } catch { /* silent */ }
}

async function togglePaymentSource() {
  if (!familyId.value || !uid.value) return
  try { await updateUserPreferences(familyId.value, uid.value, { show_payment_source: !showPaymentSource.value }) } catch { /* silent */ }
}

// --- Display Name ---
function openEditName() {
  editNameValue.value = displayName.value
  editNameOpen.value = true
}
async function saveDisplayName() {
  if (!uid.value) return
  saving.value = true
  try {
    await updateDisplayName(uid.value, familyId.value ?? '', editNameValue.value.trim())
    await authStore.refreshAppUser()
    editNameOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- Family Name ---
function openEditFamilyName() {
  editFamilyNameValue.value = familyName.value
  editFamilyNameOpen.value = true
}
async function saveFamilyName() {
  if (!familyId.value) return
  saving.value = true
  try {
    await updateFamilyName(familyId.value, editFamilyNameValue.value.trim())
    editFamilyNameOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- Billing Cycle ---
function openBillingCycle() { billingCycleOpen.value = true }
async function saveBillingCycle(day: number) {
  if (!familyId.value) return
  saving.value = true
  try {
    await updateCycleStartDay(familyId.value, day)
    billingCycleOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- Income Anchor ---
const editAnchorDay = ref<number | null>(null)
const editAnchorGrace = ref(3)

function openIncomeAnchor() {
  editAnchorDay.value = incomeAnchorDay.value
  editAnchorGrace.value = incomeAnchorGraceDays.value
  incomeAnchorOpen.value = true
}
async function saveIncomeAnchor() {
  if (!familyId.value) return
  saving.value = true
  try {
    await updateIncomeAnchor(familyId.value, editAnchorDay.value, editAnchorGrace.value)
    incomeAnchorOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}
function incomeAnchorLabel(): string {
  if (incomeAnchorDay.value === null) return t('settings.incomeAnchorNone')
  return t('settings.incomeAnchorSummary', { day: incomeAnchorDay.value, grace: incomeAnchorGraceDays.value })
}

// --- Budgets ---
function openBudgets() {
  const b: Record<string, string> = {}
  CATEGORIES.forEach((c) => {
    b[c] = (budgets.value[c] ?? 0).toString()
  })
  tempBudgets.value = b
  budgetsOpen.value = true
}
async function saveBudgets() {
  if (!familyId.value) return
  saving.value = true
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(tempBudgets.value)) {
    const n = parseFloat(v)
    if (!isNaN(n) && n > 0) result[k] = n
  }
  try {
    await updateCategoryBudgets(familyId.value, result)
    budgetsOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- Payment Methods ---
const paymentOwners = computed(() => familyStore.familySettings.paymentMethodOwners)

function openPaymentMethods() {
  const labels: Record<string, string> = {}
  const owners: Record<string, string> = {}
  paymentSources.value.forEach((s) => {
    labels[s] = paymentLabels.value[s] ?? ''
    owners[s] = paymentOwners.value[s] ?? 'shared'
  })
  tempPaymentLabels.value = labels
  tempPaymentOwners.value = owners
  paymentMethodsOpen.value = true
}
async function savePaymentMethods() {
  if (!familyId.value) return
  saving.value = true
  const resultLabels: Record<string, string> = {}
  const resultOwners: Record<string, string> = {}
  for (const [k, v] of Object.entries(tempPaymentLabels.value)) {
    if (v.trim()) resultLabels[k] = v.trim()
  }
  for (const [k, v] of Object.entries(tempPaymentOwners.value)) {
    resultOwners[k] = v
  }
  try {
    await Promise.all([
      updatePaymentMethodLabels(familyId.value, resultLabels),
      updatePaymentMethodOwners(familyId.value, resultOwners),
    ])
    paymentMethodsOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- Category Aliases ---
function openCategoryAliases() {
  const overrides: Record<string, string> = {}
  CATEGORIES.forEach((c) => { overrides[c] = categoryOverrides.value[c] ?? '' })
  tempCategoryOverrides.value = overrides
  categoryAliasesOpen.value = true
}
async function saveCategoryAliases() {
  if (!familyId.value) return
  saving.value = true
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(tempCategoryOverrides.value)) {
    if (v.trim()) result[k] = v.trim()
  }
  try {
    await updateCategoryNameOverrides(familyId.value, result)
    categoryAliasesOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- CSV Export ---
async function exportCsv() {
  if (!familyId.value) return
  try {
    const txns: Transaction[] = await getAllTransactions(familyId.value)
    const header = 'Date,Description,Category,Amount,Owner,Source'
    const rows = txns.map((tx) => {
      const desc = (tx.overrideDescription || tx.description).replace(/,/g, ' ')
      return `${formatDate(tx.date)},${desc},${tx.category},${tx.chargedAmount},${tx.ownerTag},${tx.source}`
    })
    csvContent.value = [header, ...rows].join('\n')
    csvDialogOpen.value = true
  } catch { /* silent */ }
}

function copyCsv() {
  navigator.clipboard.writeText(csvContent.value)
}

// --- Sign Out ---
async function handleSignOut() {
  await authStore.logout()
}

// --- Cycle display helper ---
function cycleLabel(day: number): string {
  if (day === -1) return t('settings.lastDayOfMonth')
  return t('settings.day', { n: day })
}

// --- Rules (count only, editor is now at /settings/rules) ---
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.settings') }}</h1>

    <div class="grid grid-cols-1 min-[800px]:grid-cols-3 gap-6">
      <!-- Column 1: Profile -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ t('settings.profile') }}</h2>
        <div class="border-b border-gray-200 dark:border-gray-700 mb-4"></div>

        <div class="space-y-3 text-sm">
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('auth.email') }}</span><span class="text-gray-900 dark:text-white">{{ email }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('settings.editDisplayName') }}</span><span class="text-gray-900 dark:text-white">{{ displayName }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('settings.familyName') }}</span><span class="text-gray-900 dark:text-white">{{ familyName }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Members</span><span class="text-gray-900 dark:text-white">{{ memberCount }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('home.inviteCode') }}</span><span class="font-mono text-gray-900 dark:text-white">{{ inviteCode }}</span></div>
        </div>

        <div class="mt-4 space-y-2">
          <button class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" @click="openEditName">{{ t('settings.editDisplayName') }}</button>
          <button class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" @click="exportCsv">{{ t('settings.exportCsv') }}</button>
          <button class="w-full px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700" @click="handleSignOut">{{ t('common.signOut') }}</button>
        </div>
      </div>

      <!-- Column 2: Family Settings -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ t('settings.familySettings') }}</h2>
        <div class="border-b border-gray-200 dark:border-gray-700 mb-4"></div>

        <div class="space-y-4">
          <!-- Billing Cycle -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openBillingCycle">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.billingCycleStartDay') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ cycleLabel(cycleStartDay) }}</span>
          </div>

          <!-- Income Anchor -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openIncomeAnchor">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.incomeAnchor') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ incomeAnchorLabel() }}</span>
          </div>

          <!-- Category Budgets -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openBudgets">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.categoryBudgets') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.nCategories', { n: budgetCount }) }}</span>
          </div>

          <!-- Payment Methods -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openPaymentMethods">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.paymentMethods') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ paymentLabelCount > 0 ? t('settings.nLabelsConfigured', { n: paymentLabelCount }) : t('settings.noPaymentMethods') }}</span>
          </div>

          <!-- Category Aliases -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openCategoryAliases">
            <span class="text-sm text-gray-700 dark:text-gray-300">Category Name Aliases</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ categoryOverrideCount > 0 ? t('settings.nLabelsConfigured', { n: categoryOverrideCount }) : t('settings.noLabelsConfigured') }}</span>
          </div>

          <!-- Categorization Rules -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="$router.push('/settings/rules')">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.categorizationRules') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ rules.length }} {{ t('settings.rulesCount') }} →</span>
          </div>

          <!-- Family Name -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openEditFamilyName">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.familyName') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ familyName }}</span>
          </div>
        </div>
      </div>

      <!-- Column 3: User Settings -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ t('settings.userSettings') }}</h2>
        <div class="border-b border-gray-200 dark:border-gray-700 mb-4"></div>

        <div class="space-y-5">
          <!-- Language -->
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.language') }}</div>
            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="locale === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setLocale('en')">English</button>
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="locale === 'he' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setLocale('he')">עברית</button>
            </div>
          </div>

          <!-- Theme -->
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.themeMode') }}</div>
            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="themeMode === 'system' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setTheme('system')">{{ t('settings.themeSystem') }}</button>
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="themeMode === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setTheme('light')">{{ t('settings.themeLight') }}</button>
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="themeMode === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setTheme('dark')">{{ t('settings.themeDark') }}</button>
            </div>
          </div>

          <!-- Icon Set -->
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.iconSet') }}</div>
            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                v-for="(label, key) in iconSetLabels"
                :key="key"
                class="flex-1 py-2 text-sm font-medium transition-colors"
                :class="activeIconSet === key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
                @click="setIconSet(key as any)"
              >{{ label }}</button>
            </div>
          </div>

          <!-- Accent Color -->
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.accentColor') }}</div>
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="c in accentColors"
                :key="c.key"
                class="w-8 h-8 rounded-full border-2 transition-all"
                :class="activeAccent === c.key ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-800' : 'border-transparent hover:scale-105'"
                :style="{ backgroundColor: c.swatch }"
                :title="c.label"
                @click="setAccentColor(c.key)"
              />
            </div>
          </div>

          <!-- Show Owner Filter -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.showOwnerFilter') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.showOwnerFilterDesc') }}</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" :checked="showOwnerFilter" class="sr-only peer" @change="toggleOwnerFilter" />
              <div
                class="w-11 h-6 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                :class="showOwnerFilter
                  ? 'bg-purple-600 after:translate-x-full after:border-white'
                  : 'bg-gray-300 dark:bg-gray-600 after:border-gray-300'"
              ></div>
            </label>
          </div>

          <!-- Show Payment Source -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.showPaymentSource') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.showPaymentSourceDesc') }}</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" :checked="showPaymentSource" class="sr-only peer" @change="togglePaymentSource" />
              <div
                class="w-11 h-6 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                :class="showPaymentSource
                  ? 'bg-purple-600 after:translate-x-full after:border-white'
                  : 'bg-gray-300 dark:bg-gray-600 after:border-gray-300'"
              ></div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== DIALOGS ===== -->

    <!-- Edit Display Name -->
    <Teleport to="body">
      <div v-if="editNameOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="editNameOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('settings.editDisplayName') }}</h3>
          <input v-model="editNameValue" type="text" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 mb-4" />
          <div class="flex gap-3 justify-end">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="editNameOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="saving" @click="saveDisplayName">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Family Name -->
    <Teleport to="body">
      <div v-if="editFamilyNameOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="editFamilyNameOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('settings.editFamilyName') }}</h3>
          <input v-model="editFamilyNameValue" type="text" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 mb-4" />
          <div class="flex gap-3 justify-end">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="editFamilyNameOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="saving" @click="saveFamilyName">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Billing Cycle -->
    <Teleport to="body">
      <div v-if="billingCycleOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="billingCycleOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">{{ t('settings.billingCycleStartDay') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.whichDayCycleStarts') }}</p>
          <div class="space-y-1">
            <button
              v-for="day in [...Array.from({ length: 28 }, (_, i) => i + 1), -1]"
              :key="day"
              class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
              :class="day === cycleStartDay ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
              @click="saveBillingCycle(day)"
            >{{ cycleLabel(day) }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Income Anchor -->
    <Teleport to="body">
      <div v-if="incomeAnchorOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="incomeAnchorOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">{{ t('settings.incomeAnchor') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.incomeAnchorDesc') }}</p>

          <div class="space-y-4">
            <!-- Anchor day selector -->
            <div>
              <label class="text-sm text-gray-700 dark:text-gray-300 mb-1 block">{{ t('settings.incomeAnchorDay') }}</label>
              <select
                :value="editAnchorDay ?? ''"
                @change="editAnchorDay = ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value)"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              >
                <option value="">{{ t('settings.incomeAnchorNone') }}</option>
                <option v-for="d in 28" :key="d" :value="d">{{ cycleLabel(d) }}</option>
              </select>
            </div>

            <!-- Grace days -->
            <div v-if="editAnchorDay !== null">
              <label class="text-sm text-gray-700 dark:text-gray-300 mb-1 block">{{ t('settings.incomeAnchorGrace') }}</label>
              <input
                v-model.number="editAnchorGrace"
                type="number"
                min="0"
                max="10"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div class="flex gap-2 justify-end mt-6">
            <button class="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" @click="incomeAnchorOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50" :disabled="saving" @click="saveIncomeAnchor">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Category Budgets -->
    <Teleport to="body">
      <div v-if="budgetsOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="budgetsOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('settings.categoryBudgets') }}</h3>
          <div class="space-y-2">
            <div v-for="cat in CATEGORIES" :key="cat" class="flex items-center gap-3">
              <span class="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{{ categoryDisplayName(cat, locale) }}</span>
              <input v-model="tempBudgets[cat]" type="number" step="1" placeholder="₪" class="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm" />
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="budgetsOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="saving" @click="saveBudgets">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Payment Methods -->
    <Teleport to="body">
      <div v-if="paymentMethodsOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="paymentMethodsOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('settings.paymentMethods') }}</h3>
          <div v-if="paymentSources.length === 0" class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.noPaymentMethods') }}</div>
          <div v-else class="space-y-2">
            <div v-for="src in paymentSources" :key="src" class="flex items-center gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate font-mono min-w-0">{{ src }}</span>
              <input v-model="tempPaymentLabels[src]" type="text" :placeholder="t('settings.alias')" class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm" />
              <select
                v-model="tempPaymentOwners[src]"
                class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm"
              >
                <option value="shared">{{ familyStore.ownerTagNames.shared ?? t('spendings.shared') }}</option>
                <option value="userA">{{ familyStore.ownerTagNames.userA ?? 'User A' }}</option>
                <option value="userB">{{ familyStore.ownerTagNames.userB ?? 'User B' }}</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="paymentMethodsOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="saving" @click="savePaymentMethods">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Category Aliases -->
    <Teleport to="body">
      <div v-if="categoryAliasesOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="categoryAliasesOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Category Name Aliases</h3>
          <div class="space-y-2">
            <div v-for="cat in CATEGORIES" :key="cat" class="flex items-center gap-3">
              <span class="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate" :title="cat">{{ categoryDisplayName(cat, locale) }}</span>
              <input v-model="tempCategoryOverrides[cat]" type="text" :placeholder="cat" class="w-36 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm" />
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="categoryAliasesOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50" :disabled="saving" @click="saveCategoryAliases">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- CSV Export -->
    <Teleport to="body">
      <div v-if="csvDialogOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="csvDialogOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('settings.exportCsv') }}</h3>
          <textarea readonly :value="csvContent" class="w-full h-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-xs font-mono"></textarea>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="csvDialogOpen = false">{{ t('common.close') }}</button>
            <button class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" @click="copyCsv">Copy</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
