<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { addLoan } from '@/services/firestore'

const { t } = useI18n()
const authStore = useAuthStore()

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const name = ref('')
const principal = ref('')
const remaining = ref('')
const saving = ref(false)
const error = ref('')

function resetForm() {
  name.value = ''
  principal.value = ''
  remaining.value = ''
  error.value = ''
}

async function handleSave() {
  error.value = ''
  if (!name.value.trim()) { error.value = t('common.required'); return }
  const p = parseFloat(principal.value)
  const r = parseFloat(remaining.value)
  if (isNaN(p) || isNaN(r)) { error.value = t('common.invalidNumber'); return }

  const familyId = authStore.familyId
  if (!familyId) return

  saving.value = true
  try {
    await addLoan(familyId, name.value.trim(), p, r)
    resetForm()
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
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{{ t('loans.addLoanMortgage') }}</h3>

        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('common.name') }} *</label>
          <input
            v-model="name"
            type="text"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('loans.originalAmountIls') }} *</label>
          <input
            v-model="principal"
            type="number"
            step="0.01"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('loans.remainingAmountIls') }} *</label>
          <input
            v-model="remaining"
            type="number"
            step="0.01"
            class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
          />
        </div>

        <p v-if="error" class="text-red-500 text-sm mb-3">{{ error }}</p>

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
