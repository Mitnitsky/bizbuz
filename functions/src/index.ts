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

  const results = {
    processed: 0,
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

      // Run rules engine
      const ruleResult = evaluateRules(txn as unknown as Record<string, unknown>, rules);

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
      } else {
        if (ruleResult) {
          docData.category = ruleResult.category;
          docData.override_description = ruleResult.overrideDescription;
          docData.applied_rule_id = ruleResult.ruleId;
          docData.status = "auto_categorized";
        } else {
          docData.status = existingDoc.exists
            ? existingDoc.data()?.status || "pending_categorization"
            : "pending_categorization";
          if (!existingDoc.exists) {
            docData.owner_tag = "shared";
            docData.user_locked = false;
          }
        }
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
