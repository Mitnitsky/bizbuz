<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Transaction } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { addRule } from '@/services/firestore'
import { getEffectiveCategories, categoryDisplayName } from '@/composables/useCategories'
import { useI18n } from 'vue-i18n'

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

const conditions = ref<Array<{ field: string; operator: string; value: string }>>([])
const actionCategory = ref('')
const actionDescription = ref('')
const saving = ref(false)

const locale = computed(() => prefsStore.locale)
const overrides = computed(() => familyStore.familySettings.categoryNameOverrides)
const effectiveCategories = computed(() => getEffectiveCategories(familyStore.familySettings.categories, locale.value))

const fieldOptions = ['description', 'category', 'account'] as const
const operatorOptions = ['equals', 'contains'] as const

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
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('spendings.createRule') }}</h2>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl p-1" @click="show = false">✕</button>
        </div>

        <!-- Conditions -->
        <div class="mb-6">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Conditions</div>
          <div
            v-for="(cond, idx) in conditions"
            :key="idx"
            class="flex gap-2 mb-2 items-start"
          >
            <select
              v-model="cond.field"
              class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 w-28"
            >
              <option v-for="f in fieldOptions" :key="f" :value="f">{{ f }}</option>
            </select>
            <select
              v-model="cond.operator"
              class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-2 text-sm text-gray-900 dark:text-gray-100 w-24"
            >
              <option v-for="op in operatorOptions" :key="op" :value="op">{{ t('spendings.' + op) }}</option>
            </select>
            <input
              v-model="cond.value"
              class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              :placeholder="t('spendings.value')"
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
          >+ {{ t('spendings.addCondition') }}</button>
        </div>

        <!-- Actions -->
        <div class="mb-6 space-y-3">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Actions</div>
          <div>
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('spendings.actionCategory') }}</label>
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
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('spendings.actionDescription') }}</label>
            <input
              v-model="actionDescription"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              :placeholder="t('spendings.overrideDescription')"
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
