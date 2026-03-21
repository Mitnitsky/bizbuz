#!/usr/bin/env node
/**
 * Seed script: loads transactions_test.txt into Firestore.
 * Usage: cd functions && node seed.js [familyId]
 * Uses Firebase client SDK + test user auth (no service account needed).
 */
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, writeBatch, Timestamp } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const fs = require("fs");
const path = require("path");

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
        owner_tag: "shared",
        status: "pending_categorization",
      };

      if (txn.category) data.category = txn.category;
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

  console.log(`Done! ${written} transactions seeded.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
