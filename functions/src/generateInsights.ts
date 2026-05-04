/**
 * AI Insights Generator — daily scheduled job.
 *
 * Produces 5 Hebrew financial insights per family per day using the validated
 * V5 strategy: best-of-3 candidates with judge selection + deterministic facts.
 *
 * Schedule: 15:00 Asia/Jerusalem (3pm Israel time).
 * Storage: families/{familyId}/insights/{cycleKey}
 *
 * Trigger: onSchedule (daily). Idempotent — re-running on same day overwrites
 * the doc with fresh insights (cycle-progress days change, so re-run is useful).
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { computeCycleRange, computeIncomeWindow, cycleKey, todayInIsrael, israelDateOnly } from "./cycleMath";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const MODEL = "gemini-3.1-pro-preview";
const N_CANDIDATES = 3;
const PROMPT_VERSION = "v6.1";
const GENERATOR_VERSION = 2;

const EXCLUDED_FROM_SPEND = new Set(["transfer", "exceptional", "non-budget", "income"]);

interface RawTxn {
  id: string;
  date: Date;
  chargedAmount: number;
  description: string;
  category: string;
  hidden_from_ui: boolean;
}

interface CycleSummary {
  name: string;
  range: string;
  inProgress: boolean;
  daysElapsed?: number;
  daysTotal?: number;
  spend: number;
  income: number;
  txnCount: number;
  categories: Record<string, number>;
  topMerchants: Array<[string, number]>;
  topTxns: Array<{ amt: number; desc: string; cat: string; date: string }>;
}

interface LocalizedText {
  he: string;
  en: string;
}

/** Final shape stored in Firestore / consumed by the frontend. */
interface Insight {
  id: string;
  severity: "alert" | "warn" | "good" | "info";
  icon: string;
  title: LocalizedText;
  body: LocalizedText;
  categoryId?: string | null;
  amount?: number | null;
}

/** Intermediate shape produced by the English generation step. */
interface EnglishInsight {
  id: string;
  severity: "alert" | "warn" | "good" | "info";
  icon: string;
  title: string;
  body: string;
  categoryId?: string | null;
  amount?: number | null;
}

interface CandidateResult {
  insights?: EnglishInsight[];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error?: string;
}

const SYSTEM_PROMPT = `You are a sharp family financial analyst. Output 5 specific English financial insights ranked by importance. The output will later be translated to Hebrew, so write English a translator can faithfully render.

Rules:
- Title ≤60 chars, body ≤180 chars (1-2 sentences). Real numbers only.
- English only at this stage. No exclamation marks. No generic advice.
- Preserve Hebrew proper nouns (merchant names like "מופ\\"ת מילואים", "פועלים-משכנתא", "מכבי") AS-IS — do NOT transliterate or translate them. The Hebrew translator will keep them; the English version should use them verbatim too so the user recognises them.
- Currency symbol ₪ is preferred (works in both languages).
- Categories transfer/exceptional/non-budget/income are EXCLUDED from spend totals.
- severity: alert | warn | good | info. icon: single emoji.

Look for (priority order):
1. Multi-cycle TRENDS visible across all 4 cycles — these are the BIG-PICTURE stories.
2. Data quality issues (miscategorized transactions, especially recurring patterns).
3. Material category changes (>30% AND >₪500). When driven by a single one-off, frame as "one-off, baseline stable" — not as a trend.
4. Use the DETERMINISTIC FACTS block as authoritative. Do NOT contradict facts there.

CRITICAL anti-hallucination rules:
- NEVER claim ANY merchant payment is "missing", "delayed", "expected", "should have appeared", "not yet seen", or any synonym — UNLESS that exact merchant appears in facts.recurringMerchants with status="missing_in_current". This rule applies to EVERY merchant including online shopping (IHERB, TEMU, AliExpress, Amazon), drugstores (Super-Pharm, סופר פארם), supermarkets, restaurants, and any retail. These are NOT recurring even if the user buys from them most months.
- The facts.recurringMerchants list is COMPLETE — anything not on it is either not recurring or not yet flagged. Do not invent entries. Do not infer "recurring" patterns from the cycle summaries — only the facts block is authoritative.
- If facts.recurringMerchants[i].status="upcoming_in_current", the charge is EXPECTED soon, NOT missed. Frame positively or skip.
- Do not invent merchant names, amounts, or dates that are not present in the data blocks above.
- "Recurring" means: fixed monthly bills with a stable amount and date (mortgage, rent, utilities, insurance, gym, subscriptions, salary). Variable retail/shopping is NEVER recurring even if frequent.

Strictly avoid:
- Contradicting deterministic facts (e.g., if facts say a payment is "upcoming", don't claim it's "missing")
- Repeating insights with different framing
- Praising one-cycle drops without checking if prior cycle had a one-off cause`;

const INSIGHTS_SCHEMA = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          severity: { type: "string", enum: ["alert", "warn", "good", "info"] },
          icon: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          categoryId: { type: "string", nullable: true },
          amount: { type: "number", nullable: true },
        },
        required: ["id", "severity", "icon", "title", "body"],
      },
    },
  },
  required: ["insights"],
};

const TRANSLATE_SYSTEM = `You are a professional translator specialised in financial Hebrew. Translate the given English financial insights to natural, idiomatic Hebrew suitable for a personal-finance app UI.

Rules:
- Match the source's factual content EXACTLY (numbers, ₪ symbol, dates, merchant names).
- Preserve any Hebrew text in the English source AS-IS (merchant names like "פועלים-משכנתא", "מופ\\"ת מילואים", "מכבי" are already in Hebrew — keep them verbatim).
- Hebrew title ≤60 chars, body ≤200 chars (Hebrew is more compact than English; keep it concise).
- No exclamation marks. No generic advice.
- Preserve the same id mapping so each Hebrew translation lines up with its English source.

Output JSON: { translations: [{ id: string, title: string, body: string }] }`;

const TRANSLATE_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["id", "title", "body"],
      },
    },
  },
  required: ["translations"],
};

const JUDGE_SYSTEM = `You are a strict financial-insight judge. Given multiple candidate sets of 5 English financial insights generated from the same data, pick the BEST one. (The winner will be translated to Hebrew downstream — judge purely on content quality.)

Scoring criteria (0-10 each):
- accuracy: factually correct, no hallucinations, respects deterministic facts. HEAVILY PENALIZE any insight claiming a merchant payment is "missing", "delayed", "expected", or hasn't appeared yet UNLESS that merchant is explicitly flagged status="missing_in_current" in facts.recurringMerchants. Online shopping, retail, drugstores, restaurants are NEVER recurring — calling out their absence is a hallucination.
- specificity: real numbers, merchants, dates (not vague)
- actionability: each insight tells user something concrete they can use
- prioritization: most important insights first, no redundancy
- coverage: covers diverse aspects (trend, anomaly, miscategorization, etc.) without repetition

Output JSON: { winnerIndex: <0-based index>, scores: [{candidateIndex, accuracy, specificity, actionability, prioritization, coverage, total, comments}] }`;

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    winnerIndex: { type: "integer" },
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidateIndex: { type: "integer" },
          accuracy: { type: "integer" },
          specificity: { type: "integer" },
          actionability: { type: "integer" },
          prioritization: { type: "integer" },
          coverage: { type: "integer" },
          total: { type: "integer" },
          comments: { type: "string" },
        },
        required: ["candidateIndex", "accuracy", "specificity", "actionability", "prioritization", "coverage", "total", "comments"],
      },
    },
  },
  required: ["winnerIndex", "scores"],
};

function validateEnglishInsight(obj: unknown): obj is EnglishInsight {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.severity === "string" &&
    ["alert", "warn", "good", "info"].includes(o.severity) &&
    typeof o.icon === "string" &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    o.title.length > 0 && o.title.length <= 100 &&
    o.body.length > 0 && o.body.length <= 280
  );
}

function validateInsightsArray(v: unknown): v is { insights: EnglishInsight[] } {
  if (!v || typeof v !== "object") return false;
  const obj = v as { insights?: unknown };
  if (!Array.isArray(obj.insights)) return false;
  if (obj.insights.length < 3 || obj.insights.length > 8) return false;
  return obj.insights.every(validateEnglishInsight);
}

function validateTranslations(v: unknown): v is { translations: Array<{ id: string; title: string; body: string }> } {
  if (!v || typeof v !== "object") return false;
  const obj = v as { translations?: unknown };
  if (!Array.isArray(obj.translations)) return false;
  return obj.translations.every((t) => {
    if (!t || typeof t !== "object") return false;
    const o = t as Record<string, unknown>;
    return (
      typeof o.id === "string" &&
      typeof o.title === "string" && o.title.length > 0 && o.title.length <= 120 &&
      typeof o.body === "string" && o.body.length > 0 && o.body.length <= 320
    );
  });
}

/** Compute spend (excluding transfer/exceptional/non-budget/income) for txns in date range. */
function summarizeCycle(
  cycleName: string,
  txns: RawTxn[],
  range: { start: Date; end: Date },
  inProgress: boolean,
  daysElapsed?: number,
  daysTotal?: number,
): CycleSummary {
  const cTxns = txns.filter((t) => !t.hidden_from_ui && t.date >= range.start && t.date <= range.end);
  const cats: Record<string, number> = {};
  const merchants: Record<string, number> = {};
  let spend = 0;
  const topTxns: Array<{ amt: number; desc: string; cat: string; date: string }> = [];

  for (const t of cTxns) {
    const amt = t.chargedAmount;
    const cat = t.category || "(none)";
    if (amt < 0 && !EXCLUDED_FROM_SPEND.has(cat)) {
      spend += -amt;
      cats[cat] = (cats[cat] || 0) + -amt;
      const m = (t.description || "").trim();
      if (m) merchants[m] = (merchants[m] || 0) + -amt;
      topTxns.push({ amt: -amt, desc: m, cat, date: t.date.toISOString().slice(0, 10) });
    }
  }
  topTxns.sort((a, b) => b.amt - a.amt);

  return {
    name: cycleName,
    range: `${range.start.toISOString().slice(0, 10)} → ${range.end.toISOString().slice(0, 10)}`,
    inProgress,
    daysElapsed,
    daysTotal,
    spend: Math.round(spend),
    income: 0, // computed separately to match client logic
    txnCount: cTxns.length,
    categories: Object.fromEntries(
      Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, Math.round(v)])
    ),
    topMerchants: Object.entries(merchants)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => [k, Math.round(v)] as [string, number]),
    topTxns: topTxns.slice(0, 8),
  };
}

/**
 * Compute income for a cycle using the SAME logic as src/stores/transactions.ts
 * `getIncomeForCycle`. Server numbers must match what the user sees in the app.
 */
function computeIncomeForCycle(
  txns: RawTxn[],
  today: Date,
  cycleStartDay: number,
  cycleOffset: number,
  incomeAnchorDay: number | null,
  incomeAnchorGraceDays: number,
): number {
  const range = computeCycleRange(today, cycleStartDay, cycleOffset);

  if (incomeAnchorDay === null && incomeAnchorGraceDays === 0) {
    const inCycle = txns.filter((t) => !t.hidden_from_ui && t.date >= range.start && t.date <= range.end && t.chargedAmount > 0);
    return inCycle.reduce((s, t) => s + t.chargedAmount, 0);
  }

  const incomeWin = computeIncomeWindow(range.start, incomeAnchorDay, incomeAnchorGraceDays);
  const nextRange = computeCycleRange(today, cycleStartDay, cycleOffset + 1);
  const nextIncomeWin = computeIncomeWindow(nextRange.start, incomeAnchorDay, incomeAnchorGraceDays);

  const incomeTxns = txns.filter((t) => {
    if (t.hidden_from_ui || t.chargedAmount <= 0) return false;
    const d = t.date;
    if (d >= nextIncomeWin.start && d <= nextIncomeWin.end) return false;
    if (d >= range.start && d <= range.end) return true;
    return d >= incomeWin.start && d < range.start;
  });

  const seen = new Set<string>();
  let total = 0;
  for (const t of incomeTxns) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    total += t.chargedAmount;
  }
  return total;
}

/** Detect recurring merchants and emit deterministic facts the LLM can't override. */
function buildFacts(
  txns: RawTxn[],
  cycles: Array<{ name: string; range: { start: Date; end: Date }; inProgress?: boolean; daysElapsed?: number; daysTotal?: number }>,
): Record<string, unknown> {
  const today = todayInIsrael();
  const current = cycles[0];

  // Group transactions by normalized description
  const merchantCycleMap = new Map<string, Map<string, { amts: number[]; dates: Date[] }>>();
  for (const t of txns) {
    if (t.hidden_from_ui || t.chargedAmount >= 0) continue;
    const desc = (t.description || "").trim();
    if (!desc) continue;
    const cycle = cycles.find((c) => t.date >= c.range.start && t.date <= c.range.end);
    if (!cycle) continue;
    if (!merchantCycleMap.has(desc)) merchantCycleMap.set(desc, new Map());
    const cycMap = merchantCycleMap.get(desc)!;
    if (!cycMap.has(cycle.name)) cycMap.set(cycle.name, { amts: [], dates: [] });
    const entry = cycMap.get(cycle.name)!;
    entry.amts.push(-t.chargedAmount);
    entry.dates.push(t.date);
  }

  const recurring: Array<{
    merchant: string;
    historicalAvg: number;
    presentInCycles: string[];
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    status: "missing_in_current" | "upcoming_in_current" | "paid_current" | "stable";
    daysSinceLastPayment?: number;
  }> = [];

  for (const [merchant, cycMap] of merchantCycleMap) {
    const completedCycles = cycles.slice(1).filter((c) => cycMap.has(c.name));
    if (completedCycles.length < 2) continue; // need at least 2 prior cycles for "recurring"

    const totalAmts: number[] = [];
    let totalCount = 0;
    for (const c of cycles.slice(1)) {
      const e = cycMap.get(c.name);
      if (e) {
        totalAmts.push(...e.amts);
        totalCount += e.amts.length;
      }
    }
    if (totalCount < 2) continue;

    // Skip merchants with extreme amount variance (not truly recurring)
    const avg = totalAmts.reduce((s, a) => s + a, 0) / totalAmts.length;
    const stable = totalAmts.every((a) => Math.abs(a - avg) / avg < 0.4);
    if (!stable) continue;
    if (avg < 100) continue; // skip noise

    // Find last payment across all data
    const allEntries = Array.from(cycMap.values()).flatMap((e) =>
      e.dates.map((d, i) => ({ date: d, amt: e.amts[i] }))
    );
    allEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
    const last = allEntries[0];

    const presentInCycles = cycles.filter((c) => cycMap.has(c.name)).map((c) => c.name);

    // Determine status for current cycle
    let status: "missing_in_current" | "upcoming_in_current" | "paid_current" | "stable" = "stable";
    let daysSinceLastPayment: number | undefined;
    if (current && last) {
      daysSinceLastPayment = Math.floor((today.getTime() - last.date.getTime()) / 86400000);
      const paidInCurrent = cycMap.has(current.name);
      if (paidInCurrent) {
        status = "paid_current";
      } else {
        // Compute typical day-of-cycle for past payments
        const typicalDays: number[] = [];
        for (const c of cycles.slice(1)) {
          const e = cycMap.get(c.name);
          if (!e) continue;
          for (const d of e.dates) {
            typicalDays.push(Math.floor((d.getTime() - c.range.start.getTime()) / 86400000));
          }
        }
        const avgDayOfCycle = typicalDays.length
          ? typicalDays.reduce((s, x) => s + x, 0) / typicalDays.length
          : null;
        const currentDayOfCycle = Math.floor((today.getTime() - current.range.start.getTime()) / 86400000);
        if (avgDayOfCycle !== null && currentDayOfCycle > avgDayOfCycle + 3) {
          // Past expected day → missing
          // But if 2+ consecutive prior cycles also missing, this is a permanent stop
          const consecutiveMissing = cycles.slice(1, 3).filter((c) => !cycMap.has(c.name)).length;
          if (consecutiveMissing >= 2) {
            status = "missing_in_current";
            // override merchant status to reflect long-term stop
          } else {
            status = "missing_in_current";
          }
        } else {
          status = "upcoming_in_current";
        }
      }
    }

    recurring.push({
      merchant,
      historicalAvg: Math.round(avg),
      presentInCycles,
      lastPaymentDate: last?.date.toISOString().slice(0, 10),
      lastPaymentAmount: last ? Math.round(last.amt) : undefined,
      status,
      daysSinceLastPayment,
    });
  }

  // Sort by significance: missing > upcoming > paid, then by amount
  recurring.sort((a, b) => {
    const order = { missing_in_current: 0, upcoming_in_current: 1, paid_current: 2, stable: 3 };
    const oa = order[a.status] ?? 4;
    const ob = order[b.status] ?? 4;
    if (oa !== ob) return oa - ob;
    return b.historicalAvg - a.historicalAvg;
  });

  const cycleProgress = current?.inProgress
    ? {
      daysElapsed: current.daysElapsed,
      daysTotal: current.daysTotal,
      daysRemaining: (current.daysTotal ?? 0) - (current.daysElapsed ?? 0),
      pctElapsed: current.daysTotal ? Math.round(((current.daysElapsed ?? 0) / current.daysTotal) * 100) : 0,
    }
    : undefined;

  return {
    today: today.toISOString().slice(0, 10),
    cycleProgress,
    // Send the FULL detected list (not truncated) so the prompt's
    // "the list is COMPLETE" anti-hallucination rule is actually true.
    recurringMerchants: recurring,
  };
}

async function generateCandidate(
  apiKey: string,
  userPrompt: string,
  seed: number,
  retry = true,
): Promise<CandidateResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: INSIGHTS_SCHEMA as never,
      temperature: 0.3,
    },
  });
  const t0 = Date.now();
  try {
    const result = await model.generateContent(userPrompt + `\n\n[Generation seed: ${seed}]`);
    const text = result.response.text();
    const usage = result.response.usageMetadata;
    const parsed = JSON.parse(text);
    if (!validateInsightsArray(parsed)) {
      throw new Error("Schema validation failed");
    }
    return {
      insights: parsed.insights,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - t0,
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (retry) {
      console.warn(`Candidate seed=${seed} failed (${msg}), retrying once`);
      return generateCandidate(apiKey, userPrompt, seed + 1000, false);
    }
    return { error: msg, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - t0 };
  }
}

interface JudgeResult {
  winnerIndex: number;
  scores: Array<{
    candidateIndex: number;
    accuracy: number; specificity: number; actionability: number; prioritization: number; coverage: number;
    total: number; comments: string;
  }>;
  inputTokens: number;
  outputTokens: number;
}

async function judgeCandidates(
  apiKey: string,
  facts: Record<string, unknown>,
  summaries: CycleSummary[],
  candidates: EnglishInsight[][],
): Promise<JudgeResult | null> {
  if (candidates.length === 1) {
    return {
      winnerIndex: 0,
      scores: [{
        candidateIndex: 0, accuracy: 0, specificity: 0, actionability: 0, prioritization: 0, coverage: 0,
        total: 0, comments: "single candidate, no judging",
      }],
      inputTokens: 0, outputTokens: 0,
    };
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const judge = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: JUDGE_SYSTEM,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: JUDGE_SCHEMA as never,
      temperature: 0.1,
    },
  });
  const judgeInput = `Source data:
${JSON.stringify({ summaries, facts }, null, 2)}

CANDIDATES:
${candidates.map((c, i) => `=== Candidate ${i} ===
${c.map((ins, j) => `${j + 1}. [${ins.severity}] ${ins.icon} ${ins.title}\n   ${ins.body}`).join("\n")}`).join("\n\n")}

Pick the winner. Return JSON.`;
  try {
    const result = await judge.generateContent(judgeInput);
    const text = result.response.text();
    const usage = result.response.usageMetadata;
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || typeof parsed.winnerIndex !== "number" ||
        parsed.winnerIndex < 0 || parsed.winnerIndex >= candidates.length) {
      throw new Error("Judge output invalid");
    }
    return {
      winnerIndex: parsed.winnerIndex,
      scores: parsed.scores ?? [],
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  } catch (e) {
    console.warn("Judge failed:", (e as Error).message);
    return null;
  }
}

function pickFallbackWinner(candidates: EnglishInsight[][]): number {
  // Pick the candidate with the most distinct severities (proxy for coverage)
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const sevs = new Set(candidates[i].map((ins) => ins.severity));
    const lenBonus = Math.min(candidates[i].length, 5) * 0.5;
    const score = sevs.size + lenBonus;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

interface TranslationResult {
  insights: Insight[];
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

/**
 * Translate the winning English insights to Hebrew via a single batch call,
 * then merge into the bilingual Insight[] shape stored in Firestore.
 *
 * On failure, falls back to the English text in both fields so the user
 * still sees something — the doc remains queryable and renderable.
 */
async function translateToHebrew(
  apiKey: string,
  englishInsights: EnglishInsight[],
): Promise<TranslationResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const translator = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: TRANSLATE_SYSTEM,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TRANSLATE_SCHEMA as never,
      temperature: 0.1,
    },
  });
  const input = `Translate these ${englishInsights.length} English financial insights to Hebrew.\nPreserve numbers and any Hebrew merchant names verbatim.\n\nSOURCE:\n${JSON.stringify(englishInsights.map((i) => ({ id: i.id, title: i.title, body: i.body })), null, 2)}`;

  try {
    const result = await translator.generateContent(input);
    const text = result.response.text();
    const usage = result.response.usageMetadata;
    const parsed = JSON.parse(text);
    if (!validateTranslations(parsed)) {
      throw new Error("Translation schema validation failed");
    }
    const byId = new Map(parsed.translations.map((t) => [t.id, t]));
    const merged: Insight[] = englishInsights.map((eng, idx) => {
      const tr = byId.get(eng.id) ?? parsed.translations[idx];
      const heTitle = tr?.title?.trim() || eng.title;
      const heBody = tr?.body?.trim() || eng.body;
      return {
        id: eng.id,
        severity: eng.severity,
        icon: eng.icon,
        title: { en: eng.title, he: heTitle },
        body: { en: eng.body, he: heBody },
        ...(eng.categoryId !== undefined ? { categoryId: eng.categoryId } : {}),
        ...(eng.amount !== undefined ? { amount: eng.amount } : {}),
      };
    });
    return {
      insights: merged,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  } catch (e) {
    console.warn("Translation failed, falling back to English-only:", (e as Error).message);
    const fallback: Insight[] = englishInsights.map((eng) => ({
      id: eng.id,
      severity: eng.severity,
      icon: eng.icon,
      title: { en: eng.title, he: eng.title },
      body: { en: eng.body, he: eng.body },
      ...(eng.categoryId !== undefined ? { categoryId: eng.categoryId } : {}),
      ...(eng.amount !== undefined ? { amount: eng.amount } : {}),
    }));
    return {
      insights: fallback,
      inputTokens: 0,
      outputTokens: 0,
      error: (e as Error).message,
    };
  }
}

interface GenerateInsightsResult {
  status: "ok" | "skipped_no_data" | "failed";
  cycleKey?: string;
  insightsCount?: number;
  cost?: number;
  error?: string;
  debugFacts?: Record<string, unknown>;
  debugSummaries?: CycleSummary[];
}

async function generateInsightsForFamily(
  db: admin.firestore.Firestore,
  familyId: string,
  apiKey: string,
  debug = false,
  source: "scheduled" | "manual" = "scheduled",
): Promise<GenerateInsightsResult> {
  const familyRef = db.collection("families").doc(familyId);

  // Load family settings
  const settingsSnap = await familyRef.collection("family_settings").doc("default").get();
  if (!settingsSnap.exists) {
    return { status: "skipped_no_data", error: "no family_settings/default" };
  }
  const settings = settingsSnap.data() ?? {};
  const cycleStartDay = (settings.cycle_start_day as number) ?? 1;
  const incomeAnchorDay = (settings.income_anchor_day as number | null) ?? null;
  const incomeAnchorGraceDays = (settings.income_anchor_grace_days as number) ?? 3;
  const aiInsightsEnabled = settings.ai_insights_enabled !== false; // default ON
  if (!aiInsightsEnabled) {
    return { status: "skipped_no_data", error: "ai_insights_enabled=false" };
  }

  const today = todayInIsrael();

  // Build 4 cycles: current + 3 prior
  const cycleDefs = [0, -1, -2, -3].map((offset, idx) => {
    const range = computeCycleRange(today, cycleStartDay, offset);
    const totalDays = Math.floor((range.end.getTime() - range.start.getTime()) / 86400000) + 1;
    const elapsed = Math.min(totalDays, Math.max(0, Math.floor((today.getTime() - range.start.getTime()) / 86400000) + 1));
    return {
      name: idx === 0 ? "current" : `prev${idx === 1 ? "" : idx}`,
      range,
      offset,
      inProgress: idx === 0,
      daysElapsed: idx === 0 ? elapsed : undefined,
      daysTotal: idx === 0 ? totalDays : undefined,
    };
  });

  const oldestStart = cycleDefs[cycleDefs.length - 1].range.start;

  // Bounded query: only fetch transactions in our 4-cycle window (+ 14 day buffer for income anchor)
  const queryStart = new Date(oldestStart);
  queryStart.setDate(queryStart.getDate() - 14);

  const txnSnap = await familyRef.collection("transactions")
    .where("date", ">=", admin.firestore.Timestamp.fromDate(queryStart))
    .get();

  const txns: RawTxn[] = txnSnap.docs.map((d) => {
    const data = d.data();
    const dateField = data.date;
    const rawDate: Date = dateField instanceof admin.firestore.Timestamp ? dateField.toDate() : new Date(dateField);
    // Normalize to Israel-local DATE so comparisons against cycle ranges (built from
    // local date components) work regardless of where the function executes (UTC server).
    const date = israelDateOnly(rawDate);
    return {
      id: d.id,
      date,
      chargedAmount: data.chargedAmount ?? 0,
      description: data.description ?? "",
      category: data.category ?? "",
      hidden_from_ui: data.hidden_from_ui === true,
    };
  });

  console.log(`[insights/${familyId}] loaded ${txns.length} txns for window ${queryStart.toISOString().slice(0, 10)} → ${today.toISOString().slice(0, 10)}`);

  if (txns.length < 5) {
    return { status: "skipped_no_data", error: `only ${txns.length} transactions in window` };
  }

  // Build summaries
  const summaries: CycleSummary[] = cycleDefs.map((cd) => {
    const summary = summarizeCycle(cd.name, txns, cd.range, cd.inProgress, cd.daysElapsed, cd.daysTotal);
    summary.income = Math.round(computeIncomeForCycle(
      txns, today, cycleStartDay, cd.offset, incomeAnchorDay, incomeAnchorGraceDays
    ));
    return summary;
  });

  // Build deterministic facts
  const facts = buildFacts(txns, cycleDefs);

  const userPrompt = `=== DETERMINISTIC FACTS (authoritative — do not contradict) ===
${JSON.stringify(facts, null, 2)}

=== CYCLES ===
${summaries.map((s) => `### ${s.name}${s.inProgress ? ` (IN PROGRESS — ${s.daysElapsed}/${s.daysTotal} days, ${(s.daysTotal ?? 0) - (s.daysElapsed ?? 0)} days left)` : ""}
Range: ${s.range}
Total spend: ₪${s.spend.toLocaleString()} | Income: ₪${s.income.toLocaleString()} | Txns: ${s.txnCount}
Categories: ${JSON.stringify(s.categories)}
Top merchants: ${s.topMerchants.map(([m, v]) => `${m}=₪${v}`).join(", ")}
Top transactions:
${s.topTxns.map((t) => `  - ₪${t.amt} ${t.date} [${t.cat}] ${t.desc}`).join("\n")}
`).join("\n")}

4-cycle trend (oldest→newest):
- Spend: ${[summaries[3].spend, summaries[2].spend, summaries[1].spend, summaries[0].spend].join(" → ")}
- Income: ${[summaries[3].income, summaries[2].income, summaries[1].income, summaries[0].income].join(" → ")}

Today: ${today.toISOString().slice(0, 10)}.

Output 5 insights as JSON.`;

  // Generate N candidates in parallel
  const candidates = await Promise.all(
    Array.from({ length: N_CANDIDATES }, (_, i) => generateCandidate(apiKey, userPrompt, i + 1))
  );

  const validCandidates = candidates.filter((c) => !c.error && c.insights);
  console.log(`[insights/${familyId}] ${validCandidates.length}/${N_CANDIDATES} candidates valid`);

  if (validCandidates.length === 0) {
    return { status: "failed", error: "all candidates failed: " + candidates.map((c) => c.error).join("; ") };
  }

  // Judge phase (English)
  const candidateInsights = validCandidates.map((c) => c.insights as EnglishInsight[]);
  let winnerIdx = 0;
  let winnerScore: JudgeResult["scores"][0] | null = null;
  let judgeIn = 0;
  let judgeOut = 0;

  if (validCandidates.length > 1) {
    const judgeRes = await judgeCandidates(apiKey, facts, summaries, candidateInsights);
    if (judgeRes) {
      winnerIdx = judgeRes.winnerIndex;
      winnerScore = judgeRes.scores.find((s) => s.candidateIndex === winnerIdx) ?? null;
      judgeIn = judgeRes.inputTokens;
      judgeOut = judgeRes.outputTokens;
      console.log(`[insights/${familyId}] judge picked candidate ${winnerIdx}, score ${winnerScore?.total ?? "?"}/50`);
    } else {
      winnerIdx = pickFallbackWinner(candidateInsights);
      console.log(`[insights/${familyId}] judge failed, fallback picked candidate ${winnerIdx}`);
    }
  }

  const englishWinner = candidateInsights[winnerIdx];

  // Translate to Hebrew (last step)
  const translation = await translateToHebrew(apiKey, englishWinner);
  if (translation.error) {
    console.warn(`[insights/${familyId}] translation degraded: ${translation.error}`);
  } else {
    console.log(`[insights/${familyId}] translated to Hebrew (${translation.inputTokens} in / ${translation.outputTokens} out)`);
  }
  const winner = translation.insights;

  const totalIn = validCandidates.reduce((s, c) => s + c.inputTokens, 0) + judgeIn + translation.inputTokens;
  const totalOut = validCandidates.reduce((s, c) => s + c.outputTokens, 0) + judgeOut + translation.outputTokens;
  const cost = totalIn * 1.25 / 1e6 + totalOut * 10 / 1e6; // gemini-3.1-pro pricing

  const currentCycle = cycleDefs[0];
  const cycKey = cycleKey(currentCycle.range.start);

  await familyRef.collection("insights").doc(cycKey).set({
    insights: winner,
    dismissedIds: [],
    cycleStart: admin.firestore.Timestamp.fromDate(currentCycle.range.start),
    cycleEnd: admin.firestore.Timestamp.fromDate(currentCycle.range.end),
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    generatorVersion: GENERATOR_VERSION,
    candidatesCount: validCandidates.length,
    winnerScore: winnerScore ?? null,
    translationDegraded: translation.error ? translation.error : null,
    costUsd: Number(cost.toFixed(5)),
    totalInputTokens: totalIn,
    totalOutputTokens: totalOut,
    source,
  });

  return {
    status: "ok",
    cycleKey: cycKey,
    insightsCount: winner.length,
    cost,
    ...(debug ? { debugFacts: facts, debugSummaries: summaries } : {}),
  };
}

/**
 * Daily scheduled job: 15:00 Asia/Jerusalem (3pm Israel time).
 * Iterates all families with ai_insights_enabled (default true), generates fresh insights.
 */
export const generateInsightsDaily = onSchedule({
  schedule: "0 15 * * *",
  timeZone: "Asia/Jerusalem",
  secrets: [GEMINI_API_KEY],
  memory: "512MiB",
  timeoutSeconds: 540,
}, async () => {
  const db = admin.firestore();
  const apiKey = GEMINI_API_KEY.value();

  const familiesSnap = await db.collection("families").get();
  console.log(`[generateInsightsDaily] processing ${familiesSnap.size} families`);

  let okCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let totalCost = 0;

  for (const familyDoc of familiesSnap.docs) {
    try {
      const result = await generateInsightsForFamily(db, familyDoc.id, apiKey);
      if (result.status === "ok") {
        okCount++;
        totalCost += result.cost ?? 0;
      } else if (result.status === "skipped_no_data") {
        skippedCount++;
        console.log(`[insights/${familyDoc.id}] skipped: ${result.error}`);
      } else {
        failedCount++;
        console.error(`[insights/${familyDoc.id}] failed: ${result.error}`);
      }
    } catch (e) {
      failedCount++;
      console.error(`[insights/${familyDoc.id}] uncaught error:`, (e as Error).message);
    }
  }

  console.log(`[generateInsightsDaily] done: ${okCount} ok, ${skippedCount} skipped, ${failedCount} failed, $${totalCost.toFixed(5)} total`);
});

/**
 * Manual trigger for debugging / first-time backfill.
 * POST /generateInsightsManual?familyId=XXX with header Authorization: Bearer <INGEST_SECRET>
 */
export const generateInsightsManual = onRequest({
  secrets: [GEMINI_API_KEY],
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send({ error: "Method not allowed" });
    return;
  }
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.INGEST_SECRET;
  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    res.status(401).send({ error: "Unauthorized" });
    return;
  }
  const familyId = (req.query.familyId as string) || (req.body?.familyId as string);
  if (!familyId) {
    res.status(400).send({ error: "Missing familyId" });
    return;
  }
  const debug = req.query.debug === "1" || req.body?.debug === true;
  const db = admin.firestore();
  const apiKey = GEMINI_API_KEY.value();
  try {
    const result = await generateInsightsForFamily(db, familyId, apiKey, debug, "manual");
    res.status(200).send(result);
  } catch (e) {
    res.status(500).send({ error: (e as Error).message });
  }
});
