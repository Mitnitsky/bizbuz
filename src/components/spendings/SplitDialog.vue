<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Transaction } from '@/types'
import { useFamilyStore } from '@/stores/family'
import { splitTransaction } from '@/services/firestore'
import { formatCurrency } from '@/composables/useFormatters'
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

const partAAmount = ref(0)
const partAOwner = ref('shared')
const partBOwner = ref('shared')
const saving = ref(false)

const totalAmount = computed(() => Math.abs(props.transaction?.chargedAmount ?? 0))
const partBAmount = computed(() => Math.max(0, +(totalAmount.value - partAAmount.value).toFixed(2)))

const isValid = computed(() => {
  return partAAmount.value > 0 && partBAmount.value > 0
})

watch(show, (val) => {
  if (val && props.transaction) {
    partAAmount.value = +(totalAmount.value / 2).toFixed(2)
    partAOwner.value = props.transaction.ownerTag
    partBOwner.value = props.transaction.ownerTag
    saving.value = false
  }
})

async function onConfirm() {
  if (!props.transaction || !isValid.value) return
  const familyId = familyStore.family?.id
  if (!familyId) return

  saving.value = true
  const sign = props.transaction.chargedAmount < 0 ? -1 : 1
  const desc = props.transaction.overrideDescription || props.transaction.description

  await splitTransaction(familyId, props.transaction.id, [
    {
      amount: +(partAAmount.value * sign).toFixed(2),
      category: props.transaction.category,
      description: desc,
      ownerTag: partAOwner.value,
    },
    {
      amount: +(partBAmount.value * sign).toFixed(2),
      category: props.transaction.category,
      description: desc,
      ownerTag: partBOwner.value,
    },
  ])

  saving.value = false
  show.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show && transaction"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="show = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-lg w-full mx-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ t('spendings.splitTransaction') }}</h2>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl p-1" @click="show = false">✕</button>
        </div>

        <!-- Total -->
        <div class="mb-6 text-center">
          <div class="text-sm text-gray-500 dark:text-gray-400">{{ t('spendings.totalAmount') }}</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{{ formatCurrency(totalAmount) }}</div>
        </div>

        <!-- Part A -->
        <div class="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('spendings.partA') }}</div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('spendings.amountIls') }}</label>
              <input
                v-model.number="partAAmount"
                type="number"
                step="0.01"
                min="0"
                :max="totalAmount"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('spendings.owner') }}</label>
              <select
                v-model="partAOwner"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="shared">{{ familyStore.ownerTagNames.shared }}</option>
                <option value="userA">{{ familyStore.ownerTagNames.userA ?? 'User A' }}</option>
                <option value="userB">{{ familyStore.ownerTagNames.userB ?? 'User B' }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Part B -->
        <div class="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('spendings.partB') }}</div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('spendings.amountIls') }}</label>
              <div class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {{ formatCurrency(partBAmount) }}
              </div>
            </div>
            <div class="flex-1">
              <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t('spendings.owner') }}</label>
              <select
                v-model="partBOwner"
                class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="shared">{{ familyStore.ownerTagNames.shared }}</option>
                <option value="userA">{{ familyStore.ownerTagNames.userA ?? 'User A' }}</option>
                <option value="userB">{{ familyStore.ownerTagNames.userB ?? 'User B' }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Confirm -->
        <button
          class="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!isValid || saving"
          @click="onConfirm"
        >{{ saving ? '...' : t('spendings.confirm') }}</button>
      </div>
    </div>
  </Teleport>
</template>
