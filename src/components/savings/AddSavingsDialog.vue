<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { upsertSavingsEntry } from '@/services/firestore'
import { LIQUID_ACCOUNT_TYPES, LOCKED_FUND_TYPES, liquidTypeDisplayName, lockedTypeDisplayName } from '@/composables/useCategories'
import type { SavingsType } from '@/types'

const { t } = useI18n()
const authStore = useAuthStore()
const prefsStore = usePreferencesStore()

const props = defineProps<{
  open: boolean
  initialType: SavingsType
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const savingsType = ref<SavingsType>('liquid')
const selectedChip = ref('')
const name = ref('')
const amount = ref('')
const firmName = ref('')
const liquidityDate = ref('')
const notes = ref('')
const saving = ref(false)
const error = ref('')

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    savingsType.value = props.initialType
    selectedChip.value = ''
    name.value = ''
    amount.value = ''
    firmName.value = ''
    liquidityDate.value = ''
    notes.value = ''
    error.value = ''
  }
})

const locale = computed(() => prefsStore.locale)

const chipOptions = computed(() => {
  if (savingsType.value === 'liquid') {
    return LIQUID_ACCOUNT_TYPES.map((k) => ({ key: k, label: liquidTypeDisplayName(k, locale.value) }))
  }
  return LOCKED_FUND_TYPES.map((k) => ({ key: k, label: lockedTypeDisplayName(k, locale.value) }))
})

function selectChip(key: string) {
  selectedChip.value = key
  name.value = savingsType.value === 'liquid'
    ? liquidTypeDisplayName(key, locale.value)
    : lockedTypeDisplayName(key, locale.value)
}

async function handleSave() {
  error.value = ''
  if (!name.value.trim()) { error.value = t('common.required'); return }
  const parsedAmount = parseFloat(amount.value)
  if (isNaN(parsedAmount)) { error.value = t('common.invalidNumber'); return }

  const familyId = authStore.familyId
  if (!familyId) return

  saving.value = true
  try {
    await upsertSavingsEntry(familyId, {
      name: name.value.trim(),
      amount: parsedAmount,
      savingsType: savingsType.value,
      firmName: firmName.value.trim() || undefined,
      liquidityDate: liquidityDate.value ? new Date(liquidityDate.value) : undefined,
      notes: notes.value.trim() || undefined,
    })
    emit('close')
  } catch (err) {
    error.value = String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {{ savingsType === 'liquid' ? t('savings.addLiquidAccount') : t('savings.addLockedFund') }}
        </h3>

        <!-- Segmented toggle -->
        <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 mb-4">
          <button
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="savingsType === 'liquid'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
            @click="savingsType = 'liquid'"
          >{{ t('savings.liquidLabel') }}</button>
          <button
            class="flex-1 py-2 text-sm font-medium transition-colors"
            :class="savingsType === 'locked'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
            @click="savingsType = 'locked'"
          >{{ t('savings.lockedLabel') }}</button>
        </div>

        <!-- Quick-select chips -->
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="chip in chipOptions"
            :key="chip.key"
            class="px-3 py-1 rounded-full text-sm border transition-colors"
            :class="selectedChip === chip.key
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="selectChip(chip.key)"
          >{{ chip.label }}</button>
        </div>

        <!-- Name -->
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('common.name') }} *</label>
          <input
            v-model="name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <!-- Amount -->
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('savings.amountIls') }} *</label>
          <input
            v-model="amount"
            type="number"
            step="0.01"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <!-- Firm -->
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('savings.companyBankOptional') }}</label>
          <input
            v-model="firmName"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <!-- Liquidity date (locked only) -->
        <div v-if="savingsType === 'locked'" class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('savings.liquidityDate') }}</label>
          <input
            v-model="liquidityDate"
            type="date"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <!-- Notes -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('savings.notes') }}</label>
          <textarea
            v-model="notes"
            rows="2"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 resize-none"
          />
        </div>

        <!-- Error -->
        <p v-if="error" class="text-red-500 text-sm mb-3">{{ error }}</p>

        <!-- Actions -->
        <div class="flex gap-3 justify-end">
          <button
            class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="emit('close')"
          >{{ t('common.cancel') }}</button>
          <button
            class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="saving"
            @click="handleSave"
          >{{ saving ? '...' : t('common.save') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
