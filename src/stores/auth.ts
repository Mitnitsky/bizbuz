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

  const familyId = computed(() => appUser.value?.familyId ?? null)
  const isAuthenticated = computed(() => !!user.value)

  async function login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    user.value = cred.user
    appUser.value = await getAppUser(cred.user.uid)
  }

  async function register(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    user.value = cred.user
  }

  async function logout() {
    await signOut(auth)
    user.value = null
    appUser.value = null
  }

  function initAuth(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        user.value = firebaseUser
        if (firebaseUser) {
          appUser.value = await getAppUser(firebaseUser.uid)
        } else {
          appUser.value = null
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
    familyId,
    isAuthenticated,
    login,
    register,
    logout,
    initAuth,
    refreshAppUser,
  }
})
