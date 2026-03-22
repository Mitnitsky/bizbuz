<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { addManualTransaction } from '@/services/firestore'
import { getEffectiveCategories, categoryDisplayName, DEFAULT_CATEGORY } from '@/composables/useCategories'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  close: []
}>()

const show = defineModel<boolean>({ default: false })

const { t } = useI18n()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()

const amount = ref(0)
const description = ref('')
const category = ref(DEFAULT_CATEGORY)
const ownerTag = ref('shared')
const saving = ref(false)

const locale = computed(() => prefsStore.locale)
const overrides = computed(() => familyStore.familySettings.categoryNameOverrides)
const effectiveCategories = computed(() => getEffectiveCategories(familyStore.familySettings.categories))

const isValid = computed(() => {
  return amount.value !== 0 && description.value.trim().length > 0
})

watch(show, (val) => {
  if (val) {
    amount.value = 0
    description.value = ''
    category.value = DEFAULT_CATEGORY
    ownerTag.value = 'shared'
    saving.value = false
  }
})

async function onSave() {
  if (!isValid.value) return
  const familyId = familyStore.family?.id
  if (!familyId) return

  saving.value = true
  await addManualTransaction(familyId, {
    description: description.value.trim(),
    amount: amount.value,
    category: category.value,
    date: new Date(),
    ownerTag: ownerTag.value,
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
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('spendings.addTransaction') }}</h2>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl p-1" @click="show = false">✕</button>
        </div>

        <div class="space-y-4">
          <!-- Amount -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.amountIls') }}</label>
            <input
              v-model.number="amount"
              type="number"
              step="0.01"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              placeholder="0.00"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.description') }}</label>
            <input
              v-model="description"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              :placeholder="t('spendings.description')"
            />
          </div>

          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.category') }}</label>
            <select
              v-model="category"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            >
              <option v-for="catDef in effectiveCategories" :key="catDef.id" :value="catDef.id">
                {{ categoryDisplayName(catDef.id, locale, effectiveCategories, overrides) }}
              </option>
            </select>
          </div>

          <!-- Owner (segmented) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('spendings.owner') }}</label>
            <div class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm w-full">
              <button
                v-for="opt in [
                  { value: 'shared', label: familyStore.ownerTagNames.shared },
                  { value: 'userA', label: familyStore.ownerTagNames.userA ?? 'User A' },
                  { value: 'userB', label: familyStore.ownerTagNames.userB ?? 'User B' },
                ]"
                :key="opt.value"
                class="flex-1 px-3 py-2 transition-colors text-center"
                :class="ownerTag === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
                @click="ownerTag = opt.value"
              >{{ opt.label }}</button>
            </div>
          </div>
        </div>

        <!-- Save -->
        <button
          class="w-full mt-6 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!isValid || saving"
          @click="onSave"
        >{{ saving ? '...' : t('common.save') }}</button>
      </div>
    </div>
  </Teleport>
</template>
