import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '@/firebase'

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
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { requiresAuth: true } },
  ]
})

router.beforeEach((to, _from, next) => {
  const user = auth.currentUser
  if (to.meta.requiresAuth !== false && !user) {
    next('/login')
  } else {
    next()
  }
})

export default router
