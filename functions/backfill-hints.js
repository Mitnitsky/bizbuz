#!/usr/bin/env node
/**
 * Backfill categoryHint and memo from raw transaction files into Firestore.
 * Only updates those two fields — does NOT touch category, status, or anything else.
 *
 * Usage: node backfill-hints.js <transactions-file.txt> [--dry-run]
 * Run from the functions/ directory.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ projectId: 'bizbuz-3a473' });
const db = admin.firestore();

const FAMILY_ID = 'zEE5p7TvIFnuIdgpU3Ix';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filePath = args.find(a => !a.startsWith('--'));

  if (!filePath) {
    console.error('Usage: node backfill-hints.js <transactions-file.txt> [--dry-run]');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  const txns = raw.transactions || (Array.isArray(raw) ? raw : []);
  console.log(`Loaded ${txns.length} transactions from ${filePath}`);
  if (dryRun) console.log('DRY RUN — no writes');

  const txnCol = db.collection('families').doc(FAMILY_ID).collection('transactions');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  // Process in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const txn of txns) {
    if (!txn.uniqueId) { skipped++; continue; }

    const hint = txn.category || '';
    const memo = txn.memo || '';

    // Only patch if there's something to add
    if (!hint && !memo) { skipped++; continue; }

    const docRef = txnCol.doc(txn.uniqueId);

    if (dryRun) {
      const snap = await docRef.get();
      if (!snap.exists) { notFound++; continue; }
      const data = snap.data();
      const needsHint = hint && !data.categoryHint;
      const needsMemo = memo && !data.memo;
      if (needsHint || needsMemo) {
        updated++;
        if (updated <= 5) {
          console.log(`  Would update ${txn.uniqueId}: hint=${hint || '(none)'}, memo=${memo || '(none)'}`);
        }
      } else {
        skipped++;
      }
      continue;
    }

    // Live mode: set fields without merge overwriting existing categoryHint/memo
    const update = {};
    if (hint) update.categoryHint = hint;
    if (memo) update.memo = memo;

    batch.set(docRef, update, { merge: true });
    batchCount++;
    updated++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount}`);
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
}

main().catch(console.error);
