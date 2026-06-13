<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInsightsStore } from '@/stores/insights'
import { useUiStore } from '@/stores/ui'
import { useFamilyStore } from '@/stores/family'
import type { Insight, InsightSeverity, LocalizedText } from '@/types'
import { formatDistanceToNowStrict } from 'date-fns'
import { he, enUS } from 'date-fns/locale'
import { dismissInsight as dismissInsightFs } from '@/services/firestore'
import { computeCycleRange, cycleKey } from '@/composables/useBillingCycle'
import { startOfDay } from 'date-fns'

const { t, locale } = useI18n()
const insightsStore = useInsightsStore()
const uiStore = useUiStore()
const familyStore = useFamilyStore()

const onCurrentCycle = computed(() => uiStore.cycleOffset === 0)

const visible = computed(() => onCurrentCycle.value && insightsStore.hasInsights)

const generatedLabel = computed(() => {
  const at = insightsStore.generatedAt
  if (!at) return ''
  const dateLocale = locale.value === 'he' ? he : enUS
  const rel = formatDistanceToNowStrict(at, { addSuffix: true, locale: dateLocale })
  return t('insights.generatedAt', { rel })
})

const severityClass: Record<InsightSeverity, string> = {
  alert: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-100',
  warn: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100',
  good: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-100',
  info: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-900 dark:text-slate-100',
}

const titleClass: Record<InsightSeverity, string> = {
  alert: 'text-rose-800 dark:text-rose-200',
  warn: 'text-amber-800 dark:text-amber-200',
  good: 'text-emerald-800 dark:text-emerald-200',
  info: 'text-slate-700 dark:text-slate-200',
}

const bodyClass: Record<InsightSeverity, string> = {
  alert: 'text-rose-700/90 dark:text-rose-300/80',
  warn: 'text-amber-700/90 dark:text-amber-300/80',
  good: 'text-emerald-700/90 dark:text-emerald-300/80',
  info: 'text-slate-600 dark:text-slate-300/80',
}

function safeSeverity(s: string): InsightSeverity {
  return (['alert', 'warn', 'good', 'info'] as InsightSeverity[]).includes(s as InsightSeverity)
    ? s as InsightSeverity
    : 'info'
}

/** Renders bilingual text picking current locale; falls back to the other language or empty. */
function localized(text: LocalizedText | string | undefined): string {
  if (!text) return ''
  if (typeof text === 'string') return text // legacy doc shape
  return (text[locale.value as 'he' | 'en']) || text.he || text.en || ''
}

function trackBy(insight: Insight, idx: number) {
  return insight.id || `${localized(insight.title)}-${idx}`
}

async function onDismiss(insight: Insight) {
  if (!familyStore.familyId || !insight.id) return
  const today = startOfDay(new Date())
  const range = computeCycleRange(today, familyStore.familySettings.cycleStartDay, 0)
  const key = cycleKey(range.start)
  try {
    await dismissInsightFs(familyStore.familyId, key, insight.id)
  } catch (e) {
    console.error('[InsightsTile] dismiss failed', e)
  }
}
</script>

<template>
  <div v-if="visible" class="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xl">✨</span>
      <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ t('insights.title') }}</h2>
      <span v-if="generatedLabel" class="text-xs text-gray-400 dark:text-gray-500 ms-auto">{{ generatedLabel }}</span>
    </div>

    <ul class="space-y-2">
      <li
        v-for="(insight, idx) in insightsStore.insights"
        :key="trackBy(insight, idx)"
        :class="['rounded-lg border px-3 py-2.5 relative group', severityClass[safeSeverity(insight.severity)]]"
      >
        <div class="flex items-start gap-2">
          <span class="text-lg leading-tight shrink-0" aria-hidden="true">{{ insight.icon }}</span>
          <div class="flex-1 min-w-0">
            <div :class="['text-sm font-semibold leading-snug pe-6', titleClass[safeSeverity(insight.severity)]]">{{ localized(insight.title) }}</div>
            <div :class="['text-xs leading-snug mt-0.5', bodyClass[safeSeverity(insight.severity)]]">{{ localized(insight.body) }}</div>
          </div>
          <button
            type="button"
            class="absolute top-1.5 end-1.5 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            :aria-label="t('insights.dismiss')"
            :title="t('insights.dismiss')"
            @click="onDismiss(insight)"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.7 3.7a1 1 0 0 1 1.4 0L8 6.6l2.9-2.9a1 1 0 1 1 1.4 1.4L9.4 8l2.9 2.9a1 1 0 0 1-1.4 1.4L8 9.4l-2.9 2.9a1 1 0 0 1-1.4-1.4L6.6 8 3.7 5.1a1 1 0 0 1 0-1.4Z"/>
            </svg>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
