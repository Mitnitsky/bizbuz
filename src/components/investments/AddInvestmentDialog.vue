<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { addInvestment, updateInvestment, deleteInvestment, updateInvestmentTracker } from '@/services/firestore'
import { useConfirm } from '@/composables/useConfirm'
import type { InvestmentItem } from '@/components/investments/InvestmentCard.vue'
import type { TrackerType } from '@/types'

const { t } = useI18n()
const authStore = useAuthStore()
const { confirm } = useConfirm()

const props = defineProps<{
  open: boolean
  investment?: InvestmentItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isEdit = ref(false)
const name = ref('')
const investedAmount = ref('')
const currentValue = ref('')
const saving = ref(false)
const error = ref('')

const trackerType = ref<TrackerType | null>(null)
const trackerDate = ref('')
const trackerIntervalDays = ref<number>(30)

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  error.value = ''
  if (props.investment) {
    isEdit.value = true
    name.value = props.investment.name
    investedAmount.value = String(props.investment.investedAmount)
    currentValue.value = String(props.investment.currentValue)
    trackerType.value = props.investment.trackerType ?? null
    trackerDate.value = props.investment.trackerDate ? formatDateInput(props.investment.trackerDate) : ''
    trackerIntervalDays.value = props.investment.trackerIntervalDays ?? 30
  } else {
    isEdit.value = false
    name.value = ''
    investedAmount.value = ''
    currentValue.value = ''
    trackerType.value = null
    trackerDate.value = ''
    trackerIntervalDays.value = 30
  }
})

async function handleSave() {
  error.value = ''
  if (!name.value.trim()) { error.value = t('common.required'); return }
  const invested = parseFloat(investedAmount.value)
  const current = parseFloat(currentValue.value)
  if (isNaN(invested) || isNaN(current)) { error.value = t('common.invalidNumber'); return }

  const familyId = authStore.familyId
  if (!familyId) return

  saving.value = true
  try {
    if (isEdit.value && props.investment) {
      await updateInvestment(familyId, props.investment.id, name.value.trim(), invested, current)
      await updateInvestmentTracker(
        familyId,
        props.investment.id,
        trackerType.value,
        trackerType.value === 'once' && trackerDate.value ? new Date(trackerDate.value) : null,
        trackerType.value === 'interval' ? trackerIntervalDays.value : null,
      )
    } else {
      await addInvestment(familyId, name.value.trim(), invested, current)
    }
    emit('close')
  } catch (err) {
    error.value = String(err)
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  const familyId = authStore.familyId
  if (!familyId || !props.investment) return
  if (!(await confirm(t('common.confirmDelete')))) return
  await deleteInvestment(familyId, props.investment.id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-gray-300 mb-4">{{ isEdit ? t('common.edit') : t('investments.addInvestment') }}</h3>

        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('common.name') }} *</label>
          <input
            v-model="name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2"
          />
        </div>

        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('investments.amountInvestedIls') }} *</label>
          <input
            v-model="investedAmount"
            type="number"
            step="0.01"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('investments.currentValueIls') }} *</label>
          <input
            v-model="currentValue"
            type="number"
            step="0.01"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2"
          />
        </div>

        <!-- Tracker / Notification -->
        <div v-if="isEdit" class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('tracker.reminder') }}</label>
          <div class="flex gap-2 mb-2">
            <button
              class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
              :class="trackerType === null ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'"
              @click="trackerType = null"
            >{{ t('tracker.none') }}</button>
            <button
              class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
              :class="trackerType === 'once' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'"
              @click="trackerType = 'once'"
            >{{ t('tracker.once') }}</button>
            <button
              class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
              :class="trackerType === 'interval' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'"
              @click="trackerType = 'interval'"
            >{{ t('tracker.interval') }}</button>
          </div>
          <div v-if="trackerType === 'once'" class="mb-2">
            <input v-model="trackerDate" type="date" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm" />
          </div>
          <div v-if="trackerType === 'interval'" class="flex items-center gap-2 mb-2">
            <input v-model.number="trackerIntervalDays" type="number" min="1" class="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-300 px-3 py-2 text-sm" />
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('tracker.days') }}</span>
          </div>
        </div>

        <p v-if="error" class="text-red-500 text-sm mb-3">{{ error }}</p>

        <div class="flex gap-3 justify-between">
          <button
            v-if="isEdit"
            class="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            @click="handleDelete"
          >{{ t('common.delete') }}</button>
          <div v-else />
          <div class="flex gap-3">
            <button
              class="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="emit('close')"
            >{{ t('common.cancel') }}</button>
            <button
              class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              :disabled="saving"
              @click="handleSave"
            >{{ saving ? '...' : t('common.save') }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
