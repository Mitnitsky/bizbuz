<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '@/stores/chat'
import { useTransactionsStore } from '@/stores/transactions'
import { useFamilyStore } from '@/stores/family'
import { useAiContext } from '@/composables/useAiContext'

const { t } = useI18n()
const chatStore = useChatStore()
const txnStore = useTransactionsStore()
const familyStore = useFamilyStore()
const { context } = useAiContext()

const input = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)

const dataLoading = computed(() => !txnStore.loaded || !familyStore.familyLoaded)

const suggestedQuestions = computed(() => [
  t('ai.suggestions.monthTotal'),
  t('ai.suggestions.biggestExpense'),
  t('ai.suggestions.foodSpend'),
  t('ai.suggestions.budgetOverrun'),
  t('ai.suggestions.compareLastMonth'),
])

async function send(text?: string) {
  const question = (text || input.value).trim()
  if (!question || chatStore.loading) return
  input.value = ''
  if (inputEl.value) {
    inputEl.value.style.height = '40px'
  }
  await chatStore.sendMessage(question, context.value)
  await nextTick()
  scrollToBottom()
}

function autoResize() {
  const el = inputEl.value
  if (!el) return
  el.style.height = '40px'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

// Simple markdown-like formatting: **bold**, bullet lists
function formatResponse(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <h1 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        {{ t('ai.title') }}
      </h1>
      <button
        v-if="chatStore.messages.length > 0"
        @click="chatStore.clearChat()"
        class="text-sm text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
      >
        {{ t('ai.clearChat') }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="dataLoading" class="flex-1 flex items-center justify-center">
      <div class="text-gray-400 dark:text-gray-500 animate-pulse">{{ t('ai.loadingData') }}</div>
    </div>

    <!-- Chat area -->
    <template v-else>
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <!-- Empty state with suggestions -->
        <div v-if="chatStore.messages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
          <div class="text-5xl mb-4">✨</div>
          <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{{ t('ai.welcome') }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">{{ t('ai.welcomeDesc') }}</p>
          <div class="flex flex-wrap justify-center gap-2 max-w-sm">
            <button
              v-for="q in suggestedQuestions"
              :key="q"
              @click="send(q)"
              class="text-sm px-3 py-2 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors border border-purple-200 dark:border-purple-700"
            >
              {{ q }}
            </button>
          </div>
        </div>

        <!-- Messages -->
        <template v-for="(msg, i) in chatStore.messages" :key="i">
          <!-- User message -->
          <div v-if="msg.role === 'user'" class="flex justify-start">
            <div class="max-w-[85%] bg-purple-600 text-white px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm">
              {{ msg.content }}
            </div>
          </div>
          <!-- Assistant message -->
          <div v-else class="flex justify-end">
            <div class="max-w-[85%] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-600">
              <div v-html="formatResponse(msg.content)" class="prose prose-sm dark:prose-invert max-w-none [&_br]:mb-1" />
            </div>
          </div>
        </template>

        <!-- Loading indicator -->
        <div v-if="chatStore.loading" class="flex justify-end">
          <div class="bg-white dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-600">
            <div class="flex gap-1.5">
              <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
              <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
              <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
            </div>
          </div>
        </div>

        <!-- Error -->
        <div v-if="chatStore.error" class="flex justify-center">
          <div class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
            {{ chatStore.error }}
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div class="flex items-end gap-2">
          <div class="flex-1 relative">
            <textarea
              ref="inputEl"
              v-model="input"
              @keydown="handleKeydown"
              @input="autoResize"
              :placeholder="t('ai.placeholder')"
              rows="1"
              class="w-full resize-none overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500 leading-relaxed"
              style="min-height: 40px; max-height: 120px;"
              :disabled="chatStore.loading"
            />
          </div>
          <button
            @click="send()"
            :disabled="!input.trim() || chatStore.loading"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            :aria-label="t('ai.send')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
