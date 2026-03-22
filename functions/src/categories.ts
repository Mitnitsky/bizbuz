// Canonical category list (Hebrew keys) — shared between ingestion and rules engine
export const DEFAULT_CATEGORY = 'אחר';
export const TRANSFER_CATEGORY = 'העברה';
export const NON_BUDGET_CATEGORY = 'לא תקציבי';
export const EXCEPTIONAL_CATEGORY = 'חריג';
export const INCOME_CATEGORY = 'הכנסה';

export const CATEGORIES = [
  'סופרמרקט ומכולת', 'חשבונות', 'רכב ותחבורה', 'בריאות ופארם', 'ילדים וחינוך', 'משכנתא',
  'מסעדות ובתי קפה', 'מנויים', 'פנאי', 'קניות לבית ולמשפחה', 'קניות אונליין', 'ביגוד והנעלה', 'חיות מחמד',
  'חופשות ותיירות', 'ביטוח ופיננסים', 'שירותים ותיקונים',
  'תרומות ומתנות', 'חסכון והשקעות',
  DEFAULT_CATEGORY, TRANSFER_CATEGORY, NON_BUDGET_CATEGORY, EXCEPTIONAL_CATEGORY, INCOME_CATEGORY,
] as const;

// Map scraper-provided categories to our canonical set
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
};

const categorySet = new Set<string>(CATEGORIES);

export function isKnownCategory(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && categorySet.has(value);
}

/** Map a scraper category to our canonical set, or return undefined */
export function mapScraperCategory(scraperCat: string): string | undefined {
  if (categorySet.has(scraperCat)) return scraperCat;
  return SCRAPER_CATEGORY_MAP[scraperCat];
}
