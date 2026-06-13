/**
 * Cycle math — duplicated from src/composables/useBillingCycle.ts.
 * Kept identical so server-computed cycle ranges match what the user sees.
 *
 * If you change this file, also change useBillingCycle.ts (and vice-versa).
 */

export interface CycleRange {
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function subMonths(d: Date, n: number): Date {
  return addMonths(d, -n);
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function computeCycleRange(today: Date, startDay: number, offset: number): CycleRange {
  const year = today.getFullYear();
  const month = today.getMonth();

  const effectiveStartDay = startDay === -1 ? lastDayOfMonth(today).getDate() : startDay;
  const currentDayOfMonth = today.getDate();

  let cycleStartMonth: Date;
  if (currentDayOfMonth >= effectiveStartDay) {
    cycleStartMonth = new Date(year, month, 1);
  } else {
    cycleStartMonth = subMonths(new Date(year, month, 1), 1);
  }

  cycleStartMonth = addMonths(cycleStartMonth, offset);

  const startDayResolved = startDay === -1
    ? lastDayOfMonth(cycleStartMonth).getDate()
    : Math.min(startDay, lastDayOfMonth(cycleStartMonth).getDate());

  const start = new Date(cycleStartMonth.getFullYear(), cycleStartMonth.getMonth(), startDayResolved);

  const nextMonth = addMonths(cycleStartMonth, 1);
  const endDayResolved = startDay === -1
    ? lastDayOfMonth(nextMonth).getDate()
    : Math.min(startDay, lastDayOfMonth(nextMonth).getDate());

  const end = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), endDayResolved - 1);

  return { start: startOfDay(start), end: startOfDay(end) };
}

/** Income window — duplicated from src/composables/useBillingCycle.ts. */
export function computeIncomeWindow(
  cycleStart: Date,
  anchorDay: number | null,
  graceDays: number,
): CycleRange {
  if (anchorDay !== null) {
    const year = cycleStart.getFullYear();
    const month = cycleStart.getMonth();
    const resolvedAnchor = Math.min(anchorDay, lastDayOfMonth(cycleStart).getDate());
    const anchor = new Date(year, month, resolvedAnchor);
    return {
      start: startOfDay(subDays(anchor, graceDays)),
      end: startOfDay(addDays(anchor, graceDays)),
    };
  }
  return {
    start: startOfDay(subDays(cycleStart, graceDays)),
    end: startOfDay(subDays(cycleStart, 1)),
  };
}

/**
 * Timezone-safe cycle doc key. Formats the cycle start as yyyy-MM-dd
 * using LOCAL date components (not UTC) — same as date-fns format(d, 'yyyy-MM-dd').
 *
 * Server runs in UTC by default; pass a Date constructed with year/month/day
 * components (no timestamp from another timezone) to keep this stable.
 */
export function cycleKey(cycleStart: Date): string {
  const y = cycleStart.getFullYear();
  const m = String(cycleStart.getMonth() + 1).padStart(2, "0");
  const d = String(cycleStart.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get "today" as a date in the family's timezone (Asia/Jerusalem).
 * Returns a Date whose y/m/d components match Israel local date,
 * regardless of where the function executes.
 */
export function todayInIsrael(): Date {
  const tzString = new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
  const israeliNow = new Date(tzString);
  return new Date(israeliNow.getFullYear(), israeliNow.getMonth(), israeliNow.getDate());
}

/**
 * Normalize an absolute timestamp to its Israel-local DATE (y/m/d) and
 * return a Date at midnight in the function's local timezone for that y/m/d.
 *
 * Why: Cloud Functions run in UTC. A transaction stored as
 * `2026-04-09T21:00:00Z` is Apr 10 00:00 in Israel (during IDT, UTC+3).
 * The user sees it in the Apr 10 cycle, but a naive `t.date >= range.start`
 * comparison on the server would put it 3 hours BEFORE Apr 10 00:00 UTC.
 *
 * Pass every transaction date through this helper before comparing to
 * cycle ranges built via `computeCycleRange` (which uses local date
 * components and therefore produces UTC midnight on a UTC server).
 */
export function israelDateOnly(d: Date): Date {
  const tzString = d.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" });
  const il = new Date(tzString);
  return new Date(il.getFullYear(), il.getMonth(), il.getDate());
}
