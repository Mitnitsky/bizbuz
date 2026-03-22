import { computed, ref } from 'vue'
import { format, lastDayOfMonth, addMonths, subMonths, startOfDay, subDays, addDays } from 'date-fns'

export function useBillingCycle(cycleStartDay: () => number) {
  const cycleOffset = ref(0)

  const cycleRange = computed(() => {
    const today = startOfDay(new Date())
    const startDay = cycleStartDay()
    return computeCycleRange(today, startDay, cycleOffset.value)
  })

  const cycleLabel = computed(() => {
    const range = cycleRange.value
    if (!range) return ''
    return `${format(range.start, 'MMM dd')} – ${format(range.end, 'MMM dd')}`
  })

  function nextCycle() { cycleOffset.value++ }
  function prevCycle() { cycleOffset.value-- }
  function resetCycle() { cycleOffset.value = 0 }

  return { cycleOffset, cycleRange, cycleLabel, nextCycle, prevCycle, resetCycle }
}

export function computeCycleRange(today: Date, startDay: number, offset: number): { start: Date; end: Date } {
  const year = today.getFullYear()
  const month = today.getMonth()

  const effectiveStartDay = startDay === -1 ? lastDayOfMonth(today).getDate() : startDay
  const currentDayOfMonth = today.getDate()

  let cycleStartMonth: Date
  if (currentDayOfMonth >= effectiveStartDay) {
    cycleStartMonth = new Date(year, month, 1)
  } else {
    cycleStartMonth = subMonths(new Date(year, month, 1), 1)
  }

  // Apply offset
  cycleStartMonth = addMonths(cycleStartMonth, offset)

  const startDayResolved = startDay === -1
    ? lastDayOfMonth(cycleStartMonth).getDate()
    : Math.min(startDay, lastDayOfMonth(cycleStartMonth).getDate())

  const start = new Date(cycleStartMonth.getFullYear(), cycleStartMonth.getMonth(), startDayResolved)

  const nextMonth = addMonths(cycleStartMonth, 1)
  const endDayResolved = startDay === -1
    ? lastDayOfMonth(nextMonth).getDate()
    : Math.min(startDay, lastDayOfMonth(nextMonth).getDate())

  const end = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), endDayResolved - 1)

  return { start: startOfDay(start), end: startOfDay(end) }
}

/**
 * Compute the date window for income attribution to a given cycle.
 *
 * If anchorDay is set: income around that day (±graceDays) in the cycle's
 * starting month gets attributed to this cycle, even if it falls before
 * the cycle start date.
 *
 * If anchorDay is null: income window extends graceDays before cycle start.
 *
 * The returned window is UNIONED with the normal cycle range by the caller
 * so regular in-cycle income (refunds etc.) is always included.
 */
export function computeIncomeWindow(
  cycleStart: Date,
  anchorDay: number | null,
  graceDays: number,
): { start: Date; end: Date } {
  if (anchorDay !== null) {
    // Anchor mode: income expected around anchorDay of the cycle's month
    const year = cycleStart.getFullYear()
    const month = cycleStart.getMonth()
    const resolvedAnchor = Math.min(anchorDay, lastDayOfMonth(cycleStart).getDate())
    const anchor = new Date(year, month, resolvedAnchor)
    return {
      start: startOfDay(subDays(anchor, graceDays)),
      end: startOfDay(addDays(anchor, graceDays)),
    }
  }
  // Default: extend cycle start backwards by graceDays
  return {
    start: startOfDay(subDays(cycleStart, graceDays)),
    end: startOfDay(subDays(cycleStart, 1)),
  }
}
