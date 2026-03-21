/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- Mock firebase-admin ----
jest.mock("firebase-admin", () => {
  const mockDb = {collection: jest.fn()};
  const firestore: any = jest.fn(() => mockDb);
  firestore.FieldValue = {serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")};
  firestore.Timestamp = {fromDate: jest.fn((d: Date) => d.toISOString())};
  return {initializeApp: jest.fn(), firestore};
});

// ---- Mock firebase-functions (pass handler through) ----
jest.mock("firebase-functions", () => ({
  https: {onRequest: jest.fn((handler: any) => handler)},
}));

// ---- Mock rules engine ----
jest.mock("./rules-engine", () => ({
  evaluateRules: jest.fn().mockReturnValue(null),
}));

import * as admin from "firebase-admin";
import {evaluateRules} from "./rules-engine";
import {ingest} from "./index";

const mockEvaluateRules = evaluateRules as jest.Mock;
const db = (admin.firestore as any)() as {collection: jest.Mock};

// ---- Tracking state ----
let setCalls: Array<{docId: string; data: any; options: any}>;
let addCalls: Array<{collection: string; data: any}>;
let existingDocs: Record<string, {data: any}>;
let familyRules: any[];

// ---- Helpers ----
function makeReq(overrides: any = {}): any {
  return {
    method: "POST",
    headers: {authorization: "Bearer test-secret"},
    body: {familyId: "fam-1", transactions: []},
    ...overrides,
  };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function makeTxn(overrides: any = {}): any {
  return {
    uniqueId: "txn-001",
    date: "2025-01-15",
    processedDate: "2025-01-16",
    originalAmount: -100,
    chargedAmount: -100,
    description: "Test Purchase",
    type: "normal",
    ...overrides,
  };
}

async function callIngest(req: any, res: any): Promise<void> {
  await (ingest as any)(req, res);
}

// ---- Setup ----
beforeEach(() => {
  jest.clearAllMocks();
  process.env.INGEST_SECRET = "test-secret";

  setCalls = [];
  addCalls = [];
  existingDocs = {};
  familyRules = [];
  mockEvaluateRules.mockReturnValue(null);

  db.collection.mockImplementation((colName: string) => {
    if (colName === "ingestion_errors") {
      return {
        add: jest.fn((data: any) => {
          addCalls.push({collection: "ingestion_errors", data});
          return Promise.resolve({id: "dlq-id"});
        }),
      };
    }
    if (colName === "families") {
      return {
        doc: jest.fn(() => ({
          collection: jest.fn((subCol: string) => {
            if (subCol === "transactions") {
              return {
                doc: jest.fn((docId: string) => {
                  const existing = existingDocs[docId];
                  return {
                    get: jest.fn(() =>
                      Promise.resolve({
                        exists: !!existing,
                        data: () => existing?.data ?? undefined,
                      })
                    ),
                    set: jest.fn((data: any, options: any) => {
                      setCalls.push({docId, data, options});
                      return Promise.resolve();
                    }),
                  };
                }),
              };
            }
            if (subCol === "ingestion_errors") {
              return {
                add: jest.fn((data: any) => {
                  addCalls.push({collection: "family-dlq", data});
                  return Promise.resolve({id: "family-dlq-id"});
                }),
              };
            }
            if (subCol === "rules") {
              return {
                get: jest.fn(() =>
                  Promise.resolve({
                    docs: familyRules.map((r: any) => ({
                      id: r.id,
                      data: () => ({...r}),
                    })),
                  })
                ),
              };
            }
            return {};
          }),
        })),
      };
    }
    return {};
  });
});

// ---- Tests ----
describe("Ingest HTTP Function", () => {
  // 1. Auth rejection — no header
  test("rejects request with no auth header → 401", async () => {
    const res = makeRes();
    await callIngest(makeReq({headers: {}}), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({error: "Unauthorized"});
  });

  // 2. Auth rejection — wrong token
  test("rejects request with wrong bearer token → 401", async () => {
    const res = makeRes();
    await callIngest(
      makeReq({headers: {authorization: "Bearer wrong-token"}}),
      res
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({error: "Unauthorized"});
  });

  // 3. Method rejection
  test("rejects GET request → 405", async () => {
    const res = makeRes();
    await callIngest(makeReq({method: "GET"}), res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.send).toHaveBeenCalledWith({error: "Method not allowed"});
  });

  // 4. Malformed payload — missing transactions
  test("rejects missing transactions array → 400, writes to DLQ", async () => {
    const res = makeRes();
    await callIngest(makeReq({body: {familyId: "fam-1"}}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      error: "Invalid payload, logged to DLQ",
    });
    expect(addCalls).toHaveLength(1);
    expect(addCalls[0].collection).toBe("ingestion_errors");
    expect(addCalls[0].data.error).toContain("transactions");
  });

  // 5. Missing familyId
  test("rejects missing familyId → 400, writes to DLQ", async () => {
    const res = makeRes();
    await callIngest(makeReq({body: {transactions: []}}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(addCalls).toHaveLength(1);
    expect(addCalls[0].collection).toBe("ingestion_errors");
    expect(addCalls[0].data.error).toContain("familyId");
  });

  // 6. Missing uniqueId on a transaction
  test("skips transaction with missing uniqueId → errors++, writes to family DLQ", async () => {
    const txn = makeTxn();
    delete txn.uniqueId;

    const res = makeRes();
    await callIngest(
      makeReq({body: {familyId: "fam-1", transactions: [txn]}}),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.send.mock.calls[0][0];
    expect(result.errors).toBe(1);
    expect(result.processed).toBe(0);
    expect(addCalls.some((c) => c.collection === "family-dlq")).toBe(true);
    const dlqEntry = addCalls.find((c) => c.collection === "family-dlq")!;
    expect(dlqEntry.data.error).toContain("uniqueId");
  });

  // 7. Tombstone detection — is_split
  test("skips tombstoned transaction (is_split: true) → skipped_split++", async () => {
    existingDocs["txn-split"] = {data: {is_split: true}};

    const res = makeRes();
    await callIngest(
      makeReq({
        body: {
          familyId: "fam-1",
          transactions: [makeTxn({uniqueId: "txn-split"})],
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.send.mock.calls[0][0];
    expect(result.skipped_split).toBe(1);
    expect(result.processed).toBe(0);
    expect(setCalls).toHaveLength(0);
  });

  // 8. User lock protection
  test("skips overwriting user-editable fields when user_locked → skipped_locked++", async () => {
    existingDocs["txn-locked"] = {
      data: {user_locked: true, category: "Manual", status: "auto_categorized"},
    };
    mockEvaluateRules.mockReturnValue({
      ruleId: "rule-1",
      category: "RuleCategory",
      overrideDescription: "Rule Desc",
    });

    const res = makeRes();
    await callIngest(
      makeReq({
        body: {
          familyId: "fam-1",
          transactions: [makeTxn({uniqueId: "txn-locked"})],
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.send.mock.calls[0][0];
    expect(result.skipped_locked).toBe(1);
    expect(result.processed).toBe(1);

    // Doc still written (metadata updated) but user-editable fields excluded
    expect(setCalls).toHaveLength(1);
    const written = setCalls[0].data;
    expect(written).not.toHaveProperty("category");
    expect(written).not.toHaveProperty("override_description");
    expect(written).not.toHaveProperty("applied_rule_id");
    expect(written).not.toHaveProperty("status");
    // Backend metadata IS present
    expect(written).toHaveProperty("description");
    expect(written).toHaveProperty("chargedAmount");
    expect(written).toHaveProperty("source", "moneyman");
  });

  // 9. Normal ingestion with rules applied
  test("processes new transaction with rule match → auto_categorized", async () => {
    mockEvaluateRules.mockReturnValue({
      ruleId: "rule-grocery",
      category: "Groceries",
      overrideDescription: "Shufersal",
    });

    const res = makeRes();
    await callIngest(
      makeReq({body: {familyId: "fam-1", transactions: [makeTxn()]}}),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const result = res.send.mock.calls[0][0];
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    expect(setCalls).toHaveLength(1);
    const written = setCalls[0].data;
    expect(written.category).toBe("Groceries");
    expect(written.override_description).toBe("Shufersal");
    expect(written.applied_rule_id).toBe("rule-grocery");
    expect(written.status).toBe("auto_categorized");
    expect(written.source).toBe("moneyman");
    expect(written.is_split).toBe(false);
    expect(written.hidden_from_ui).toBe(false);
  });

  // 9b. New transaction without rule match gets defaults
  test("processes new transaction without rule match → pending_categorization + defaults", async () => {
    const res = makeRes();
    await callIngest(
      makeReq({body: {familyId: "fam-1", transactions: [makeTxn()]}}),
      res
    );

    expect(setCalls).toHaveLength(1);
    const written = setCalls[0].data;
    expect(written.status).toBe("pending_categorization");
    expect(written.owner_tag).toBe("shared");
    expect(written.user_locked).toBe(false);
    expect(written.source).toBe("moneyman");
  });

  // 10. Idempotency — uniqueId as doc ID, merge:true
  test("uses uniqueId as Firestore doc ID and writes with merge:true", async () => {
    const uid = "2025-02-21_isracard_8101_-129_215531431";
    const res = makeRes();
    await callIngest(
      makeReq({
        body: {familyId: "fam-1", transactions: [makeTxn({uniqueId: uid})]},
      }),
      res
    );

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].docId).toBe(uid);
    expect(setCalls[0].options).toEqual({merge: true});
  });
});
