<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransactionsStore } from '@/stores/transactions'
import { updateCategories, deleteCategoryWithCascade, onRules } from '@/services/firestore'
import {
  DEFAULT_CATEGORIES,
  getEffectiveCategories,
  categoryDisplayName,
} from '@/composables/useCategories'
import { useConfirm } from '@/composables/useConfirm'
import type { CategoryDef, Rule } from '@/types'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const txnStore = useTransactionsStore()
const { confirm } = useConfirm()

const familyId = computed(() => authStore.familyId)
const locale = computed(() => prefsStore.locale)
const categories = computed(() => getEffectiveCategories(familyStore.familySettings.categories, locale.value))

const rules = ref<Rule[]>([])
let unsubRules: (() => void) | null = null
onMounted(() => {
  if (familyId.value) {
    unsubRules = onRules(familyId.value, (r) => { rules.value = r })
  }
})
onUnmounted(() => { unsubRules?.() })

// --- Add form ---
const showAddForm = ref(false)
const newNameHe = ref('')
const newNameEn = ref('')
const saving = ref(false)

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
    .replace(/^-|-$/g, '')
    || `cat-${Date.now()}`
}

async function addCategory() {
  if (!newNameHe.value.trim() || !familyId.value) return
  saving.value = true
  try {
    const id = generateId(newNameEn.value.trim() || newNameHe.value.trim())
    const existing = categories.value.map(c => c.id)
    if (existing.includes(id)) {
      // Append timestamp for uniqueness
      const uniqueId = `${id}-${Date.now()}`
      await saveNewCategory(uniqueId)
    } else {
      await saveNewCategory(id)
    }
    newNameHe.value = ''
    newNameEn.value = ''
    showAddForm.value = false
  } finally {
    saving.value = false
  }
}

async function saveNewCategory(id: string) {
  const newCat: CategoryDef = {
    id,
    name: newNameHe.value.trim(),
    nameEn: newNameEn.value.trim() || undefined,
  }
  const current = familyStore.familySettings.categories.length > 0
    ? [...familyStore.familySettings.categories]
    : [...DEFAULT_CATEGORIES]
  // Insert before system categories
  const systemIdx = current.findIndex(c => c.system)
  if (systemIdx >= 0) {
    current.splice(systemIdx, 0, newCat)
  } else {
    current.push(newCat)
  }
  await updateCategories(familyId.value!, current)
}

// --- Rename ---
const renamingId = ref<string | null>(null)
const renameHe = ref('')
const renameEn = ref('')

function startRename(cat: CategoryDef) {
  renamingId.value = cat.id
  renameHe.value = cat.name
  renameEn.value = cat.nameEn || ''
}

async function saveRename() {
  if (!renamingId.value || !familyId.value || !renameHe.value.trim()) return
  saving.value = true
  try {
    const current = familyStore.familySettings.categories.length > 0
      ? [...familyStore.familySettings.categories]
      : [...DEFAULT_CATEGORIES]
    const idx = current.findIndex(c => c.id === renamingId.value)
    if (idx >= 0) {
      current[idx] = { ...current[idx], name: renameHe.value.trim(), nameEn: renameEn.value.trim() || undefined }
      await updateCategories(familyId.value!, current)
    }
    renamingId.value = null
  } finally {
    saving.value = false
  }
}

// --- Delete ---
async function deleteCategory(cat: CategoryDef) {
  if (!familyId.value) return
  const txnCount = txnStore.transactions.filter((t: { category: string }) => t.category === cat.id).length
  const ruleCount = rules.value.filter(r => r.actionCategory === cat.id).length

  const ok = await confirm(
    `${t('categories.deleteConfirm', { name: cat.name })}\n${t('categories.deleteWarning', { txnCount, ruleCount })}`,
  )
  if (!ok) return

  saving.value = true
  try {
    const allCats = familyStore.familySettings.categories.length > 0
      ? [...familyStore.familySettings.categories]
      : [...DEFAULT_CATEGORIES]
    await deleteCategoryWithCascade(familyId.value!, cat.id, allCats)
  } finally {
    saving.value = false
  }
}

// --- Toggle shared ---
async function toggleShared(cat: CategoryDef) {
  if (!familyId.value) return
  const current = familyStore.familySettings.categories.length > 0
    ? [...familyStore.familySettings.categories]
    : [...DEFAULT_CATEGORIES]
  const idx = current.findIndex(c => c.id === cat.id)
  if (idx >= 0) {
    current[idx] = { ...current[idx], shared: !current[idx].shared }
    await updateCategories(familyId.value!, current)
  }
}

const regularCategories = computed(() => categories.value.filter(c => !c.system))
const systemCategories = computed(() => categories.value.filter(c => c.system))
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <button class="text-sm text-purple-600 dark:text-purple-400 hover:underline mb-1" @click="router.push('/settings')">
          {{ t('categories.back') }}
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-300">{{ t('categories.title') }}</h1>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
        @click="showAddForm = !showAddForm"
      >
        + {{ t('categories.addCategory') }}
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showAddForm" class="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('categories.nameHe') }}</label>
          <input
            v-model="newNameHe"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm"
            :placeholder="t('categories.namePlaceholder')"
            dir="rtl"
          />
        </div>
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{{ t('categories.nameEn') }}</label>
          <input
            v-model="newNameEn"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm"
            :placeholder="t('categories.nameEnPlaceholder')"
          />
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button class="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" @click="showAddForm = false">
          {{ t('categories.cancel') }}
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50"
          :disabled="!newNameHe.trim() || saving"
          @click="addCategory"
        >
          {{ t('categories.save') }}
        </button>
      </div>
    </div>

    <!-- Regular categories -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow divide-y divide-gray-200 dark:divide-gray-700 mb-6">
      <div
        v-for="cat in regularCategories"
        :key="cat.id"
        class="flex items-center gap-3 px-4 py-3"
      >
        <!-- Rename mode -->
        <template v-if="renamingId === cat.id">
          <input
            v-model="renameHe"
            class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-1.5 text-sm"
            dir="rtl"
          />
          <input
            v-model="renameEn"
            class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-1.5 text-sm"
            placeholder="English"
          />
          <button
            class="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs hover:bg-purple-700 disabled:opacity-50"
            :disabled="!renameHe.trim() || saving"
            @click="saveRename"
          >{{ t('categories.save') }}</button>
          <button
            class="px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
            @click="renamingId = null"
          >{{ t('categories.cancel') }}</button>
        </template>

        <!-- Normal mode -->
        <template v-else>
          <span class="flex-1 text-sm text-gray-900 dark:text-gray-300">
            {{ categoryDisplayName(cat.id, locale, categories) }}
          </span>
          <span v-if="cat.nameEn && locale !== 'en'" class="text-xs text-gray-400">{{ cat.nameEn }}</span>
          <button
            class="px-2 py-0.5 rounded-full text-xs transition-colors"
            :class="cat.shared
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'"
            @click="toggleShared(cat)"
          >{{ t('categories.shared') }}</button>
          <button
            class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
            @click="startRename(cat)"
          >{{ t('categories.rename') }}</button>
          <button
            class="text-xs text-red-500 hover:underline"
            @click="deleteCategory(cat)"
          >{{ t('categories.delete') }}</button>
        </template>
      </div>
    </div>

    <!-- System categories -->
    <div class="mb-2">
      <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {{ t('categories.system') }}
      </h2>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow divide-y divide-gray-200 dark:divide-gray-700">
      <div
        v-for="cat in systemCategories"
        :key="cat.id"
        class="flex items-center gap-3 px-4 py-3"
      >
        <span class="flex-1 text-sm text-gray-900 dark:text-gray-300">
          {{ categoryDisplayName(cat.id, locale, categories) }}
        </span>
        <span class="text-xs text-gray-400 font-mono">{{ cat.id }}</span>
        <span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
          {{ t('categories.system') }}
        </span>
      </div>
    </div>
  </div>
</template>
