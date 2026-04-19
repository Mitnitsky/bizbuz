import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'

export interface ChatMessage {
  role: 'user' | 'model'
  content: string
  timestamp: Date
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function sendMessage(question: string, context: string) {
    error.value = null

    // Add user message
    messages.value.push({
      role: 'user',
      content: question,
      timestamp: new Date(),
    })

    loading.value = true

    try {
      const functions = getFunctions()
      const askAI = httpsCallable<
        { question: string; context: string; history: { role: string; content: string }[] },
        { response: string }
      >(functions, 'askAI')

      // Build history (exclude last user message — it's in the question)
      const history = messages.value.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const result = await askAI({ question, context, history })

      messages.value.push({
        role: 'model',
        content: result.data.response,
        timestamp: new Date(),
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא צפויה'
      error.value = msg
      // Remove the user message on failure so they can retry
      messages.value.pop()
    } finally {
      loading.value = false
    }
  }

  function clearChat() {
    messages.value = []
    error.value = null
  }

  return { messages, loading, error, sendMessage, clearChat }
})
