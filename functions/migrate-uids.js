#!/usr/bin/env node
/**
 * Migrate Firebase Auth UIDs: copy user docs and update all references.
 * 
 * Usage: node migrate-uids.js [--dry-run]
 * Run from the functions/ directory.
 */

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'bizbuz-3a473' });
const db = admin.firestore();

const FAMILY_ID = 'zEE5p7TvIFnuIdgpU3Ix';

const MIGRATIONS = [
  { old: 'phBIsSOmjmaNegnvNf4Jbe9UvDx2', new: 'l4URjl7PaIcW7MLAXMvzwSmIpi02' },
  { old: '0Tr25g3ar6aQegmKefkTxGVQYBd2', new: 'n2to4r9HcNQgMC963f6tWE3YkG92' },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('=== DRY RUN ===\n');

  const batch = db.batch();

  // 1. Migrate users/{old} → users/{new}
  console.log('1. Migrating user documents...');
  for (const m of MIGRATIONS) {
    const oldDoc = await db.collection('users').doc(m.old).get();
    if (!oldDoc.exists) {
      console.log(`  SKIP users/${m.old} — not found`);
      continue;
    }
    const data = { ...oldDoc.data(), uid: m.new };
    console.log(`  users/${m.old} → users/${m.new} (display: ${data.display_name})`);
    if (!dryRun) {
      batch.set(db.collection('users').doc(m.new), data);
      batch.delete(db.collection('users').doc(m.old));
    }
  }

  // 2. Update family document
  console.log('\n2. Updating family document...');
  const familyRef = db.collection('families').doc(FAMILY_ID);
  const familyDoc = await familyRef.get();
  if (!familyDoc.exists) {
    console.error('Family doc not found!');
    process.exit(1);
  }
  const fam = familyDoc.data();
  
  let memberUids = [...(fam.member_uids || [])];
  let createdBy = fam.created_by;
  let displayNames = { ...(fam.member_display_names || {}) };

  for (const m of MIGRATIONS) {
    // member_uids
    const idx = memberUids.indexOf(m.old);
    if (idx >= 0) {
      memberUids[idx] = m.new;
      console.log(`  member_uids[${idx}]: ${m.old} → ${m.new}`);
    }

    // created_by
    if (createdBy === m.old) {
      createdBy = m.new;
      console.log(`  created_by: ${m.old} → ${m.new}`);
    }

    // member_display_names
    if (displayNames[m.old]) {
      displayNames[m.new] = displayNames[m.old];
      delete displayNames[m.old];
      console.log(`  member_display_names: ${m.old} → ${m.new} (${displayNames[m.new]})`);
    }
  }

  if (!dryRun) {
    batch.update(familyRef, {
      member_uids: memberUids,
      created_by: createdBy,
      member_display_names: displayNames,
    });
  }

  // 3. Migrate user_preferences/{old} → {new}
  console.log('\n3. Migrating user preferences...');
  const prefsCol = db.collection('families').doc(FAMILY_ID).collection('user_preferences');
  for (const m of MIGRATIONS) {
    const oldPref = await prefsCol.doc(m.old).get();
    if (!oldPref.exists) {
      console.log(`  SKIP user_preferences/${m.old} — not found`);
      continue;
    }
    const data = oldPref.data();
    console.log(`  user_preferences/${m.old} → user_preferences/${m.new} (locale: ${data.locale})`);
    if (!dryRun) {
      batch.set(prefsCol.doc(m.new), data);
      batch.delete(prefsCol.doc(m.old));
    }
  }

  // Commit
  if (!dryRun) {
    await batch.commit();
    console.log('\n✅ All migrations committed!');
  } else {
    console.log('\n(dry run — no changes made)');
  }
}

main().catch(console.error);
