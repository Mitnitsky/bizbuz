<script setup lang="ts">
import { useConfirm } from '@/composables/useConfirm'
import { useI18n } from 'vue-i18n'

const { visible, message, onConfirm, onCancel } = useConfirm()
const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @click.self="onCancel"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
          <p class="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{{ message }}</p>
          <div class="flex justify-end gap-3">
            <button
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              @click="onCancel"
            >{{ t('common.cancel') }}</button>
            <button
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              @click="onConfirm"
            >{{ t('common.delete') }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
.confirm-fade-enter-from .relative,
.confirm-fade-leave-to .relative {
  transform: scale(0.95);
}
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.15s ease;
}
.confirm-fade-enter-active .relative,
.confirm-fade-leave-active .relative {
  transition: transform 0.15s ease;
}
</style>
