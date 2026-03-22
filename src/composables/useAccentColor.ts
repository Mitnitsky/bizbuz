import { ref, watch } from 'vue'

export type AccentColor = 'purple' | 'blue' | 'teal' | 'green' | 'rose' | 'orange' | 'amber' | 'indigo'

// Tailwind v4 color palettes (oklch → hex approximations for the shades we use)
const PALETTES: Record<AccentColor, Record<string, string>> = {
  purple: {}, // empty = use Tailwind defaults (no overrides needed)
  blue: {
    '50': '239 246 255',   // #eff6ff
    '100': '219 234 254',  // #dbeafe
    '300': '147 197 253',  // #93c5fd
    '400': '96 165 250',   // #60a5fa
    '500': '59 130 246',   // #3b82f6
    '600': '37 99 235',    // #2563eb
    '700': '29 78 216',    // #1d4ed8
    '900': '30 58 138',    // #1e3a8a
  },
  teal: {
    '50': '240 253 250',
    '100': '204 251 241',
    '300': '94 234 212',
    '400': '45 212 191',
    '500': '20 184 166',
    '600': '13 148 136',
    '700': '15 118 110',
    '900': '19 78 74',
  },
  green: {
    '50': '240 253 244',
    '100': '220 252 231',
    '300': '134 239 172',
    '400': '74 222 128',
    '500': '34 197 94',
    '600': '22 163 74',
    '700': '21 128 61',
    '900': '20 83 45',
  },
  rose: {
    '50': '255 241 242',
    '100': '255 228 230',
    '300': '253 164 175',
    '400': '251 113 133',
    '500': '244 63 94',
    '600': '225 29 72',
    '700': '190 18 60',
    '900': '136 19 55',
  },
  orange: {
    '50': '255 247 237',
    '100': '255 237 213',
    '300': '253 186 116',
    '400': '251 146 60',
    '500': '249 115 22',
    '600': '234 88 12',
    '700': '194 65 12',
    '900': '124 45 18',
  },
  amber: {
    '50': '255 251 235',
    '100': '254 243 199',
    '300': '252 211 77',
    '400': '251 191 36',
    '500': '245 158 11',
    '600': '217 119 6',
    '700': '180 83 9',
    '900': '120 53 15',
  },
  indigo: {
    '50': '238 242 255',
    '100': '224 231 255',
    '300': '165 180 252',
    '400': '129 140 248',
    '500': '99 102 241',
    '600': '79 70 229',
    '700': '67 56 202',
    '900': '49 46 129',
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
