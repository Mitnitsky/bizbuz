import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {evaluateRules} from "./rules-engine";

admin.initializeApp();
const db = admin.firestore();

interface IngestTransaction {
  uniqueId: string;
  date: string;
  processedDate: string;
  originalAmount: number;
  chargedAmount: number;
  description: string;
  type: string;
  installments?: {number: number; total: number};
  memo?: string;
  category?: string;
  account?: string;
  companyId?: string;
  originalCurrency?: string;
  chargedCurrency?: string;
  hash?: string;
  identifier?: number | string;
  status?: string;
}

interface IngestPayload {
  metadata?: Record<string, unknown>;
  familyId: string;
  transactions: IngestTransaction[];
}

// Ingest endpoint for moneyman scraper integration
export const ingest = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send({error: "Method not allowed"});
    return;
  }

  // Auth check
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.INGEST_SECRET;
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    res.status(401).send({error: "Unauthorized"});
    return;
  }

  let payload: IngestPayload;
  try {
    payload = req.body as IngestPayload;
    if (!payload.familyId || typeof payload.familyId !== "string") {
      throw new Error("Missing or invalid familyId");
    }
    if (!payload.transactions || !Array.isArray(payload.transactions)) {
      throw new Error("Missing or invalid transactions array");
    }
  } catch (err) {
    await db.collection("ingestion_errors").add({
      raw_payload: JSON.stringify(req.body),
      error: (err as Error).message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(400).send({error: "Invalid payload, logged to DLQ"});
    return;
  }

  const familyId = payload.familyId;
  const familyRef = db.collection("families").doc(familyId);
  const txnCol = familyRef.collection("transactions");
  const dlqCol = familyRef.collection("ingestion_errors");

  // Load family-scoped rules
  const rulesSnapshot = await familyRef.collection("rules").get();
  const rules = rulesSnapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));

  // Load payment method → owner mapping
  const settingsSnap = await familyRef
    .collection("family_settings").doc("default").get();
  const paymentMethodOwners: Record<string, string> =
    settingsSnap.exists ? (settingsSnap.data()?.payment_method_owners ?? {}) : {};

  const results = {
    processed: 0,
    skipped_existing: 0,
    skipped_locked: 0,
    skipped_split: 0,
    errors: 0,
  };

  for (const txn of payload.transactions) {
    try {
      if (!txn.uniqueId) {
        await dlqCol.add({
          raw_payload: JSON.stringify(txn),
          error: "Missing uniqueId",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.errors++;
        continue;
      }

      const docRef = txnCol.doc(txn.uniqueId);
      const existingDoc = await docRef.get();

      // Tombstone check: if existing doc is split, drop completely
      if (existingDoc.exists && existingDoc.data()?.is_split === true) {
        results.skipped_split++;
        continue;
      }

      // Hash+identifier dedup: same hash AND same identifier = true duplicate
      // Different identifier with same hash = legit separate charges (keep both)
      if (txn.hash) {
        const hashQuery = await txnCol
          .where("hash", "==", txn.hash)
          .limit(10)
          .get();
        const dupeMatch = hashQuery.docs.find((d) => {
          if (d.id === txn.uniqueId) return false;
          const data = d.data();
          if (data.hidden_from_ui === true) return false;
          // Same hash + same identifier = true dupe (timezone date shift)
          // Same hash + different identifier = legit separate charge
          const sameIdentifier = txn.identifier !== undefined &&
            data.identifier !== undefined &&
            String(data.identifier) === String(txn.identifier);
          if (sameIdentifier) return true;
          // No identifier on either side — fall back to hash-only match
          // but only skip if the existing doc is categorized/locked
          if (txn.identifier === undefined || data.identifier === undefined) {
            return data.user_locked === true ||
              (data.status && data.status !== "pending_categorization");
          }
          return false;
        });
        if (dupeMatch) {
          results.skipped_existing++;
          continue;
        }
      }

      // UniqueId-based dedup: skip if existing doc is categorized/locked (not hidden)
      if (existingDoc.exists) {
        const existing = existingDoc.data()!;
        if (existing.hidden_from_ui !== true) {
          if (existing.user_locked === true) {
            results.skipped_locked++;
            continue;
          }
          if (existing.status && existing.status !== "pending_categorization") {
            results.skipped_existing++;
            continue;
          }
        }
        // hidden_from_ui docs fall through — they get overwritten below
      }

      // Run rules engine
      const ruleResult = evaluateRules(txn as unknown as Record<string, unknown>, rules);

      // Resolve owner from payment method mapping (account is more specific, check first)
      const resolvedOwner =
        (txn.account && paymentMethodOwners[txn.account]) ||
        (txn.companyId && paymentMethodOwners[txn.companyId]) ||
        "shared";

      // Build the document data
      const docData: Record<string, unknown> = {
        date: admin.firestore.Timestamp.fromDate(new Date(txn.date)),
        processedDate: admin.firestore.Timestamp.fromDate(new Date(txn.processedDate)),
        originalAmount: txn.originalAmount,
        chargedAmount: txn.chargedAmount,
        description: txn.description,
        type: txn.type || "normal",
        source: "moneyman",
        is_split: false,
        hidden_from_ui: false,
        last_ingested: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (txn.installments) {
        docData.installments = txn.installments;
      }
      if (txn.memo) {
        docData.memo = txn.memo;
      }
      if (txn.category) {
        docData.categoryHint = txn.category;
      }
      if (txn.account) {
        docData.account = txn.account;
      }
      if (txn.companyId) {
        docData.companyId = txn.companyId;
      }
      if (txn.originalCurrency) {
        docData.originalCurrency = txn.originalCurrency;
      }
      if (txn.chargedCurrency) {
        docData.chargedCurrency = txn.chargedCurrency;
      }
      if (txn.hash) {
        docData.hash = txn.hash;
      }
      if (txn.identifier !== undefined) {
        docData.identifier = txn.identifier;
      }

      // If user_locked, skip overwriting user-editable fields
      if (existingDoc.exists && existingDoc.data()?.user_locked === true) {
        results.skipped_locked++;
        continue;
      } else if (ruleResult) {
        docData.category = ruleResult.category;
        docData.override_description = ruleResult.overrideDescription;
        docData.applied_rule_id = ruleResult.ruleId;
        docData.status = "auto_categorized";
        docData.owner_tag = resolvedOwner;
        docData.user_locked = false;
      } else {
        docData.status = "pending_categorization";
        docData.owner_tag = resolvedOwner;
        docData.user_locked = false;
      }

      // Upsert
      await docRef.set(docData, {merge: true});
      results.processed++;
    } catch (err) {
      await dlqCol.add({
        raw_payload: JSON.stringify(txn),
        error: (err as Error).message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      results.errors++;
    }
  }

  res.status(200).send(results);
});
