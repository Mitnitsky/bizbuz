import { computed, ref } from 'vue'
import { format, lastDayOfMonth, addMonths, subMonths, startOfDay } from 'date-fns'

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
