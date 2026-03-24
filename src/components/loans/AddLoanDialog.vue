<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { addLoan, updateLoan, deleteLoan, updateLoanTracker } from '@/services/firestore'
import { useConfirm } from '@/composables/useConfirm'
import type { LoanItem } from '@/components/loans/LoanCard.vue'
import type { TrackerType, MortgageTrack, IndexLink, RateType, PaymentMethod } from '@/types'

const { t } = useI18n()
const authStore = useAuthStore()
const { confirm } = useConfirm()

const props = defineProps<{
  open: boolean
  loan?: LoanItem | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isEdit = ref(false)
const name = ref('')
const principal = ref('')
const remaining = ref('')
const endDate = ref('')
const saving = ref(false)
const error = ref('')

const trackerType = ref<TrackerType | null>(null)
const trackerDate = ref('')
const trackerIntervalDays = ref<number>(30)

interface TrackForm {
  id: string
  name: string
  amount: string
  remaining: string
  interestRate: string
  indexLink: IndexLink
  rateType: RateType
  variableIntervalYears: string
  paymentMethod: PaymentMethod
  termMonths: string
  monthlyPayment: string
  expanded: boolean
}

const tracks = ref<TrackForm[]>([])

function createEmptyTrack(index: number): TrackForm {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + index,
    name: `מסלול ${index}`,
    amount: '',
    remaining: '',
    interestRate: '',
    indexLink: 'notLinked',
    rateType: 'fixed',
    variableIntervalYears: '5',
    paymentMethod: 'spitzer',
    termMonths: '',
    monthlyPayment: '',
    expanded: true,
  }
}

function addTrack() {
  tracks.value.push(createEmptyTrack(tracks.value.length + 1))
}

function removeTrack(index: number) {
  tracks.value.splice(index, 1)
}

function trackFromForm(tf: TrackForm): MortgageTrack {
  const track: MortgageTrack = {
    id: tf.id,
    name: tf.name,
    amount: parseFloat(tf.amount) || 0,
    remaining: parseFloat(tf.remaining) || 0,
    interestRate: parseFloat(tf.interestRate) || 0,
    indexLink: tf.indexLink,
    rateType: tf.rateType,
    paymentMethod: tf.paymentMethod,
    termMonths: parseInt(tf.termMonths) || 0,
  }
  if (tf.rateType === 'variable' && tf.variableIntervalYears) {
    track.variableIntervalYears = parseInt(tf.variableIntervalYears) || undefined
  }
  if (tf.monthlyPayment) {
    track.monthlyPayment = parseFloat(tf.monthlyPayment) || undefined
  }
  return track
}

function trackToForm(mt: MortgageTrack): TrackForm {
  return {
    id: mt.id,
    name: mt.name,
    amount: String(mt.amount),
    remaining: String(mt.remaining),
    interestRate: String(mt.interestRate),
    indexLink: mt.indexLink,
    rateType: mt.rateType,
    variableIntervalYears: mt.variableIntervalYears != null ? String(mt.variableIntervalYears) : '5',
    paymentMethod: mt.paymentMethod,
    termMonths: String(mt.termMonths),
    monthlyPayment: mt.monthlyPayment != null ? String(mt.monthlyPayment) : '',
    expanded: false,
  }
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

watch(() => props.open, (val) => {
  if (!val) return
  if (props.loan) {
    isEdit.value = true
    name.value = props.loan.name
    principal.value = String(props.loan.principal)
    remaining.value = String(props.loan.remaining)
    endDate.value = props.loan.endDate ? formatDateInput(props.loan.endDate) : ''
    trackerType.value = props.loan.trackerType ?? null
    trackerDate.value = props.loan.trackerDate ? formatDateInput(props.loan.trackerDate) : ''
    trackerIntervalDays.value = props.loan.trackerIntervalDays ?? 30
    tracks.value = props.loan.tracks?.map(trackToForm) ?? []
  } else {
    isEdit.value = false
    name.value = ''
    principal.value = ''
    remaining.value = ''
    endDate.value = ''
    trackerType.value = null
    trackerDate.value = ''
    trackerIntervalDays.value = 30
    tracks.value = []
  }
  error.value = ''
})

async function handleSave() {
  error.value = ''
  if (!name.value.trim()) { error.value = t('common.required'); return }
  const p = parseFloat(principal.value)
  const r = parseFloat(remaining.value)
  if (isNaN(p) || isNaN(r)) { error.value = t('common.invalidNumber'); return }

  const familyId = authStore.familyId
  if (!familyId) return

  const serializedTracks = tracks.value.map(trackFromForm)

  saving.value = true
  try {
    if (isEdit.value && props.loan) {
      await updateLoan(familyId, props.loan.id, {
        name: name.value.trim(),
        principal: p,
        remaining: r,
        endDate: endDate.value ? new Date(endDate.value) : null,
        tracks: serializedTracks,
      })
      await updateLoanTracker(
        familyId,
        props.loan.id,
        trackerType.value,
        trackerType.value === 'once' && trackerDate.value ? new Date(trackerDate.value) : null,
        trackerType.value === 'interval' ? trackerIntervalDays.value : null,
      )
    } else {
      await addLoan(familyId, name.value.trim(), p, r, endDate.value ? new Date(endDate.value) : null, serializedTracks.length > 0 ? serializedTracks : undefined)
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
  if (!familyId || !props.loan) return
  if (!(await confirm(t('common.confirmDelete')))) return
  await deleteLoan(familyId, props.loan.id)
  emit('close')
}

const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2'
const inputClassSm = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2.5 py-1.5 text-sm'
const pillActive = 'bg-purple-600 text-white border-purple-600'
const pillInactive = 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 flex flex-col" style="max-height: 90vh;">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4 shrink-0">{{ isEdit ? t('loans.editLoan') : t('loans.addLoanMortgage') }}</h3>

        <div class="overflow-y-auto flex-1" style="max-height: 60vh;">
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('common.name') }} *</label>
            <input
              v-model="name"
              type="text"
              :class="inputClass"
            />
          </div>

          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('loans.originalAmountIls') }} *</label>
            <input
              v-model="principal"
              type="number"
              step="0.01"
              :class="inputClass"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('loans.remainingAmountIls') }} *</label>
            <input
              v-model="remaining"
              type="number"
              step="0.01"
              :class="inputClass"
            />
          </div>

          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('loans.endDate') }}</label>
            <input
              v-model="endDate"
              type="date"
              :class="inputClass"
            />
          </div>

          <!-- Mortgage Tracks Section -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
            <div class="flex items-center justify-between mb-3">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span>📊</span>
                <span>{{ t('loans.tracks') }}</span>
              </label>
              <button
                type="button"
                class="text-xs px-3 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                @click="addTrack"
              >+ {{ t('loans.addTrack') }}</button>
            </div>

            <div v-for="(track, idx) in tracks" :key="track.id" class="mb-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
              <!-- Track header -->
              <div
                class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 cursor-pointer"
                @click="track.expanded = !track.expanded"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400">{{ track.expanded ? '▼' : '▶' }}</span>
                  <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ track.name || `מסלול ${idx + 1}` }}</span>
                  <span v-if="track.amount" class="text-xs text-gray-500 dark:text-gray-400">₪{{ track.amount }}</span>
                </div>
                <button
                  type="button"
                  class="text-red-500 hover:text-red-700 text-sm p-1"
                  @click.stop="removeTrack(idx)"
                >🗑️</button>
              </div>

              <!-- Track body -->
              <div v-if="track.expanded" class="p-3 space-y-2.5">
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{{ t('loans.trackName') }}</label>
                  <input v-model="track.name" type="text" :class="inputClassSm" />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{{ t('loans.amount') }}</label>
                    <input v-model="track.amount" type="number" step="0.01" :class="inputClassSm" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{{ t('loans.remaining') }}</label>
                    <input v-model="track.remaining" type="number" step="0.01" :class="inputClassSm" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{{ t('loans.interestRate') }}</label>
                    <input v-model="track.interestRate" type="number" step="0.01" :class="inputClassSm" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{{ t('loans.termMonths') }}</label>
                    <input v-model="track.termMonths" type="number" min="1" :class="inputClassSm" />
                  </div>
                </div>

                <!-- CPI link toggle -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('loans.cpiLinked') }} / {{ t('loans.notLinked') }}</label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                      :class="track.indexLink === 'cpiLinked' ? pillActive : pillInactive"
                      @click="track.indexLink = 'cpiLinked'"
                    >{{ t('loans.cpiLinked') }}</button>
                    <button
                      type="button"
                      class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                      :class="track.indexLink === 'notLinked' ? pillActive : pillInactive"
                      @click="track.indexLink = 'notLinked'"
                    >{{ t('loans.notLinked') }}</button>
                  </div>
                </div>

                <!-- Rate type toggle -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('loans.fixedRate') }} / {{ t('loans.variableRate') }}</label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                      :class="track.rateType === 'fixed' ? pillActive : pillInactive"
                      @click="track.rateType = 'fixed'"
                    >{{ t('loans.fixedRate') }}</button>
                    <button
                      type="button"
                      class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                      :class="track.rateType === 'variable' ? pillActive : pillInactive"
                      @click="track.rateType = 'variable'"
                    >{{ t('loans.variableRate') }}</button>
                  </div>
                </div>

                <!-- Variable interval -->
                <div v-if="track.rateType === 'variable'" class="flex items-center gap-2">
                  <label class="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ t('loans.variableInterval') }}</label>
                  <input v-model="track.variableIntervalYears" type="number" min="1" class="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 text-sm" />
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('loans.years') }}</span>
                </div>

                <!-- Payment method toggle -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('loans.spitzer') }} / {{ t('loans.equalPrincipal') }}</label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                      :class="track.paymentMethod === 'spitzer' ? pillActive : pillInactive"
                      @click="track.paymentMethod = 'spitzer'"
                    >{{ t('loans.spitzer') }}</button>
                    <button
                      type="button"
                      class="flex-1 py-1.5 text-xs rounded-lg border transition-colors"
                      :class="track.paymentMethod === 'equalPrincipal' ? pillActive : pillInactive"
                      @click="track.paymentMethod = 'equalPrincipal'"
                    >{{ t('loans.equalPrincipal') }}</button>
                  </div>
                </div>

                <!-- Monthly payment (optional) -->
                <div>
                  <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">{{ t('loans.monthlyPayment') }}</label>
                  <input v-model="track.monthlyPayment" type="number" step="0.01" :class="inputClassSm" />
                </div>
              </div>
            </div>
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
              <input v-model="trackerDate" type="date" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm" />
            </div>
            <div v-if="trackerType === 'interval'" class="flex items-center gap-2 mb-2">
              <input v-model.number="trackerIntervalDays" type="number" min="1" class="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm" />
              <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('tracker.days') }}</span>
            </div>
          </div>
        </div>

        <p v-if="error" class="text-red-500 text-sm mb-3 mt-3 shrink-0">{{ error }}</p>

        <div class="flex gap-3 justify-between mt-4 shrink-0">
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
