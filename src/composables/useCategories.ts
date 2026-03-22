// --- System Constants ---
export const DEFAULT_CATEGORY = 'אחר'
export const TRANSFER_CATEGORY = 'העברה'
export const NON_BUDGET_CATEGORY = 'לא תקציבי'
export const EXCEPTIONAL_CATEGORY = 'חריג'
export const INCOME_CATEGORY = 'הכנסה'

// --- Canonical Categories ---
export const CATEGORIES = [
  // Core Living
  'סופרמרקט ומכולת',
  'חשבונות',
  'רכב ותחבורה',
  'בריאות ופארם',
  'ילדים וחינוך',
  'משכנתא',

  // Discretionary & Lifestyle
  'מסעדות ובתי קפה',
  'מנויים',
  'פנאי',
  'קניות לבית ולמשפחה',
  'קניות אונליין',
  'ביגוד והנעלה',
  'חיות מחמד',

  // Irregular & Big Ticket
  'חופשות ותיירות',
  'ביטוח ופיננסים',
  'שירותים ותיקונים',

  // Misc & System
  'תרומות ומתנות',
  'חסכון והשקעות',

  DEFAULT_CATEGORY,
  TRANSFER_CATEGORY,
  NON_BUDGET_CATEGORY,
  EXCEPTIONAL_CATEGORY,
  INCOME_CATEGORY,
] as const

// --- English Display Names ---
const CATEGORY_ENGLISH: Record<string, string> = {
  'סופרמרקט ומכולת': 'Groceries',
  'חשבונות': 'Bills & Utilities',
  'רכב ותחבורה': 'Auto & Transport',
  'בריאות ופארם': 'Health & Pharma',
  'ילדים וחינוך': 'Kids & Education',
  'משכנתא': 'Mortgage',
  'מסעדות ובתי קפה': 'Dining & Cafes',
  'מנויים': 'Subscriptions',
  'פנאי': 'Leisure',
  'קניות לבית ולמשפחה': 'Shopping & Home',
  'קניות אונליין': 'Online Shopping',
  'ביגוד והנעלה': 'Clothing & Shoes',
  'חיות מחמד': 'Pets',
  'חופשות ותיירות': 'Travel & Vacations',
  'ביטוח ופיננסים': 'Insurance & Finance',
  'שירותים ותיקונים': 'Services & Repairs',
  'תרומות ומתנות': 'Gifts & Donations',
  'חסכון והשקעות': 'Savings & Investments',
  [DEFAULT_CATEGORY]: 'Other',
  [TRANSFER_CATEGORY]: 'Transfer',
  [NON_BUDGET_CATEGORY]: 'Non-Budget',
  [EXCEPTIONAL_CATEGORY]: 'Exceptional',
  [INCOME_CATEGORY]: 'Income',
}

// --- Scraper Category Mapping (old → new) ---
export const SCRAPER_CATEGORY_MAP: Record<string, string> = {
  'מזון ומשקאות': 'סופרמרקט ומכולת',
  'מסעדות': 'מסעדות ובתי קפה',
  'אנרגיה': 'חשבונות',
  'מוסדות': 'חשבונות',
  'תקשורת ומחשבים': 'מנויים',
  'רכב ותחבורה': 'רכב ותחבורה',
  'רפואה ובריאות': 'בריאות ופארם',
  'ילדים': 'ילדים וחינוך',
  'פנאי בילוי': 'פנאי',
  'מנויים': 'מנויים',
  'אירועים': 'פנאי',
  'אופנה': 'ביגוד והנעלה',
  'ריהוט ובית': 'קניות לבית ולמשפחה',
  'קניות כלליות': 'קניות לבית ולמשפחה',
  'ציוד ומשרד': 'קניות לבית ולמשפחה',
  'חיות מחמד': 'חיות מחמד',
  'תיירות': 'חופשות ותיירות',
  'מלונאות ואירוח': 'חופשות ותיירות',
  'ביטוח ופיננסים': 'ביטוח ופיננסים',
  'מקצועות חופשיים': 'שירותים ותיקונים',
  'תעשיה ומכירות': 'שירותים ותיקונים',
  'עמותות ותרומות': 'תרומות ומתנות',
  'חסכון והשקעות': 'חסכון והשקעות',
  // Old merged categories → new split
  'חשבונות ותקשורת': 'חשבונות',
  'פנאי ומנויים': 'פנאי',
  'שונות': DEFAULT_CATEGORY,
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

export function categoryDisplayName(key: string, locale: string, overrides: Record<string, string> = {}): string {
  if (overrides[key]) return overrides[key]
  if (locale === 'en') return CATEGORY_ENGLISH[key] ?? key
  return key
}

/** Map a scraper-provided category to our canonical set */
export function mapScraperCategory(scraperCat: string): string | undefined {
  return SCRAPER_CATEGORY_MAP[scraperCat]
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
