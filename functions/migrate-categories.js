#!/usr/bin/env node

/**
 * Migration script: Convert Hebrew category names to IDs
 *
 * What it does:
 * 1. Reads all transactions for a family, converts Hebrew category → ID
 * 2. Reads all rules for a family, converts Hebrew action_category → ID
 * 3. Seeds the default categories array into family_settings if not present
 * 4. Migrates budgets and user preferences (category_order, pinned)
 *
 * Usage:
 *   node scripts/migrate-categories.mjs [--dry-run]
 *
 * Requires: Run from the functions/ directory (where firebase-admin is installed)
 */

const admin = require('firebase-admin')

// --- Config ---
const FAMILY_ID = 'zEE5p7TvIFnuIdgpU3Ix'
const DRY_RUN = process.argv.includes('--dry-run')

// --- Init Firebase Admin ---
admin.initializeApp({ projectId: 'bizbuz-3a473' })
const db = admin.firestore()

// --- Legacy Hebrew name → new ID mapping ---
const LEGACY_NAME_TO_ID = {
  'סופרמרקט ומכולת': 'groceries',
  'חשבונות': 'bills',
  'רכב ותחבורה': 'auto',
  'בריאות ופארם': 'health',
  'ילדים וחינוך': 'kids',
  'משכנתא': 'mortgage',
  'מסעדות ובתי קפה': 'dining',
  'מנויים': 'subscriptions',
  'פנאי': 'leisure',
  'קניות לבית ולמשפחה': 'shopping-home',
  'קניות אונליין': 'shopping-online',
  'ביגוד והנעלה': 'clothing',
  'חיות מחמד': 'pets',
  'חופשות ותיירות': 'travel',
  'ביטוח ופיננסים': 'insurance',
  'שירותים ותיקונים': 'services',
  'תרומות ומתנות': 'gifts',
  'חסכון והשקעות': 'savings',
  'אחר': 'other',
  'העברה': 'transfer',
  'לא תקציבי': 'non-budget',
  'חריג': 'exceptional',
  'הכנסה': 'income',
}

const DEFAULT_CATEGORIES = [
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
  { id: 'other', name: 'אחר', nameEn: 'Other', system: true },
  { id: 'transfer', name: 'העברה', nameEn: 'Transfer', system: true },
  { id: 'non-budget', name: 'לא תקציבי', nameEn: 'Non-Budget', system: true },
  { id: 'exceptional', name: 'חריג', nameEn: 'Exceptional', system: true },
  { id: 'income', name: 'הכנסה', nameEn: 'Income', system: true },
]

async function migrateTransactions() {
  console.log('\n--- Migrating Transactions ---')
  const txnRef = db.collection(`families/${FAMILY_ID}/transactions`)
  const snapshot = await txnRef.get()
  let migrated = 0
  let skipped = 0
  let alreadyId = 0

  const batch = db.batch()
  let batchCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const oldCat = data.category || ''

    if (!oldCat) {
      skipped++
      continue
    }

    const newId = LEGACY_NAME_TO_ID[oldCat]
    if (newId) {
      batch.update(doc.ref, { category: newId })
      batchCount++
      migrated++
      if (batchCount >= 450) {
        if (!DRY_RUN) await batch.commit()
        console.log(`  Committed batch of ${batchCount}`)
        batchCount = 0
      }
    } else {
      // Already an ID or unknown
      alreadyId++
    }
  }

  if (batchCount > 0 && !DRY_RUN) {
    await batch.commit()
  }

  console.log(`  Total: ${snapshot.size}`)
  console.log(`  Migrated (Hebrew→ID): ${migrated}`)
  console.log(`  Already ID/unknown: ${alreadyId}`)
  console.log(`  Skipped (empty): ${skipped}`)
}

async function migrateRules() {
  console.log('\n--- Migrating Rules ---')
  const rulesRef = db.collection(`families/${FAMILY_ID}/rules`)
  const snapshot = await rulesRef.get()
  let migrated = 0
  let alreadyId = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const oldCat = data.assign_category || ''
    const newId = LEGACY_NAME_TO_ID[oldCat]

    if (newId) {
      if (!DRY_RUN) {
        await doc.ref.update({ assign_category: newId })
      }
      console.log(`  Rule "${doc.id}": "${oldCat}" → "${newId}"`)
      migrated++
    } else {
      alreadyId++
    }
  }

  console.log(`  Total: ${snapshot.size}, Migrated: ${migrated}, Already ID: ${alreadyId}`)
}

async function migrateBudgets() {
  console.log('\n--- Migrating Category Budgets ---')
  const settingsRef = db.doc(`families/${FAMILY_ID}/family_settings/default`)
  const snap = await settingsRef.get()
  if (!snap.exists) {
    console.log('  No family settings found')
    return
  }

  const data = snap.data()
  const oldBudgets = data.category_budgets || {}
  const newBudgets = {}
  let migrated = 0

  for (const [key, val] of Object.entries(oldBudgets)) {
    const newId = LEGACY_NAME_TO_ID[key]
    if (newId) {
      newBudgets[newId] = val
      migrated++
    } else {
      newBudgets[key] = val // already an ID
    }
  }

  // Also migrate category_name_overrides
  const oldOverrides = data.category_name_overrides || {}
  const newOverrides = {}
  for (const [key, val] of Object.entries(oldOverrides)) {
    const newId = LEGACY_NAME_TO_ID[key]
    if (newId) {
      newOverrides[newId] = val
    } else {
      newOverrides[key] = val
    }
  }

  if (!DRY_RUN) {
    await settingsRef.update({
      category_budgets: newBudgets,
      category_name_overrides: newOverrides,
    })
  }

  console.log(`  Budgets migrated: ${migrated} keys`)
  console.log(`  Budget keys: ${JSON.stringify(Object.keys(newBudgets))}`)
}

async function seedCategories() {
  console.log('\n--- Seeding Default Categories ---')
  const settingsRef = db.doc(`families/${FAMILY_ID}/family_settings/default`)
  const snap = await settingsRef.get()
  const data = snap.exists ? snap.data() : {}

  if (data.categories && data.categories.length > 0) {
    console.log(`  Already has ${data.categories.length} categories, skipping seed`)
    return
  }

  if (!DRY_RUN) {
    await settingsRef.set({ categories: DEFAULT_CATEGORIES }, { merge: true })
  }
  console.log(`  Seeded ${DEFAULT_CATEGORIES.length} default categories`)
}

async function migrateUserPreferences() {
  console.log('\n--- Migrating User Preferences (category_order, pinned) ---')
  const prefsRef = db.collection(`families/${FAMILY_ID}/user_preferences`)
  const snapshot = await prefsRef.get()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const updates = {}

    // Migrate category_order
    if (data.category_order && Array.isArray(data.category_order)) {
      const newOrder = data.category_order.map(c => LEGACY_NAME_TO_ID[c] || c)
      updates.category_order = newOrder
      console.log(`  User ${doc.id}: category_order migrated`)
    }

    // Migrate pinned_categories
    if (data.pinned_categories && Array.isArray(data.pinned_categories)) {
      const newPinned = data.pinned_categories.map(c => LEGACY_NAME_TO_ID[c] || c)
      updates.pinned_categories = newPinned
      console.log(`  User ${doc.id}: pinned_categories migrated`)
    }

    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      await doc.ref.update(updates)
    }
  }
}

// --- Main ---
async function main() {
  console.log(`Category Migration — Family: ${FAMILY_ID}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)

  await migrateTransactions()
  await migrateRules()
  await migrateBudgets()
  await seedCategories()
  await migrateUserPreferences()

  console.log('\n✅ Migration complete!')
  if (DRY_RUN) {
    console.log('   (Dry run — no changes written. Remove --dry-run to execute)')
  }
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
