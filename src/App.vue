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
const activeMoreItem = computed(() => moreTabs.value.find(t => route.path === t.path || route.path.startsWith(t.path + '/')))

const totalBottomTabs = computed(() => primaryTabs.value.length + 1) // +1 for More button
const activeBottomIndex = computed(() => {
  const idx = primaryTabs.value.findIndex(t => route.path === t.path)
  if (idx >= 0) return idx
  // Show bubble on More slot when a more-item is active
  if (isMoreActive.value) return primaryTabs.value.length
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
  const isRtl = locale.value === 'he'
  const posIndex = isRtl ? (total - 1 - idx) : idx
  // Account for nav px-2 (0.5rem) padding on each side
  const pad = 0.375 // rem (px-1.5)
  return {
    opacity: '1',
    width: `calc((100% - ${pad * 2}rem) / ${total})`,
    left: `calc(${pad}rem + (100% - ${pad * 2}rem) * ${posIndex} / ${total})`,
    transform: 'none',
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

// Pull-to-refresh for standalone PWA (no refresh button in Safari webapp)
const isStandalone = ref(
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true
)
const pullDistance = ref(0)
const isRefreshing = ref(false)
const PULL_THRESHOLD = 80
let pullStartY = 0
let isPulling = false

function onPullStart(e: TouchEvent) {
  if (!isStandalone.value || isRefreshing.value) return
  const scrollEl = document.querySelector('main .overflow-y-auto') as HTMLElement | null
  if (scrollEl && scrollEl.scrollTop > 0) return
  pullStartY = e.touches[0].clientY
  isPulling = true
}

function onPullMove(e: TouchEvent) {
  if (!isPulling) return
  const dy = e.touches[0].clientY - pullStartY
  if (dy < 0) { pullDistance.value = 0; return }
  pullDistance.value = Math.min(dy * 0.5, 120)
  if (pullDistance.value > 10) e.preventDefault()
}

function onPullEnd() {
  if (!isPulling) return
  isPulling = false
  if (pullDistance.value >= PULL_THRESHOLD) {
    isRefreshing.value = true
    pullDistance.value = 50
    setTimeout(() => { window.location.reload() }, 300)
  } else {
    pullDistance.value = 0
  }
}

onMounted(async () => {
  await authStore.initAuth()
  window.addEventListener('resize', onResize)
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onSystemThemeChange)
  if (isStandalone.value) {
    document.addEventListener('touchstart', onPullStart, { passive: true })
    document.addEventListener('touchmove', onPullMove, { passive: false })
    document.addEventListener('touchend', onPullEnd, { passive: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  mediaQuery?.removeEventListener('change', onSystemThemeChange)
  if (isStandalone.value) {
    document.removeEventListener('touchstart', onPullStart)
    document.removeEventListener('touchmove', onPullMove)
    document.removeEventListener('touchend', onPullEnd)
  }
})

// --- Particle shatter animation for More icon morph ---
const particleContainer = ref<HTMLElement | null>(null)

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number
  opacity: number
  color: string
  gravity: number
}

function getAccentColors(): string[] {
  const s = getComputedStyle(document.documentElement)
  const isDark = document.documentElement.classList.contains('dark')
  const c400 = s.getPropertyValue('--color-purple-400').trim()
  const c500 = s.getPropertyValue('--color-purple-500').trim()
  const c600 = s.getPropertyValue('--color-purple-600').trim()
  const c200 = s.getPropertyValue('--color-purple-200').trim()
  const c800 = s.getPropertyValue('--color-purple-800').trim()
  // Use oklch values if present, fallback to purple hex
  const fallback = ['#a855f7', '#7c3aed', '#c084fc', isDark ? '#e9d5ff' : '#6b21a8']
  const colors = [c400, c500, c600, isDark ? c200 : c800].map((c, i) => c || fallback[i])
  return colors
}

// Shimmer is now CSS-only (nav-gloss class)
const navTabRefs: Record<string, HTMLElement> = {}

watch(() => route.path, (newPath) => {
  const el = navTabRefs[newPath]
  if (!el) return
  // Remove any existing gloss overlay
  el.querySelectorAll('.gloss-sweep').forEach(g => g.remove())
  const gloss = document.createElement('div')
  gloss.className = 'gloss-sweep'
  gloss.style.cssText = `
    position:absolute;inset:0;pointer-events:none;z-index:20;overflow:hidden;border-radius:9999px;
  `
  const inner = document.createElement('div')
  inner.style.cssText = `
    position:absolute;top:0;bottom:0;width:60%;
    background:linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent);
    transform:translateX(-100%);
  `
  gloss.appendChild(inner)
  el.style.position = 'relative'
  el.appendChild(gloss)
  inner.animate([
    { transform: 'translateX(-100%)' },
    { transform: 'translateX(260%)' },
  ], { duration: 600, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => gloss.remove()
})

function spawnShatterParticles() {
  const container = particleContainer.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  const cx = rect.width / 2
  const cy = rect.height / 2
  const count = 16
  const particles: Particle[] = []
  const colors = getAccentColors()

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
    const speed = 0.8 + Math.random() * 1.5
    particles.push({
      x: cx + (Math.random() - 0.5) * 12,
      y: cy + (Math.random() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1, // slight upward burst first
      size: 1.5 + Math.random() * 2.5,
      opacity: 0.8 + Math.random() * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.15 + Math.random() * 0.1,
    })
  }

  // Use a fixed-size canvas that overflows the container to let particles fall down
  const canvas = document.createElement('canvas')
  const canvasH = 120 // enough room to fall off
  canvas.width = rect.width * 2
  canvas.height = canvasH * 2
  canvas.style.cssText = `position:absolute;top:0;left:0;width:${rect.width}px;height:${canvasH}px;pointer-events:none;z-index:50;overflow:visible;`
  container.style.overflow = 'visible'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)

  const duration = 1200
  const start = performance.now()

  function frame(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const p of particles) {
      p.vy += p.gravity // gravity pulls down
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.98 // air resistance
      p.opacity = Math.max(0, 1 - progress * 1.2)
      p.size *= 0.995

      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    if (progress < 1) requestAnimationFrame(frame)
    else {
      canvas.remove()
      container!.style.overflow = ''
    }
  }

  requestAnimationFrame(frame)
}

function onMorphLeave(el: Element, done: () => void) {
  spawnShatterParticles()
  const htmlEl = el as HTMLElement
  htmlEl.style.transition = 'opacity 0.35s ease-out, transform 0.5s cubic-bezier(0.4,0,1,1)'
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'scale(0.2) translateY(30px)'
  setTimeout(done, 450)
}

function onMorphEnter(el: Element, done: () => void) {
  // Simple fade + scale up, no particles
  const htmlEl = el as HTMLElement
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'scale(0.5)'
  requestAnimationFrame(() => {
    htmlEl.style.transition = 'opacity 0.3s cubic-bezier(0,0,0.2,1), transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275)'
    htmlEl.style.opacity = '1'
    htmlEl.style.transform = 'scale(1)'
  })
  setTimeout(done, 350)
}
</script>

<template>
  <!-- Pull-to-refresh indicator (standalone PWA only) -->
  <div
    v-if="isStandalone && pullDistance > 0"
    class="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
    :style="{ transform: `translateY(${pullDistance - 40}px)`, opacity: Math.min(pullDistance / PULL_THRESHOLD, 1) }"
  >
    <div class="w-10 h-10 rounded-full bg-white dark:bg-gray-700 shadow-lg flex items-center justify-center">
      <component
        :is="icon('loader')"
        class="w-5 h-5 text-purple-500"
        :class="{ 'animate-spin': isRefreshing }"
        :style="{ transform: isRefreshing ? '' : `rotate(${pullDistance * 3}deg)` }"
      />
    </div>
  </div>

  <!-- Loading spinner -->
  <div v-if="appState === 'loading'" class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <GlassIcon glass size="xl" class="mx-auto mb-4">
        <template #default="{ iconClass }"><component :is="icon('loader')" :class="[iconClass, 'animate-spin text-purple-500']" /></template>
      </GlassIcon>
      <div class="animate-pulse text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</div>
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
        <span v-if="sidebarExpanded" class="text-lg font-bold text-purple-600 dark:text-purple-400">{{ locale === 'he' ? 'בזבוז' : 'BizBuz' }}</span>
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
      class="fixed bottom-3 left-3 right-3 bg-gray-100/80 dark:bg-gray-800/60 backdrop-blur-2xl rounded-full shadow-lg shadow-black/10 dark:shadow-black/30 border border-gray-200/80 dark:border-gray-600/30 flex z-50 px-1.5 py-1 overflow-hidden"
      style="backdrop-filter: blur(40px) saturate(180%);"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
    >
      <!-- Sliding bubble indicator -->
      <div
        class="absolute top-1 bottom-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08] transition-all duration-300 ease-in-out pointer-events-none"
        :style="bubbleStyle"
      />

      <router-link
        v-for="item in primaryTabs"
        :key="item.path"
        :to="item.path"
        :ref="(el: any) => { if (el?.$el) navTabRefs[item.path] = el.$el }"
        class="nav-tab flex-1 flex flex-col items-center py-2 text-gray-500 dark:text-gray-400 transition-colors relative z-10"
        :class="{ 'text-purple-600 dark:text-purple-400': route.path === item.path }"
        @click="moreMenuOpen = false"
      >
        <component :is="icon(item.iconName)" class="w-6 h-6" />
        <span class="text-[10px] mt-0.5 font-medium">{{ t(item.labelKey) }}</span>
      </router-link>

      <!-- More button — morphs to show active more-item when on a More page -->
      <button
        class="flex-1 flex flex-col items-center py-2 text-gray-500 dark:text-gray-400 relative z-10"
        :class="{ 'text-purple-600 dark:text-purple-400': isMoreActive || moreMenuOpen }"
        @click="moreMenuOpen = !moreMenuOpen"
      >
        <span ref="particleContainer" class="relative w-6 h-6">
          <Transition
            :css="false"
            mode="out-in"
            @leave="onMorphLeave"
            @enter="onMorphEnter"
          >
            <component
              :is="activeMoreItem ? icon(activeMoreItem.iconName) : icon('more')"
              :key="activeMoreItem?.name || 'more'"
              class="w-6 h-6 absolute inset-0"
            />
          </Transition>
        </span>
        <Transition name="morph-text" mode="out-in">
          <span v-if="activeMoreItem" :key="activeMoreItem.name" class="text-[10px] mt-0.5 font-medium leading-tight text-center">
            {{ t(activeMoreItem.labelKey) }}
          </span>
          <span v-else key="more" class="text-[10px] mt-0.5 font-medium">{{ t('nav.more') }}</span>
        </Transition>
        <span v-if="activeMoreItem" class="text-[8px] font-medium text-gray-400 dark:text-gray-500 leading-none">{{ t('nav.more') }}</span>
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

/* Icon morph: scale + rotate */
.morph-enter-active,
.morph-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.morph-enter-from {
  opacity: 0;
  transform: scale(0.5) rotate(-90deg);
}
.morph-leave-to {
  opacity: 0;
  transform: scale(0.5) rotate(90deg);
}

/* Text morph: slide + fade */
.morph-text-enter-active,
.morph-text-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.morph-text-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.morph-text-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>