/**
 * Contract test: server cycleMath must match client useBillingCycle.ts exactly.
 * The function is duplicated, so we test specific known scenarios to detect drift.
 */
import { computeCycleRange, computeIncomeWindow, cycleKey, israelDateOnly } from "./cycleMath";

describe("computeCycleRange", () => {
  test("startDay=10, current month: cycle starts day 10 of current month", () => {
    const today = new Date(2026, 3, 25); // April 25
    const r = computeCycleRange(today, 10, 0);
    expect(r.start).toEqual(new Date(2026, 3, 10));
    expect(r.end).toEqual(new Date(2026, 4, 9));
  });

  test("startDay=10, before day 10: cycle is previous month", () => {
    const today = new Date(2026, 3, 5); // April 5
    const r = computeCycleRange(today, 10, 0);
    expect(r.start).toEqual(new Date(2026, 2, 10)); // March 10
    expect(r.end).toEqual(new Date(2026, 3, 9));
  });

  test("offset=-1 returns previous cycle", () => {
    const today = new Date(2026, 3, 25);
    const r = computeCycleRange(today, 10, -1);
    expect(r.start).toEqual(new Date(2026, 2, 10));
    expect(r.end).toEqual(new Date(2026, 3, 9));
  });

  test("startDay=1: cycle = calendar month", () => {
    const today = new Date(2026, 4, 15); // May 15
    const r = computeCycleRange(today, 1, 0);
    expect(r.start).toEqual(new Date(2026, 4, 1));
    expect(r.end).toEqual(new Date(2026, 4, 31));
  });

  test("startDay=-1 (last of month): cycle ends day before last day next month", () => {
    const today = new Date(2026, 4, 15); // May 15 — before May 31, so we're still in the prev cycle
    const r = computeCycleRange(today, -1, 0);
    // Cycle: April 30 → May 30 (since May 15 < May 31)
    expect(r.start).toEqual(new Date(2026, 3, 30));
    expect(r.end).toEqual(new Date(2026, 4, 30));
  });

  test("startDay=31 in February: clamps to last of month", () => {
    const today = new Date(2026, 2, 5); // March 5 — Feb has only 28 days
    const r = computeCycleRange(today, 31, 0);
    // Cycle starts Feb 28 (clamped from 31), ends March 30
    expect(r.start).toEqual(new Date(2026, 1, 28));
    expect(r.end).toEqual(new Date(2026, 2, 30));
  });
});

describe("computeIncomeWindow", () => {
  test("anchor=1, grace=3 around April 1", () => {
    const cycleStart = new Date(2026, 3, 10);
    const w = computeIncomeWindow(cycleStart, 1, 3);
    expect(w.start).toEqual(new Date(2026, 2, 29));
    expect(w.end).toEqual(new Date(2026, 3, 4));
  });

  test("anchor=null: grace days before cycle start", () => {
    const cycleStart = new Date(2026, 3, 10);
    const w = computeIncomeWindow(cycleStart, null, 3);
    expect(w.start).toEqual(new Date(2026, 3, 7));
    expect(w.end).toEqual(new Date(2026, 3, 9));
  });
});

describe("cycleKey", () => {
  test("formats as yyyy-MM-dd in local time", () => {
    expect(cycleKey(new Date(2026, 3, 10))).toBe("2026-04-10");
    expect(cycleKey(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(cycleKey(new Date(2025, 11, 31))).toBe("2025-12-31");
  });

  test("does NOT shift for negative-offset timezones (LOCAL date)", () => {
    // Date constructed with Y/M/D constants — no UTC drift expected
    const d = new Date(2026, 3, 10);
    expect(cycleKey(d)).toBe("2026-04-10");
  });
});

describe("israelDateOnly (timezone-safe normalization)", () => {
  test("UTC timestamp at IDT midnight (Apr 9 21:00Z = Apr 10 00:00 Israel)", () => {
    // This is the exact bug we hit in production: a mortgage charge stored as
    // 2026-04-09T21:00:00Z fell in a 3h gap between cycles when run on a UTC server.
    const utc = new Date("2026-04-09T21:00:00.000Z");
    const il = israelDateOnly(utc);
    expect(il.getFullYear()).toBe(2026);
    expect(il.getMonth()).toBe(3); // April
    expect(il.getDate()).toBe(10);
  });

  test("UTC timestamp at IST midnight (Mar 9 22:00Z = Mar 10 00:00 Israel)", () => {
    // Israel Standard Time = UTC+2 (winter)
    const utc = new Date("2026-03-09T22:00:00.000Z");
    const il = israelDateOnly(utc);
    expect(il.getDate()).toBe(10);
    expect(il.getMonth()).toBe(2); // March
  });

  test("midday UTC stays on same day in Israel", () => {
    const utc = new Date("2026-04-15T10:00:00.000Z");
    const il = israelDateOnly(utc);
    expect(il.getDate()).toBe(15);
    expect(il.getMonth()).toBe(3);
  });

  test("normalized date falls correctly inside cycle range on UTC server", () => {
    // Simulate the production scenario: today=Apr 30 Israel
    const today = new Date(2026, 3, 30); // April 30 (constructed from local components)
    const range = computeCycleRange(today, 10, 0); // current cycle = Apr 10 → May 9
    const mortgageUtc = new Date("2026-04-09T21:00:00.000Z"); // = Apr 10 00:00 Israel
    const mortgageNormalized = israelDateOnly(mortgageUtc);
    expect(mortgageNormalized >= range.start).toBe(true);
    expect(mortgageNormalized <= range.end).toBe(true);
  });
});
