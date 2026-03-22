#!/usr/bin/env node
/**
 * Seed script: loads transactions_test.txt into Firestore.
 * Usage: cd functions && node seed.js [familyId]
 * Uses Firebase client SDK + test user auth (no service account needed).
 */
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, writeBatch, setDoc, getDocs, collection, Timestamp, serverTimestamp } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const fs = require("fs");
const path = require("path");

const KNOWN_CATEGORIES = new Set([
  'סופרמרקט ומכולת', 'חשבונות', 'רכב ותחבורה', 'בריאות ופארם', 'ילדים וחינוך', 'משכנתא',
  'מסעדות ובתי קפה', 'מנויים', 'פנאי', 'קניות לבית ולמשפחה', 'קניות אונליין', 'ביגוד והנעלה', 'חיות מחמד',
  'חופשות ותיירות', 'ביטוח ופיננסים', 'שירותים ותיקונים',
  'תרומות ומתנות', 'חסכון והשקעות',
  'לא תקציבי', 'חריג', 'הכנסה',
  'העברה', 'אחר',
]);

const SCRAPER_CATEGORY_MAP = {
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
  'שונות': 'אחר',
};

const PAYMENT_METHOD_OWNERS = {
  "6068": "userA",
  "7763": "userA",
  "8101": "userA",
  "8931": "shared",
  "9029": "shared",
  "9151": "userB",
};

const CARD_COMPANY_IDS = new Set(["isracard", "visaCal", "max"]);

const DEFAULT_BILLING_RULES = [
  { pattern: "ישראכרט", label: "ישראכרט - חיוב כרטיס" },
  { pattern: "כאל", label: "כאל - חיוב כרטיס" },
  { pattern: "לאומי קארד", label: "לאומי קארד - חיוב כרטיס" },
  { pattern: "מקס איט פיננסי", label: "מקס - חיוב כרטיס" },
  { pattern: "אמריקן אקספרס", label: "אמריקן אקספרס - חיוב כרטיס" },
  { pattern: "דיינרס", label: "דיינרס - חיוב כרטיס" },
  { pattern: "הסדר חוב", label: "הסדר חוב" },
];

const FAMILY_ID = process.argv[2] || "zEE5p7TvIFnuIdgpU3Ix";
const DATA_FILE = path.join(__dirname, "..", "transactions_test.txt");
const TEST_EMAIL = "test123@test.com";
const TEST_PASSWORD = "test123@test.com";

const firebaseConfig = {
  apiKey: "AIzaSyA06eeQufVZy4DK-ORpLCamLkVHhMqcEEs",
  authDomain: "bizbuz-3a473.firebaseapp.com",
  projectId: "bizbuz-3a473",
  storageBucket: "bizbuz-3a473.firebasestorage.app",
  messagingSenderId: "873734975774",
  appId: "1:873734975774:web:9a834670a4073a705b990f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  // Authenticate
  console.log(`Signing in as ${TEST_EMAIL}...`);
  await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
  console.log("Authenticated.");

  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  const payload = JSON.parse(raw);
  const transactions = payload.transactions;

  console.log(`Seeding ${transactions.length} transactions into family ${FAMILY_ID}...`);

  const BATCH_SIZE = 400;
  let written = 0;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = transactions.slice(i, i + BATCH_SIZE);

    for (const txn of chunk) {
      if (!txn.uniqueId) continue;

      const docRef = doc(db, "families", FAMILY_ID, "transactions", txn.uniqueId);

      let resolvedCategory = txn.category || "";
      let resolvedStatus = "pending_categorization";

      if (txn.category) {
        if (KNOWN_CATEGORIES.has(txn.category)) {
          resolvedCategory = txn.category;
          resolvedStatus = "auto_categorized";
        } else if (SCRAPER_CATEGORY_MAP[txn.category]) {
          resolvedCategory = SCRAPER_CATEGORY_MAP[txn.category];
          resolvedStatus = "auto_categorized";
        }
      }

      const data = {
        date: Timestamp.fromDate(new Date(txn.date)),
        processedDate: Timestamp.fromDate(new Date(txn.processedDate)),
        originalAmount: txn.originalAmount,
        chargedAmount: txn.chargedAmount,
        description: txn.description,
        type: txn.type || "normal",
        source: "moneyman",
        is_split: false,
        hidden_from_ui: false,
        user_locked: false,
        owner_tag: (txn.account && PAYMENT_METHOD_OWNERS[txn.account]) ||
                   (txn.companyId && PAYMENT_METHOD_OWNERS[txn.companyId]) ||
                   "shared",
        status: resolvedStatus,
      };

      if (resolvedCategory) data.category = resolvedCategory;
      if (txn.memo) data.memo = txn.memo;
      if (txn.account) data.account = txn.account;
      if (txn.companyId) data.companyId = txn.companyId;
      if (txn.originalCurrency) data.originalCurrency = txn.originalCurrency;
      if (txn.chargedCurrency) data.chargedCurrency = txn.chargedCurrency;
      if (txn.hash) data.hash = txn.hash;
      if (txn.identifier !== undefined) data.identifier = txn.identifier;
      if (txn.installments) data.installments = txn.installments;

      batch.set(docRef, data, { merge: true });
    }

    await batch.commit();
    written += chunk.length;
    console.log(`  Written ${written}/${transactions.length}`);
  }

  // Seed default billing rules if none exist
  const rulesCol = collection(db, "families", FAMILY_ID, "rules");
  const existingRules = await getDocs(rulesCol);
  if (existingRules.empty) {
    console.log("Seeding default billing rules...");
    for (const r of DEFAULT_BILLING_RULES) {
      const ruleRef = doc(rulesCol);
      await setDoc(ruleRef, {
        conditions: [
          { field: "description", operator: "contains", value: r.pattern },
          { field: "companyId", operator: "not_in", value: "isracard,visaCal,max" },
        ],
        action_category: "לא תקציבי",
        action_override_description: r.label,
        created_at: serverTimestamp(),
        is_default: true,
      });
    }
    console.log(`  Seeded ${DEFAULT_BILLING_RULES.length} default rules.`);
  } else {
    console.log(`Rules already exist (${existingRules.size}), skipping default rules.`);
  }

  console.log(`Done! ${written} transactions seeded.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
