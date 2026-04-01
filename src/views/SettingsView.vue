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
  updateHiddenDashboardTiles,
  updateDashboardTileOrder,
  getAllTransactions,
  onRules,
} from '@/services/firestore'
import { getEffectiveCategories, categoryDisplayName } from '@/composables/useCategories'
import { formatDate } from '@/composables/useFormatters'
import { useIcons, ICON_SET_LABELS } from '@/composables/useIcons'
import { useAccentColor } from '@/composables/useAccentColor'
import type { Transaction, Rule } from '@/types'
import draggable from 'vuedraggable'

const { t } = useI18n()
const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const transactionsStore = useTransactionsStore()
const { activeSet: activeIconSet, setIconSet, icon } = useIcons()
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
const dashboardTilesOpen = ref(false)
const editNameHeValue = ref('')
const editFamilyNameHeValue = ref('')
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
const displayNameHe = computed(() => authStore.appUser?.displayNameHe ?? '')
const familyName = computed(() => familyStore.familyName)
const memberCount = computed(() => familyStore.family?.memberUids.length ?? 0)
const inviteCode = computed(() => (familyStore.family?.id ?? '').slice(0, 8).toUpperCase())
const locale = computed(() => prefsStore.locale)
const themeMode = computed(() => prefsStore.themeMode)
const showOwnerFilter = computed(() => prefsStore.userPreferences?.showOwnerFilter ?? true)
const showPaymentSource = computed(() => prefsStore.userPreferences?.showPaymentSource ?? false)
const showCategoryHints = computed(() => prefsStore.userPreferences?.showCategoryHints ?? false)
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

async function toggleCategoryHints() {
  if (!familyId.value || !uid.value) return
  try { await updateUserPreferences(familyId.value, uid.value, { show_category_hints: !showCategoryHints.value }) } catch { /* silent */ }
}

// --- Display Name ---
function openEditName() {
  editNameValue.value = displayName.value
  editNameHeValue.value = displayNameHe.value
  editNameOpen.value = true
}
async function saveDisplayName() {
  if (!uid.value) return
  saving.value = true
  try {
    await updateDisplayName(uid.value, familyId.value ?? '', editNameValue.value.trim(), editNameHeValue.value.trim() || undefined)
    await authStore.refreshAppUser()
    editNameOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

// --- Family Name ---
const copiedFamilyId = ref(false)
function copyFamilyId() {
  if (familyId.value) {
    navigator.clipboard.writeText(familyId.value)
    copiedFamilyId.value = true
    setTimeout(() => { copiedFamilyId.value = false }, 2000)
  }
}
function openEditFamilyName() {
  editFamilyNameValue.value = familyStore.family?.name ?? ''
  editFamilyNameHeValue.value = familyStore.family?.nameHe ?? ''
  editFamilyNameOpen.value = true
}
async function saveFamilyName() {
  if (!familyId.value) return
  saving.value = true
  try {
    await updateFamilyName(familyId.value, editFamilyNameValue.value.trim(), editFamilyNameHeValue.value.trim() || undefined)
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
  getEffectiveCategories(familyStore.familySettings.categories).forEach((c) => {
    b[c.id] = (budgets.value[c.id] ?? 0).toString()
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
  getEffectiveCategories(familyStore.familySettings.categories).forEach((c) => { overrides[c.id] = categoryOverrides.value[c.id] ?? '' })
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

// --- Dashboard Tiles ---
const ALL_TILES = ['uncategorized', 'cycle_spend', 'income', 'category_pie', 'budget_remaining', 'exceptional', 'installments', 'budgets', 'trackers'] as const
const ALWAYS_VISIBLE = ['cycle_spend']

const TILE_LABELS: Record<string, string> = {
  cycle_spend: 'home.cycleExpenses',
  income: 'home.income',
  uncategorized: 'home.uncategorized',
  category_pie: 'home.categoryPie',
  budget_remaining: 'home.budgetRemaining',
  exceptional: 'home.exceptional',
  installments: 'home.futurePayments',
  budgets: 'home.budgets',
  trackers: 'home.trackers',
}

const tempHiddenTiles = ref<Set<string>>(new Set())
const tempTileOrder = ref<string[]>([])

function openDashboardTiles() {
  tempHiddenTiles.value = new Set(prefsStore.userPreferences?.hiddenDashboardTiles ?? [])
  const savedOrder = prefsStore.userPreferences?.dashboardTileOrder
  if (savedOrder && savedOrder.length > 0) {
    const missing = ([...ALL_TILES] as string[]).filter(t => !savedOrder.includes(t))
    tempTileOrder.value = [...savedOrder, ...missing]
  } else {
    tempTileOrder.value = [...ALL_TILES]
  }
  dashboardTilesOpen.value = true
}

const visibleTilesList = computed({
  get() {
    return tempTileOrder.value
      .filter(id => !tempHiddenTiles.value.has(id))
      .map(id => ({ id }))
  },
  set(newList: Array<{ id: string }>) {
    const visibleIds = newList.map(t => t.id)
    const hiddenIds = tempTileOrder.value.filter(id => tempHiddenTiles.value.has(id))
    tempTileOrder.value = [...visibleIds, ...hiddenIds]
  }
})

const hiddenTilesList = computed(() => {
  return tempTileOrder.value.filter(id => tempHiddenTiles.value.has(id))
})

function toggleDashboardTile(id: string) {
  const next = new Set(tempHiddenTiles.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  tempHiddenTiles.value = next
}

async function saveDashboardTiles() {
  if (!familyId.value || !uid.value) return
  saving.value = true
  try {
    await updateHiddenDashboardTiles(familyId.value, uid.value, [...tempHiddenTiles.value])
    await updateDashboardTileOrder(familyId.value, uid.value, tempTileOrder.value)
    dashboardTilesOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

const dashboardTilesLabel = computed(() => {
  const hidden = prefsStore.userPreferences?.hiddenDashboardTiles ?? []
  return `${ALL_TILES.length - hidden.length}/${ALL_TILES.length}`
})

// --- Rules (count only, editor is now at /settings/rules) ---

// --- Navigation Bar ---

const allNavItems = [
  { name: 'home', labelKey: 'nav.home', iconName: 'home' as const },
  { name: 'spendings', labelKey: 'nav.spendings', iconName: 'spendings' as const },
  { name: 'installments', labelKey: 'nav.installments', iconName: 'installments' as const },
  { name: 'savings', labelKey: 'nav.savings', iconName: 'savings' as const },
  { name: 'investments', labelKey: 'nav.investments', iconName: 'investments' as const },
  { name: 'loans', labelKey: 'nav.loans', iconName: 'loans' as const },
  { name: 'statistics', labelKey: 'nav.statistics', iconName: 'statistics' as const },
  { name: 'settings', labelKey: 'nav.settings', iconName: 'settings' as const },
]
const DEFAULT_NAV_ORDER = ['home', 'spendings', 'statistics']
const MAX_PRIMARY_TABS = 4

const navBarSelected = ref<string[]>([])
const navBarDialogOpen = ref(false)

const navBarDragList = computed({
  get: () => navBarSelected.value.map(name => allNavItems.find(i => i.name === name)!).filter(Boolean),
  set: (items) => { navBarSelected.value = items.map(i => i.name) },
})

function openNavBarSettings() {
  const current = prefsStore.userPreferences?.navBarOrder?.length
    ? [...prefsStore.userPreferences.navBarOrder]
    : [...DEFAULT_NAV_ORDER]
  // Filter out names that no longer exist
  navBarSelected.value = current.filter(n => allNavItems.some(i => i.name === n))
  navBarDialogOpen.value = true
}

function toggleNavItem(name: string) {
  const idx = navBarSelected.value.indexOf(name)
  if (idx >= 0) {
    navBarSelected.value.splice(idx, 1)
  } else if (navBarSelected.value.length < MAX_PRIMARY_TABS) {
    navBarSelected.value.push(name)
  }
}

async function saveNavBar() {
  if (!familyId.value || !uid.value) return
  saving.value = true
  try {
    await updateUserPreferences(familyId.value, uid.value, { nav_bar_order: navBarSelected.value })
    navBarDialogOpen.value = false
  } catch { /* silent */ } finally { saving.value = false }
}

const navBarLabel = computed(() => {
  const order = prefsStore.userPreferences?.navBarOrder
  const count = order?.length || DEFAULT_NAV_ORDER.length
  return t('settings.nTabs', { n: count })
})
</script>

<template>
  <div class="max-w-7xl mx-auto w-full p-4">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-300 mb-6">{{ t('nav.settings') }}</h1>

    <div class="grid grid-cols-1 min-[800px]:grid-cols-3 gap-6">
      <!-- Column 1: Account & Family -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.profile') }}</h3>

        <div class="space-y-3 text-sm">
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('auth.email') }}</span><span class="text-gray-900 dark:text-gray-300">{{ email }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('settings.editDisplayName') }}</span><span class="text-gray-900 dark:text-gray-300">{{ displayName }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('settings.displayNameHe') }}</span><span class="text-gray-900 dark:text-gray-300">{{ displayNameHe }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('settings.members') }}</span><span class="text-gray-900 dark:text-gray-300">{{ memberCount }}</span></div>
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">{{ t('home.inviteCode') }}</span><span class="font-mono text-gray-900 dark:text-gray-300">{{ inviteCode }}</span></div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500 dark:text-gray-400">Family ID</span>
            <span class="relative">
              <button
                class="font-mono text-xs text-gray-900 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                @click="copyFamilyId"
              >{{ familyId }} 📋</button>
              <span
                v-if="copiedFamilyId"
                class="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
              >{{ t('settings.copied') }}</span>
            </span>
          </div>
        </div>

        <div class="mt-4 space-y-2">
          <button class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" @click="openEditName">{{ t('settings.editDisplayName') }}</button>
          <button class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" @click="exportCsv">{{ t('settings.exportCsv') }}</button>
          <button class="w-full px-3 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700" @click="handleSignOut">{{ t('common.signOut') }}</button>
        </div>

        <div class="border-b border-gray-200 dark:border-gray-700 my-4"></div>

        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.familySettings') }}</h3>

        <div class="space-y-4">
          <!-- Family Name -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openEditFamilyName">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.familyName') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ familyName }}</span>
          </div>

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
        </div>
      </div>

      <!-- Column 2: Categories & Rules -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.categories') }}</h3>

        <div class="space-y-4">
          <!-- Manage Categories -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="$router.push('/settings/categories')">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.manageCategories') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ locale === 'he' ? '←' : '→' }}</span>
          </div>

          <!-- Category Budgets -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openBudgets">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.categoryBudgets') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.nCategories', { n: budgetCount }) }}</span>
          </div>

          <!-- Category Aliases -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openCategoryAliases">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.categoryAliases') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ categoryOverrideCount > 0 ? t('settings.nLabelsConfigured', { n: categoryOverrideCount }) : t('settings.noLabelsConfigured') }}</span>
          </div>
        </div>

        <div class="border-b border-gray-200 dark:border-gray-700 my-4"></div>

        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.automation') }}</h3>

        <div class="space-y-4">
          <!-- Categorization Rules -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="$router.push('/settings/rules')">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.categorizationRules') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ rules.length }} {{ t('settings.rulesCount') }} {{ locale === 'he' ? '←' : '→' }}</span>
          </div>

          <!-- Payment Methods -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openPaymentMethods">
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.paymentMethods') }}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ paymentLabelCount > 0 ? t('settings.nLabelsConfigured', { n: paymentLabelCount }) : t('settings.noPaymentMethods') }}</span>
          </div>
        </div>
      </div>

      <!-- Column 3: Appearance & Display -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.appearance') }}</h3>

        <div class="space-y-5">
          <!-- Language -->
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.language') }}</div>
            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="locale === 'en' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setLocale('en')">English</button>
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="locale === 'he' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setLocale('he')">עברית</button>
            </div>
          </div>

          <!-- Theme -->
          <div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.themeMode') }}</div>
            <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="themeMode === 'system' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setTheme('system')">{{ t('settings.themeSystem') }}</button>
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="themeMode === 'light' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setTheme('light')">{{ t('settings.themeLight') }}</button>
              <button class="flex-1 py-2 text-sm font-medium transition-colors" :class="themeMode === 'dark' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'" @click="setTheme('dark')">{{ t('settings.themeDark') }}</button>
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
                :class="activeIconSet === key ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
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
        </div>

        <div class="border-b border-gray-200 dark:border-gray-700 my-4"></div>

        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.display') }}</h3>

        <div class="space-y-5">
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

          <!-- Show Category Hints -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.showCategoryHints') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.showCategoryHintsDesc') }}</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" :checked="showCategoryHints" class="sr-only peer" @change="toggleCategoryHints" />
              <div
                class="w-11 h-6 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                :class="showCategoryHints
                  ? 'bg-purple-600 after:translate-x-full after:border-white'
                  : 'bg-gray-300 dark:bg-gray-600 after:border-gray-300'"
              ></div>
            </label>
          </div>
        </div>

        <div class="border-b border-gray-200 dark:border-gray-700 my-4"></div>

        <h3 class="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 pb-1.5 border-b border-purple-200 dark:border-purple-800">{{ t('settings.layout') }}</h3>

        <div class="space-y-4">
          <!-- Dashboard Tiles -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openDashboardTiles">
            <div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.dashboardTiles') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.dashboardTilesDesc') }}</div>
            </div>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ dashboardTilesLabel }}</span>
          </div>

          <!-- Navigation Bar -->
          <div class="flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-2 rounded-lg" @click="openNavBarSettings">
            <div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ t('settings.navBar') }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.navBarDesc') }}</div>
            </div>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ navBarLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== DIALOGS ===== -->

    <!-- Edit Display Name -->
    <Teleport to="body">
      <div v-if="editNameOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="editNameOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ t('settings.editDisplayName') }}</h3>
          <input v-model="editNameValue" type="text" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 mb-3" :placeholder="t('settings.editDisplayName')" />
          <input v-model="editNameHeValue" type="text" dir="rtl" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 mb-4" :placeholder="t('settings.displayNameHe')" />
          <div class="flex gap-3 justify-end">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="editNameOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveDisplayName">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Family Name -->
    <Teleport to="body">
      <div v-if="editFamilyNameOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="editFamilyNameOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ t('settings.editFamilyName') }}</h3>
          <input v-model="editFamilyNameValue" type="text" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 mb-3" :placeholder="t('settings.familyName')" />
          <input v-model="editFamilyNameHeValue" type="text" dir="rtl" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 mb-4" :placeholder="t('settings.familyNameHe')" />
          <div class="flex gap-3 justify-end">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="editFamilyNameOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveFamilyName">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Billing Cycle -->
    <Teleport to="body">
      <div v-if="billingCycleOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="billingCycleOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-2">{{ t('settings.billingCycleStartDay') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.whichDayCycleStarts') }}</p>
          <div class="space-y-1">
            <button
              v-for="day in [...Array.from({ length: 28 }, (_, i) => i + 1), -1]"
              :key="day"
              class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
              :class="day === cycleStartDay ? 'bg-purple-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
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
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-2">{{ t('settings.incomeAnchor') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.incomeAnchorDesc') }}</p>

          <div class="space-y-4">
            <!-- Anchor day selector -->
            <div>
              <label class="text-sm text-gray-700 dark:text-gray-300 mb-1 block">{{ t('settings.incomeAnchorDay') }}</label>
              <select
                :value="editAnchorDay ?? ''"
                @change="editAnchorDay = ($event.target as HTMLSelectElement).value === '' ? null : Number(($event.target as HTMLSelectElement).value)"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm"
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
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div class="flex gap-2 justify-end mt-6">
            <button class="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" @click="incomeAnchorOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveIncomeAnchor">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Category Budgets -->
    <Teleport to="body">
      <div v-if="budgetsOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="budgetsOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ t('settings.categoryBudgets') }}</h3>
          <div class="space-y-2">
            <div v-for="catDef in getEffectiveCategories(familyStore.familySettings.categories)" :key="catDef.id" class="flex items-center gap-3">
              <span class="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{{ categoryDisplayName(catDef.id, locale, getEffectiveCategories(familyStore.familySettings.categories)) }}</span>
              <input v-model="tempBudgets[catDef.id]" type="number" step="1" placeholder="₪" class="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1 text-sm" />
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="budgetsOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveBudgets">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Payment Methods -->
    <Teleport to="body">
      <div v-if="paymentMethodsOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="paymentMethodsOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ t('settings.paymentMethods') }}</h3>
          <div v-if="paymentSources.length === 0" class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.noPaymentMethods') }}</div>
          <div v-else class="space-y-2">
            <div v-for="src in paymentSources" :key="src" class="flex items-center gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate font-mono min-w-0">{{ src }}</span>
              <input v-model="tempPaymentLabels[src]" type="text" :placeholder="t('settings.alias')" class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1 text-sm" />
              <select
                v-model="tempPaymentOwners[src]"
                class="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1 text-sm"
              >
                <option value="shared">{{ familyStore.ownerTagNames.shared ?? t('spendings.shared') }}</option>
                <option value="userA">{{ familyStore.ownerTagNames.userA ?? 'User A' }}</option>
                <option value="userB">{{ familyStore.ownerTagNames.userB ?? 'User B' }}</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="paymentMethodsOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="savePaymentMethods">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Category Aliases -->
    <Teleport to="body">
      <div v-if="categoryAliasesOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="categoryAliasesOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ t('settings.categoryAliases') }}</h3>
          <div class="space-y-2">
            <div v-for="catDef in getEffectiveCategories(familyStore.familySettings.categories)" :key="catDef.id" class="flex items-center gap-3">
              <span class="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate" :title="catDef.id">{{ categoryDisplayName(catDef.id, locale, getEffectiveCategories(familyStore.familySettings.categories)) }}</span>
              <input v-model="tempCategoryOverrides[catDef.id]" type="text" :placeholder="catDef.name" class="w-36 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-2 py-1 text-sm" />
            </div>
          </div>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="categoryAliasesOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveCategoryAliases">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- CSV Export -->
    <Teleport to="body">
      <div v-if="csvDialogOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="csvDialogOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ t('settings.exportCsv') }}</h3>
          <textarea readonly :value="csvContent" class="w-full h-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-xs font-mono"></textarea>
          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="csvDialogOpen = false">{{ t('common.close') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700" @click="copyCsv">{{ t('settings.copy') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Navigation Bar -->
    <Teleport to="body">
      <div v-if="navBarDialogOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="navBarDialogOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-1">{{ t('settings.navBar') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.navBarDesc') }}</p>

          <!-- Selected tabs (draggable) -->
          <div class="mb-3">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wider">{{ t('settings.navBarBottomBar') }}</div>
            <draggable
              v-model="navBarDragList"
              item-key="name"
              handle=".drag-handle"
              :animation="200"
              class="space-y-1"
            >
              <template #item="{ element }">
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50">
                  <span class="drag-handle cursor-grab text-gray-400 dark:text-gray-500">⠿</span>
                  <component :is="icon(element.iconName)" class="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ t(element.labelKey) }}</span>
                  <button class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm" @click="toggleNavItem(element.name)">✕</button>
                </div>
              </template>
            </draggable>
          </div>

          <!-- Available items (not selected) -->
          <div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wider">{{ t('settings.navBarAvailable') }}</div>
            <div class="space-y-1">
              <div
                v-for="item in allNavItems.filter(i => !navBarSelected.includes(i.name))"
                :key="item.name"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                :class="{ 'opacity-50 cursor-not-allowed': navBarSelected.length >= MAX_PRIMARY_TABS }"
                @click="toggleNavItem(item.name)"
              >
                <component :is="icon(item.iconName)" class="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ t(item.labelKey) }}</span>
                <span v-if="navBarSelected.length < MAX_PRIMARY_TABS" class="text-gray-400 text-sm">+</span>
              </div>
            </div>
          </div>

          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="navBarDialogOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveNavBar">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Dashboard Tiles -->
    <Teleport to="body">
      <div v-if="dashboardTilesOpen" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="dashboardTilesOpen = false">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-1">{{ t('settings.dashboardTiles') }}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.dashboardTilesDesc') }}</p>

          <!-- Visible tiles (draggable) -->
          <div class="mb-3">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wider">{{ t('settings.visible') }}</div>
            <draggable
              v-model="visibleTilesList"
              item-key="id"
              handle=".drag-handle"
              :animation="200"
              class="space-y-1"
            >
              <template #item="{ element }">
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50">
                  <span class="drag-handle cursor-grab text-gray-400 dark:text-gray-500">⠿</span>
                  <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ t(TILE_LABELS[element.id]) }}</span>
                  <button
                    v-if="!ALWAYS_VISIBLE.includes(element.id)"
                    class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm"
                    @click="toggleDashboardTile(element.id)"
                  >✕</button>
                </div>
              </template>
            </draggable>
          </div>

          <!-- Hidden tiles -->
          <div v-if="hiddenTilesList.length > 0">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium uppercase tracking-wider">{{ t('settings.hidden') }}</div>
            <div class="space-y-1">
              <div
                v-for="tileId in hiddenTilesList"
                :key="tileId"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                @click="toggleDashboardTile(tileId)"
              >
                <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ t(TILE_LABELS[tileId]) }}</span>
                <span class="text-gray-400 text-sm">+</span>
              </div>
            </div>
          </div>

          <div class="flex gap-3 justify-end mt-4">
            <button class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" @click="dashboardTilesOpen = false">{{ t('common.cancel') }}</button>
            <button class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50" :disabled="saving" @click="saveDashboardTiles">{{ t('common.save') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
