import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { requiresAuth: false } },
    { path: '/onboarding', name: 'onboarding', component: () => import('@/views/OnboardingView.vue'), meta: { requiresAuth: true } },
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { requiresAuth: true } },
    { path: '/spendings', name: 'spendings', component: () => import('@/views/SpendingsView.vue'), meta: { requiresAuth: true } },
    { path: '/savings', name: 'savings', component: () => import('@/views/SavingsView.vue'), meta: { requiresAuth: true } },
    { path: '/investments', name: 'investments', component: () => import('@/views/InvestmentsView.vue'), meta: { requiresAuth: true } },
    { path: '/loans', name: 'loans', component: () => import('@/views/LoansView.vue'), meta: { requiresAuth: true } },
    { path: '/statistics', name: 'statistics', component: () => import('@/views/StatisticsView.vue'), meta: { requiresAuth: true } },
    { path: '/installments', name: 'installments', component: () => import('@/views/InstallmentsView.vue'), meta: { requiresAuth: true } },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/rules', name: 'rules', component: () => import('@/views/RulesView.vue'), meta: { requiresAuth: true } },
    { path: '/settings/categories', name: 'categories', component: () => import('@/views/CategoriesView.vue'), meta: { requiresAuth: true } },
  ]
})

// Auth routing is handled by App.vue's appState watcher.
// No beforeEach guard needed — it causes a login flash on reload
// because auth.currentUser is null before Firebase resolves.

export default router
