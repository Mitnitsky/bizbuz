import { ref, watch } from 'vue'

export type AccentColor = 'purple' | 'blue' | 'teal' | 'green' | 'rose' | 'orange' | 'amber' | 'indigo'

// Tailwind v4 color palettes (oklch → hex approximations for the shades we use)
const PALETTES: Record<AccentColor, Record<string, string>> = {
  purple: {}, // empty = use Tailwind defaults (no overrides needed)
  blue: {
    '50': '#eff6ff',
    '100': '#dbeafe',
    '300': '#93c5fd',
    '400': '#60a5fa',
    '500': '#3b82f6',
    '600': '#2563eb',
    '700': '#1d4ed8',
    '900': '#1e3a8a',
  },
  teal: {
    '50': '#f0fdfa',
    '100': '#ccfbf1',
    '300': '#5eead4',
    '400': '#2dd4bf',
    '500': '#14b8a6',
    '600': '#0d9488',
    '700': '#0f766e',
    '900': '#134e4a',
  },
  green: {
    '50': '#f0fdf4',
    '100': '#dcfce7',
    '300': '#86efac',
    '400': '#4ade80',
    '500': '#22c55e',
    '600': '#16a34a',
    '700': '#15803d',
    '900': '#14532d',
  },
  rose: {
    '50': '#fff1f2',
    '100': '#ffe4e6',
    '300': '#fda4af',
    '400': '#fb7185',
    '500': '#f43f5e',
    '600': '#e11d48',
    '700': '#be123c',
    '900': '#881337',
  },
  orange: {
    '50': '#fff7ed',
    '100': '#ffedd5',
    '300': '#fdba74',
    '400': '#fb923c',
    '500': '#f97316',
    '600': '#ea580c',
    '700': '#c2410c',
    '900': '#7c2d12',
  },
  amber: {
    '50': '#fffbeb',
    '100': '#fef3c7',
    '300': '#fcd34d',
    '400': '#fbbf24',
    '500': '#f59e0b',
    '600': '#d97706',
    '700': '#b45309',
    '900': '#78350f',
  },
  indigo: {
    '50': '#eef2ff',
    '100': '#e0e7ff',
    '300': '#a5b4fc',
    '400': '#818cf8',
    '500': '#6366f1',
    '600': '#4f46e5',
    '700': '#4338ca',
    '900': '#312e81',
  },
}

export const ACCENT_COLORS: { key: AccentColor; label: string; swatch: string }[] = [
  { key: 'purple', label: 'Purple', swatch: '#9333ea' },
  { key: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { key: 'blue', label: 'Blue', swatch: '#2563eb' },
  { key: 'teal', label: 'Teal', swatch: '#0d9488' },
  { key: 'green', label: 'Green', swatch: '#16a34a' },
  { key: 'rose', label: 'Rose', swatch: '#e11d48' },
  { key: 'orange', label: 'Orange', swatch: '#ea580c' },
  { key: 'amber', label: 'Amber', swatch: '#d97706' },
]

const STORAGE_KEY = 'bizbuz:accentColor'
const activeColor = ref<AccentColor>(
  (localStorage.getItem(STORAGE_KEY) as AccentColor) || 'purple'
)

function applyAccentColor(color: AccentColor) {
  const root = document.documentElement
  const palette = PALETTES[color]

  // Remove all overrides first
  const shades = ['50', '100', '300', '400', '500', '600', '700', '900']
  for (const shade of shades) {
    root.style.removeProperty(`--color-purple-${shade}`)
  }

  // Apply new palette (if not default purple)
  if (Object.keys(palette).length > 0) {
    for (const [shade, value] of Object.entries(palette)) {
      root.style.setProperty(`--color-purple-${shade}`, value)
    }
  }
}

// Apply on load
applyAccentColor(activeColor.value)

// React to changes
watch(activeColor, (color) => {
  applyAccentColor(color)
})

export function useAccentColor() {
  function setAccentColor(color: AccentColor) {
    activeColor.value = color
    localStorage.setItem(STORAGE_KEY, color)
  }

  return {
    activeColor,
    setAccentColor,
    accentColors: ACCENT_COLORS,
  }
}
