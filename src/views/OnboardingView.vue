<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { createFamily, joinFamily } from '@/services/firestore'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const familyName = ref('')
const inviteCode = ref('')
const createError = ref('')
const joinError = ref('')
const createLoading = ref(false)
const joinLoading = ref(false)

async function handleCreateFamily() {
  if (!familyName.value.trim() || !authStore.user) return
  createError.value = ''
  createLoading.value = true
  try {
    await createFamily(authStore.user.uid, authStore.user.email ?? '', familyName.value.trim())
    await authStore.refreshAppUser()
    router.replace('/')
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : 'Failed to create family'
  } finally {
    createLoading.value = false
  }
}

async function handleJoinFamily() {
  if (!inviteCode.value.trim() || !authStore.user) return
  joinError.value = ''
  joinLoading.value = true
  try {
    const familyId = await joinFamily(authStore.user.uid, authStore.user.email ?? '', inviteCode.value.trim())
    if (!familyId) {
      joinError.value = 'Invalid invite code'
      return
    }
    await authStore.refreshAppUser()
    router.replace('/')
  } catch (e: unknown) {
    joinError.value = e instanceof Error ? e.message : 'Failed to join family'
  } finally {
    joinLoading.value = false
  }
}

async function handleSignOut() {
  await authStore.logout()
  router.replace('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
    <div class="w-full max-w-2xl">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">👨‍👩‍👧‍👦</div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-200">{{ t('auth.welcomeToBizbuz') }}</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">{{ t('auth.signedInAs', { email: authStore.user?.email ?? '' }) }}</p>
      </div>

      <!-- Cards -->
      <div class="flex flex-col md:flex-row gap-6 items-stretch">
        <!-- Create Family -->
        <div class="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-200 mb-2">{{ t('auth.createFamily') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('auth.createFamilySubtitle') }}</p>
          <form @submit.prevent="handleCreateFamily" class="space-y-3">
            <input
              v-model="familyName"
              type="text"
              :placeholder="t('settings.familyName')"
              required
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
            />
            <p v-if="createError" class="text-red-500 text-sm">{{ createError }}</p>
            <button
              type="submit"
              :disabled="createLoading"
              class="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50"
            >
              {{ t('auth.createFamilyButton') }}
            </button>
          </form>
        </div>

        <!-- OR divider -->
        <div class="flex items-center justify-center md:flex-col">
          <div class="h-px w-16 md:h-16 md:w-px bg-gray-300 dark:bg-gray-600"></div>
          <span class="px-3 py-1 text-sm text-gray-400 font-medium">{{ t('auth.or') }}</span>
          <div class="h-px w-16 md:h-16 md:w-px bg-gray-300 dark:bg-gray-600"></div>
        </div>

        <!-- Join Family -->
        <div class="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-200 mb-2">{{ t('auth.joinExistingFamily') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('auth.gotInviteCode') }}</p>
          <form @submit.prevent="handleJoinFamily" class="space-y-3">
            <input
              v-model="inviteCode"
              type="text"
              :placeholder="t('home.inviteCode')"
              required
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
            />
            <p v-if="joinError" class="text-red-500 text-sm">{{ joinError }}</p>
            <button
              type="submit"
              :disabled="joinLoading"
              class="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50"
            >
              {{ t('auth.joinFamily') }}
            </button>
          </form>
        </div>
      </div>

      <!-- Sign out -->
      <div class="text-center mt-8">
        <button
          @click="handleSignOut"
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
        >
          {{ t('common.signOut') }}
        </button>
      </div>
    </div>
  </div>
</template>
