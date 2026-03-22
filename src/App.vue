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

// Mobile bottom bar: 4 primary tabs + "More" flyout
const primaryTabs = [
  { path: '/', name: 'home', iconName: 'home' as const, labelKey: 'nav.home' },
  { path: '/spendings', name: 'spendings', iconName: 'spendings' as const, labelKey: 'nav.spendings' },
  { path: '/statistics', name: 'statistics', iconName: 'statistics' as const, labelKey: 'nav.statistics' },
]
const moreTabs = [
  { path: '/installments', name: 'installments', iconName: 'installments' as const, labelKey: 'nav.installments' },
  { path: '/savings', name: 'savings', iconName: 'savings' as const, labelKey: 'nav.savings' },
  { path: '/investments', name: 'investments', iconName: 'investments' as const, labelKey: 'nav.investments' },
  { path: '/loans', name: 'loans', iconName: 'loans' as const, labelKey: 'nav.loans' },
  { path: '/settings', name: 'settings', iconName: 'settings' as const, labelKey: 'nav.settings' },
]
const moreMenuOpen = ref(false)
const isMoreActive = computed(() => moreTabs.some(t => route.path === t.path || route.path.startsWith(t.path + '/')))

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
  <div v-else class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sidebar (wide screens) -->
    <aside
      v-if="isWide"
      class="flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 shrink-0"
      :class="sidebarExpanded ? 'w-56' : 'w-16'"
    >
      <button
        @click="sidebarExpanded = !sidebarExpanded"
        class="p-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 self-end"
      >
        <component :is="icon('menu')" class="h-5 w-5" />
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
    <main class="flex-1 min-w-0" :class="{ 'pb-16': !isWide }">
      <router-view />
    </main>

    <!-- Bottom tab bar (narrow screens) -->
    <nav
      v-if="!isWide"
      class="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 flex z-50"
    >
      <router-link
        v-for="item in primaryTabs"
        :key="item.path"
        :to="item.path"
        class="flex-1 flex flex-col items-center py-2 text-gray-500 dark:text-gray-400"
        :class="{ 'text-purple-600 dark:text-purple-400': route.path === item.path }"
        @click="moreMenuOpen = false"
      >
        <GlassIcon glass size="xs" :active="route.path === item.path">
          <template #default="{ iconClass }"><component :is="icon(item.iconName)" :class="iconClass" /></template>
        </GlassIcon>
        <span class="text-[10px] mt-0.5">{{ t(item.labelKey) }}</span>
      </router-link>

      <!-- More button -->
      <button
        class="flex-1 flex flex-col items-center py-2 text-gray-500 dark:text-gray-400"
        :class="{ 'text-purple-600 dark:text-purple-400': isMoreActive || moreMenuOpen }"
        @click="moreMenuOpen = !moreMenuOpen"
      >
        <GlassIcon glass size="xs" :active="isMoreActive || moreMenuOpen">
          <template #default="{ iconClass }"><component :is="icon('more')" :class="iconClass" /></template>
        </GlassIcon>
        <span class="text-[10px] mt-0.5">{{ t('nav.more') }}</span>
      </button>
    </nav>

    <!-- More flyout menu -->
    <Teleport to="body">
      <div v-if="moreMenuOpen && !isWide" class="fixed inset-0 z-40" @click="moreMenuOpen = false">
        <div
          class="absolute bottom-16 right-2 left-2 glass-flyout rounded-xl shadow-xl p-2"
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