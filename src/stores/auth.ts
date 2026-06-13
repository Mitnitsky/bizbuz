import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/firebase'
import type { AppUser } from '@/types'
import { getAppUser } from '@/services/firestore'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const appUser = ref<AppUser | null>(null)
  const loading = ref(true)
  // Track if user was previously logged in (for fast initial routing)
  const wasLoggedIn = ref(typeof localStorage !== 'undefined' && localStorage.getItem('bizbuz:auth') === '1')

  const familyId = computed(() => appUser.value?.familyId ?? null)
  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    user.value = cred.user
    appUser.value = await getAppUser(cred.user.uid)
    localStorage.setItem('bizbuz:auth', '1')
  }

  async function register(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    user.value = cred.user
    localStorage.setItem('bizbuz:auth', '1')
  }

  async function logout() {
    await signOut(auth)
    user.value = null
    appUser.value = null
    localStorage.removeItem('bizbuz:auth')
  }

  function initAuth(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser
        if (firebaseUser) {
          appUser.value = await getAppUser(firebaseUser.uid)
          localStorage.setItem('bizbuz:auth', '1')
        } else {
          appUser.value = null
          localStorage.removeItem('bizbuz:auth')
          wasLoggedIn.value = false
        }
        loading.value = false
        resolve()
      })
    })
  }

  async function refreshAppUser() {
    if (user.value) {
      appUser.value = await getAppUser(user.value.uid)
    }
  }

  return {
    user,
    appUser,
    loading,
    wasLoggedIn,
    familyId,
    isAuthenticated,
    login,
    register,
    logout,
    initAuth,
    refreshAppUser,
  }
})
