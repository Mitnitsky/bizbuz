import type { CategoryDef } from '@/types'

// --- System Category IDs ---
export const DEFAULT_CATEGORY = 'other'
export const TRANSFER_CATEGORY = 'transfer'
export const NON_BUDGET_CATEGORY = 'non-budget'
export const EXCEPTIONAL_CATEGORY = 'exceptional'
export const INCOME_CATEGORY = 'income'

export const SYSTEM_CATEGORY_IDS = [
  DEFAULT_CATEGORY,
  TRANSFER_CATEGORY,
  NON_BUDGET_CATEGORY,
  EXCEPTIONAL_CATEGORY,
  INCOME_CATEGORY,
] as const

export function isSystemCategory(id: string): boolean {
  return (SYSTEM_CATEGORY_IDS as readonly string[]).includes(id)
}

// --- Default Categories (seeded on first use) ---
export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: 'groceries', name: 'סופרמרקט ומכולת', nameEn: 'Groceries' },
  { id: 'bills', name: 'חשבונות', nameEn: 'Bills & Utilities' },
  { id: 'auto', name: 'רכב ותחבורה', nameEn: 'Auto & Transport' },
  { id: 'health', name: 'בריאות ופארם', nameEn: 'Health & Pharma' },
  { id: 'kids', name: 'ילדים וחינוך', nameEn: 'Kids & Education' },
  { id: 'mortgage', name: 'משכנתא', nameEn: 'Mortgage' },
  { id: 'dining', name: 'מסעדות ובתי קפה', nameEn: 'Dining & Cafes' },
  { id: 'subscriptions', name: 'מנויים', nameEn: 'Subscriptions' },
  { id: 'leisure', name: 'פנאי', nameEn: 'Leisure' },
  { id: 'shopping-home', name: 'קניות לבית ולמשפחה', nameEn: 'Shopping & Home' },
  { id: 'shopping-online', name: 'קניות אונליין', nameEn: 'Online Shopping' },
  { id: 'clothing', name: 'ביגוד והנעלה', nameEn: 'Clothing & Shoes' },
  { id: 'pets', name: 'חיות מחמד', nameEn: 'Pets' },
  { id: 'travel', name: 'חופשות ותיירות', nameEn: 'Travel & Vacations' },
  { id: 'insurance', name: 'ביטוח ופיננסים', nameEn: 'Insurance & Finance' },
  { id: 'services', name: 'שירותים ותיקונים', nameEn: 'Services & Repairs' },
  { id: 'gifts', name: 'תרומות ומתנות', nameEn: 'Gifts & Donations' },
  { id: 'savings', name: 'חסכון והשקעות', nameEn: 'Savings & Investments' },
  { id: DEFAULT_CATEGORY, name: 'אחר', nameEn: 'Other', system: true },
  { id: TRANSFER_CATEGORY, name: 'העברה', nameEn: 'Transfer', system: true },
  { id: NON_BUDGET_CATEGORY, name: 'לא תקציבי', nameEn: 'Non-Budget', system: true },
  { id: EXCEPTIONAL_CATEGORY, name: 'חריג', nameEn: 'Exceptional', system: true },
  { id: INCOME_CATEGORY, name: 'הכנסה', nameEn: 'Income', system: true },
]

// Legacy Hebrew name → new ID mapping (for migration)
export const LEGACY_NAME_TO_ID: Record<string, string> = {}
for (const cat of DEFAULT_CATEGORIES) {
  LEGACY_NAME_TO_ID[cat.name] = cat.id
}

export function categoryDisplayName(
  id: string,
  locale: string,
  categories: CategoryDef[] = [],
  overrides: Record<string, string> = {},
): string {
  if (overrides[id]) return overrides[id]
  const cat = categories.find(c => c.id === id) || DEFAULT_CATEGORIES.find(c => c.id === id)
  if (cat) {
    return locale === 'en' ? (cat.nameEn || cat.name) : cat.name
  }
  // Fallback for legacy Hebrew-name categories
  const legacy = DEFAULT_CATEGORIES.find(c => c.name === id)
  if (legacy) {
    return locale === 'en' ? (legacy.nameEn || legacy.name) : legacy.name
  }
  return id
}

// --- Tooltips ---
const CATEGORY_TOOLTIPS: Record<string, Record<string, string>> = {
  [NON_BUDGET_CATEGORY]: {
    en: 'Credit card billing, bank fees, and other non-discretionary charges',
    he: 'חיובי כרטיסי אשראי, עמלות בנק וחיובים קבועים אחרים',
  },
  [EXCEPTIONAL_CATEGORY]: {
    en: 'One-time or exceptional expenses (e.g. vacation) — excluded from cycle totals',
    he: 'הוצאות חד-פעמיות או חריגות (כמו חופשה) — לא נספרות בסיכום התקופה',
  },
  [INCOME_CATEGORY]: {
    en: 'Salary, refunds, and other income — excluded from expense totals',
    he: 'משכורת, החזרים והכנסות אחרות — לא נספרות בהוצאות',
  },
}

export function categoryTooltip(key: string, locale: string): string | undefined {
  return CATEGORY_TOOLTIPS[key]?.[locale === 'he' ? 'he' : 'en']
}

/**
 * Merge default categories with family custom categories.
 * If familyCategories is empty/undefined, returns DEFAULT_CATEGORIES.
 */
export function getEffectiveCategories(familyCategories: CategoryDef[] = [], locale = 'he'): CategoryDef[] {
  const cats = familyCategories.length === 0 ? DEFAULT_CATEGORIES : familyCategories
  return [...cats].sort((a, b) => {
    const nameA = locale === 'en' ? (a.nameEn || a.name) : a.name
    const nameB = locale === 'en' ? (b.nameEn || b.name) : b.name
    return nameA.localeCompare(nameB, locale)
  })
}

export function isSharedCategory(id: string, familyCategories: CategoryDef[] = []): boolean {
  const cat = familyCategories.find(c => c.id === id)
  return cat?.shared === true
}

export const LIQUID_ACCOUNT_TYPES = ['עו"ש (חשבון עובר ושב)', 'חיסכון נזיל', 'פיקדון', 'מזומן'] as const
export const LOCKED_FUND_TYPES = ['קרן השתלמות', 'פנסיה', 'קופת גמל', 'ביטוח מנהלים', 'קרן נאמנות'] as const

const LIQUID_ENGLISH: Record<string, string> = {
  'עו"ש (חשבון עובר ושב)': 'Checking Account',
  'חיסכון נזיל': 'Liquid Savings',
  'פיקדון': 'Deposit',
  'מזומן': 'Cash',
}
const LOCKED_ENGLISH: Record<string, string> = {
  'קרן השתלמות': 'Keren Hishtalmut',
  'פנסיה': 'Pension',
  'קופת גמל': 'Kupat Gemel',
  'ביטוח מנהלים': "Manager's Insurance",
  'קרן נאמנות': 'Mutual Fund',
}

export function liquidTypeDisplayName(key: string, locale: string): string {
  if (locale === 'en') return LIQUID_ENGLISH[key] ?? key
  return key
}
export function lockedTypeDisplayName(key: string, locale: string): string {
  if (locale === 'en') return LOCKED_ENGLISH[key] ?? key
  return key
}
