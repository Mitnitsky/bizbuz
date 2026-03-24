<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import GlassIcon from '@/components/GlassIcon.vue'
import { useIcons } from '@/composables/useIcons'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()
const { icon } = useIcons()

const email = ref('')
const password = ref('')
const isRegistering = ref(false)
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (isRegistering.value) {
      await authStore.register(email.value, password.value)
      router.replace('/onboarding')
    } else {
      await authStore.login(email.value, password.value)
      if (authStore.familyId) {
        router.replace('/')
      } else {
        router.replace('/onboarding')
      }
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <GlassIcon glass size="xl" class="mx-auto mb-3">
          <template #default="{ iconClass }"><component :is="icon('coins')" :class="[iconClass, 'text-purple-500']" /></template>
        </GlassIcon>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-200">BizBuz</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">{{ t('auth.familyFinancialTracker') }}</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.email') }}</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.password') }}</label>
          <input
            v-model="password"
            type="password"
            required
            minlength="6"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
          />
        </div>

        <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="inline-flex mr-2"><component :is="icon('loader')" class="w-4 h-4 animate-spin" /></span>
          {{ isRegistering ? t('auth.createAccount') : t('auth.signIn') }}
        </button>

        <button
          type="button"
          @click="isRegistering = !isRegistering; error = ''"
          class="w-full text-center text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          {{ isRegistering ? t('auth.alreadyHaveAccount') : t('auth.noAccountRegister') }}
        </button>
      </form>
    </div>
  </div>
</template>
