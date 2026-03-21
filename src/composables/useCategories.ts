export const CATEGORIES = [
  'מזון ומשקאות', 'מסעדות', 'ביטוח ופיננסים', 'ריהוט ובית',
  'מוסדות', 'פנאי בילוי', 'תקשורת ומחשבים', 'אנרגיה',
  'רכב ותחבורה', 'תעשיה ומכירות', 'רפואה ובריאות', 'תיירות',
  'אופנה', 'עמותות ותרומות', 'ציוד ומשרד', 'אירועים',
  'שונות', 'ילדים', 'מקצועות חופשיים', 'מלונאות ואירוח',
  'מנויים', 'חיות מחמד', 'קניות כלליות', 'חסכון והשקעות',
  'העברה', 'אחר',
] as const

const CATEGORY_ENGLISH: Record<string, string> = {
  'מזון ומשקאות': 'Food & Beverages',
  'מסעדות': 'Restaurants',
  'ביטוח ופיננסים': 'Insurance & Finance',
  'ריהוט ובית': 'Home & Furniture',
  'מוסדות': 'Institutions',
  'פנאי בילוי': 'Leisure & Entertainment',
  'תקשורת ומחשבים': 'Telecom & Computers',
  'אנרגיה': 'Energy',
  'רכב ותחבורה': 'Vehicle & Transport',
  'תעשיה ומכירות': 'Industry & Sales',
  'רפואה ובריאות': 'Medical & Health',
  'תיירות': 'Tourism',
  'אופנה': 'Fashion',
  'עמותות ותרומות': 'Charities & Donations',
  'ציוד ומשרד': 'Office & Equipment',
  'אירועים': 'Events',
  'שונות': 'Miscellaneous',
  'ילדים': 'Kids',
  'מקצועות חופשיים': 'Freelance',
  'מלונאות ואירוח': 'Hotels & Hospitality',
  'מנויים': 'Subscriptions',
  'חיות מחמד': 'Pets',
  'קניות כלליות': 'General Shopping',
  'חסכון והשקעות': 'Savings & Investments',
  'העברה': 'Transfer',
  'אחר': 'Other',
}

export const DEFAULT_CATEGORY = 'אחר'
export const TRANSFER_CATEGORY = 'העברה'

export function categoryDisplayName(key: string, locale: string, overrides: Record<string, string> = {}): string {
  if (overrides[key]) return overrides[key]
  if (locale === 'en') return CATEGORY_ENGLISH[key] ?? key
  return key
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
