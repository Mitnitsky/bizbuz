<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  glass?: boolean
  active?: boolean
}>(), {
  size: 'md',
  glass: false,
  active: false,
})

const iconSize = computed(() => ({
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
}[props.size]))

const wrapperSize = computed(() => ({
  xs: 'w-6 h-6',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
}[props.size]))
</script>

<template>
  <span
    v-if="glass"
    class="glass-icon-wrapper inline-flex items-center justify-center rounded-xl shrink-0"
    :class="[
      wrapperSize,
      active
        ? 'glass-icon-active'
        : 'glass-icon-default'
    ]"
  >
    <slot :icon-class="iconSize" />
  </span>
  <span v-else class="inline-flex items-center justify-center shrink-0" :class="iconSize">
    <slot :icon-class="iconSize" />
  </span>
</template>

<style scoped>
.glass-icon-wrapper {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: all 0.2s ease;
}

.glass-icon-default {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.04)
  );
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
}

.glass-icon-active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-purple-600) 25%, transparent),
    color-mix(in srgb, var(--color-purple-600) 10%, transparent)
  );
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border-color: color-mix(in srgb, var(--color-purple-600) 30%, transparent);
  box-shadow:
    0 2px 12px color-mix(in srgb, var(--color-purple-600) 15%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.glass-icon-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 50%
  );
  pointer-events: none;
}

:root.dark .glass-icon-default {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.08),
    rgba(255, 255, 255, 0.02)
  );
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

:root.dark .glass-icon-active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-purple-400) 30%, transparent),
    color-mix(in srgb, var(--color-purple-400) 12%, transparent)
  );
  border-color: color-mix(in srgb, var(--color-purple-400) 35%, transparent);
  box-shadow:
    0 2px 12px color-mix(in srgb, var(--color-purple-400) 20%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
</style>
