<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFamilyStore } from '@/stores/family'
import { usePreferencesStore } from '@/stores/preferences'
import { useTransactionsStore } from '@/stores/transactions'
import { useSavingsStore } from '@/stores/savings'
import { updateDisplayName } from '@/services/firestore'
import { useI18n } from 'vue-i18n'
import GlassIcon from '@/components/GlassIcon.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useIcons } from '@/composables/useIcons'
import '@/composables/useAccentColor'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const familyStore = useFamilyStore()
const prefsStore = usePreferencesStore()
const txnStore = useTransactionsStore()
const savingsStore = useSavingsStore()
const { t, locale } = useI18n()
const { icon } = useIcons()

const sidebarExpanded = ref(true)
const isWide = ref(window.innerWidth >= 800)

const navItems = [
  { path: '/', name: 'home', iconName: 'home' as const, labelKey: 'nav.home' },
  { path: '/spendings', name: 'spendings', iconName: 'spendings' as const, labelKey: 'nav.spendings' },
  { path: '/installments', name: 'installments', iconName: 'installments' as const, labelKey: 'nav.installments' },
  { path: '/savings', name: 'savings', iconName: 'savings' as const, labelKey: 'nav.savings' },
  { path: '/investments', name: 'investments', iconName: 'investments' as const, labelKey: 'nav.investments' },
  { path: '/loans', name: 'loans', iconName: 'loans' as const, labelKey: 'nav.loans' },
  { path: '/statistics', name: 'statistics', iconName: 'statistics' as const, labelKey: 'nav.statistics' },
  { path: '/settings', name: 'settings', iconName: 'settings' as const, labelKey: 'nav.settings' },
]

// Mobile bottom bar: primary tabs from user preferences + "More" flyout
const DEFAULT_NAV_ORDER = ['home', 'spendings', 'statistics']
const MAX_PRIMARY_TABS = 4

const primaryTabs = computed(() => {
  const order = prefsStore.userPreferences?.navBarOrder?.length
    ? prefsStore.userPreferences.navBarOrder.slice(0, MAX_PRIMARY_TABS)
    : DEFAULT_NAV_ORDER
  return order
    .map(name => navItems.find(item => item.name === name))
    .filter((item): item is typeof navItems[number] => !!item)
})

const moreTabs = computed(() => {
  const primaryNames = new Set(primaryTabs.value.map(t => t.name))
  return navItems.filter(item => !primaryNames.has(item.name))
})

const moreMenuOpen = ref(false)
const isMoreActive = computed(() => moreTabs.value.some(t => route.path === t.path || route.path.startsWith(t.path + '/')))

const totalBottomTabs = computed(() => primaryTabs.value.length + 1) // +1 for More button
const activeBottomIndex = computed(() => {
  const idx = primaryTabs.value.findIndex(t => route.path === t.path)
  if (idx >= 0) return idx
  if (moreMenuOpen.value) return primaryTabs.value.length
  return -1
})

// Touch-drag to slide bubble across tabs
const bottomNavRef = ref<HTMLElement | null>(null)
const dragIndex = ref<number | null>(null)
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let isDragging = false
let startX = 0

function getTabIndexFromX(clientX: number): number {
  const nav = bottomNavRef.value
  if (!nav) return -1
  const rect = nav.getBoundingClientRect()
  const total = totalBottomTabs.value
  const isRtl = locale.value === 'he'
  const relX = clientX - rect.left
  const pct = relX / rect.width
  const rawIdx = Math.floor(pct * total)
  const clampedIdx = Math.max(0, Math.min(total - 1, rawIdx))
  return isRtl ? (total - 1 - clampedIdx) : clampedIdx
}

function onTouchStart(e: TouchEvent) {
  startX = e.touches[0].clientX
  const idx = getTabIndexFromX(startX)
  longPressTimer = setTimeout(() => {
    isDragging = true
    dragIndex.value = idx
  }, 300)
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging) {
    // Cancel long-press if finger moved too much before threshold
    const dx = Math.abs(e.touches[0].clientX - startX)
    if (dx > 10 && longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    return
  }
  e.preventDefault()
  dragIndex.value = getTabIndexFromX(e.touches[0].clientX)
}

function onTouchEnd() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  if (isDragging && dragIndex.value !== null) {
    const idx = dragIndex.value
    if (idx < primaryTabs.value.length) {
      router.push(primaryTabs.value[idx].path)
    } else {
      moreMenuOpen.value = !moreMenuOpen.value
    }
  }
  isDragging = false
  dragIndex.value = null
}

const bubbleDisplayIndex = computed(() => {
  if (dragIndex.value !== null) return dragIndex.value
  return activeBottomIndex.value
})

const bubbleStyle = computed(() => {
  const idx = bubbleDisplayIndex.value
  if (idx < 0) return { opacity: '0' }
  const total = totalBottomTabs.value
  const widthPct = 100 / total
  const isRtl = locale.value === 'he'
  const posIndex = isRtl ? (total - 1 - idx) : idx
  return {
    opacity: '1',
    width: `${widthPct}%`,
    left: '0',
    transform: `translateX(${posIndex * 100}%)`,
  }
})

const appState = computed<'loading' | 'login' | 'onboarding' | 'app'>(() => {
  if (authStore.loading) return 'loading'
  if (!authStore.isAuthenticated) return 'login'
  if (!authStore.familyId) return 'onboarding'
  return 'app'
})

// Theme management
function applyTheme(mode: string) {
  const html = document.documentElement
  if (mode === 'dark') {
    html.classList.add('dark')
  } else if (mode === 'light') {
    html.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    html.classList.toggle('dark', prefersDark)
  }
}

let mediaQuery: MediaQueryList | null = null

function onSystemThemeChange() {
  if (prefsStore.themeMode === 'system') {
    applyTheme('system')
  }
}

watch(() => prefsStore.themeMode, (mode) => {
  applyTheme(mode)
}, { immediate: true })

// RTL support
watch(locale, (loc) => {
  document.documentElement.dir = loc === 'he' ? 'rtl' : 'ltr'
  document.documentElement.lang = loc === 'he' ? 'he' : 'en'
}, { immediate: true })

// Responsive handling
function onResize() {
  isWide.value = window.innerWidth >= 800
}

// Bind stores when familyId is available
watch(() => authStore.familyId, (familyId) => {
  if (familyId && authStore.user) {
    familyStore.bindFamily(familyId)
    prefsStore.bindPreferences(familyId, authStore.user.uid)
    txnStore.bindTransactions(familyId)
    savingsStore.bindSavings(familyId)

    // Self-heal: ensure current user's display name is on the family doc
    const uid = authStore.user.uid
    const name = authStore.appUser?.displayName || authStore.appUser?.email?.split('@')[0]
    if (name) {
      setTimeout(() => {
        const existing = familyStore.family?.memberDisplayNames[uid]
        if (!existing || existing === uid.slice(0, 8)) {
          updateDisplayName(uid, familyId, name).catch(() => {})
        }
      }, 2000)
    }
  } else {
    familyStore.unbind()
    prefsStore.unbind()
    txnStore.unbind()
    savingsStore.unbind()
  }
}, { immediate: true })

// Route to appropriate view based on app state
watch(appState, (state) => {
  if (state === 'login' && route.path !== '/login') {
    router.replace('/login')
  } else if (state === 'onboarding' && route.path !== '/onboarding') {
    router.replace('/onboarding')
  } else if (state === 'app' && (route.path === '/login' || route.path === '/onboarding')) {
    router.replace('/')
  }
})

onMounted(async () => {
  await authStore.initAuth()
  window.addEventListener('resize', onResize)
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onSystemThemeChange)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  mediaQuery?.removeEventListener('change', onSystemThemeChange)
})
</script>

<template>
  <!-- Loading spinner -->
  <div v-if="appState === 'loading'" class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <GlassIcon glass size="xl" class="mx-auto mb-4">
        <template #default="{ iconClass }"><component :is="icon('loader')" :class="[iconClass, 'animate-spin text-purple-500']" /></template>
      </GlassIcon>
      <div class="animate-pulse text-gray-500 dark:text-gray-400">Loading...</div>
    </div>
  </div>

  <!-- Login / Onboarding — no shell -->
  <router-view v-else-if="appState === 'login' || appState === 'onboarding'" />

  <!-- Main App Shell -->
  <div v-else class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar (wide screens) -->
    <aside
      v-if="isWide"
      class="flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 shrink-0"
      :class="sidebarExpanded ? 'w-56' : 'w-16'"
    >
      <!-- App branding -->
      <div class="flex items-center gap-2 px-4 pt-4 pb-2">
        <img src="/icon.svg" alt="BizBuz" class="w-8 h-8" />
        <span v-if="sidebarExpanded" class="text-lg font-bold text-purple-600 dark:text-purple-400">BizBuz</span>
      </div>

      <button
        @click="sidebarExpanded = !sidebarExpanded"
        class="p-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 self-end"
      >
        <component :is="sidebarExpanded ? icon('chevronLeft') : icon('chevronRight')" class="h-5 w-5" />
      </button>

      <nav class="flex-1 flex flex-col gap-1 px-2">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :class="{ 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium': route.path === item.path }"
        >
          <GlassIcon glass size="sm" :active="route.path === item.path">
            <template #default="{ iconClass }"><component :is="icon(item.iconName)" :class="iconClass" /></template>
          </GlassIcon>
          <span v-if="sidebarExpanded" class="text-sm truncate">{{ t(item.labelKey) }}</span>
        </router-link>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="flex flex-col flex-1 min-w-0 min-h-0" :class="{ 'pb-20': !isWide }">
      <router-view class="flex-1 min-h-0 overflow-y-auto" />
    </main>

    <!-- Bottom tab bar (narrow screens) -->
    <nav
      v-if="!isWide"
      ref="bottomNavRef"
      class="fixed bottom-3 left-3 right-3 bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl rounded-full shadow-lg shadow-black/10 dark:shadow-black/30 border border-white/40 dark:border-gray-600/30 flex z-50 px-1 py-1 overflow-hidden"
      style="backdrop-filter: blur(40px) saturate(180%);"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
    >
      <!-- Sliding bubble indicator -->
      <div
        class="absolute top-1 bottom-1 rounded-full bg-purple-500/20 dark:bg-purple-400/25 backdrop-blur-sm transition-all duration-300 ease-in-out pointer-events-none border border-purple-500/15 dark:border-purple-400/15"
        :style="bubbleStyle"
      />

      <router-link
        v-for="item in primaryTabs"
        :key="item.path"
        :to="item.path"
        class="flex-1 flex flex-col items-center py-2 text-gray-500 dark:text-gray-400 transition-colors relative z-10"
        :class="{ 'text-purple-600 dark:text-purple-400': route.path === item.path }"
        @click="moreMenuOpen = false"
      >
        <component :is="icon(item.iconName)" class="w-6 h-6" />
        <span class="text-[10px] mt-0.5 font-medium">{{ t(item.labelKey) }}</span>
      </router-link>

      <!-- More button -->
      <button
        class="flex-1 flex flex-col items-center py-2 text-gray-500 dark:text-gray-400 transition-colors relative z-10"
        :class="{ 'text-purple-600 dark:text-purple-400': isMoreActive || moreMenuOpen }"
        @click="moreMenuOpen = !moreMenuOpen"
      >
        <component :is="icon('more')" class="w-6 h-6" />
        <span class="text-[10px] mt-0.5 font-medium">{{ t('nav.more') }}</span>
      </button>
    </nav>

    <!-- More flyout menu -->
    <Teleport to="body">
      <div v-if="moreMenuOpen && !isWide" class="fixed inset-0 z-40" @click="moreMenuOpen = false">
        <div
          class="absolute bottom-20 right-2 left-2 glass-flyout rounded-xl shadow-xl p-2"
          @click.stop
        >
          <router-link
            v-for="item in moreTabs"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
            :class="{ 'bg-purple-50/80 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium': route.path === item.path || route.path.startsWith(item.path + '/') }"
            @click="moreMenuOpen = false"
          >
            <GlassIcon glass size="sm" :active="route.path === item.path || route.path.startsWith(item.path + '/')">
              <template #default="{ iconClass }"><component :is="icon(item.iconName)" :class="iconClass" /></template>
            </GlassIcon>
            <span class="text-sm">{{ t(item.labelKey) }}</span>
          </router-link>
        </div>
      </div>
    </Teleport>
  </div>
  <ConfirmDialog />
</template>

<style scoped>
.glass-flyout {
  background: linear-gradient(135deg, rgba(255,255,255,0.75), rgba(255,255,255,0.55));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4);
}
:root.dark .glass-flyout {
  background: linear-gradient(135deg, rgba(31,41,55,0.85), rgba(31,41,55,0.7));
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}
</style>