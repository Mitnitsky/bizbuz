<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInsightsStore } from '@/stores/insights'
import { useUiStore } from '@/stores/ui'
import type { Insight, InsightSeverity } from '@/types'
import { formatDistanceToNowStrict } from 'date-fns'
import { he, enUS } from 'date-fns/locale'

const { t, locale } = useI18n()
const insightsStore = useInsightsStore()
const uiStore = useUiStore()

// Only show on current cycle (offset === 0). Daily generation targets the active cycle only.
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

function trackBy(insight: Insight, idx: number) {
  return insight.id || `${insight.title}-${idx}`
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
        :class="['rounded-lg border px-3 py-2.5', severityClass[safeSeverity(insight.severity)]]"
      >
        <div class="flex items-start gap-2">
          <span class="text-lg leading-tight shrink-0" aria-hidden="true">{{ insight.icon }}</span>
          <div class="flex-1 min-w-0">
            <div :class="['text-sm font-semibold leading-snug', titleClass[safeSeverity(insight.severity)]]">{{ insight.title }}</div>
            <div :class="['text-xs leading-snug mt-0.5', bodyClass[safeSeverity(insight.severity)]]">{{ insight.body }}</div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
