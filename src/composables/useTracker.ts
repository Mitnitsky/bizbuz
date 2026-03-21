import type { TrackerFields, TrackerType } from '@/types'
import { differenceInDays, addDays } from 'date-fns'

export function extractTrackerFields(data: Record<string, unknown>): TrackerFields {
  return {
    trackerType: data.tracker_type as TrackerType | undefined,
    trackerDate: (data.tracker_date as { toDate?: () => Date })?.toDate?.() ?? (data.tracker_date ? new Date(data.tracker_date as string) : undefined),
    trackerIntervalDays: data.tracker_interval_days as number | undefined,
  }
}

export function trackerDaysRemaining(tracker: TrackerFields, lastUpdated?: Date): number | null {
  if (!tracker.trackerType) return null

  const now = new Date()
  if (tracker.trackerType === 'once' && tracker.trackerDate) {
    return differenceInDays(tracker.trackerDate, now)
  }
  if (tracker.trackerType === 'interval' && tracker.trackerIntervalDays && lastUpdated) {
    const nextUpdate = addDays(lastUpdated, tracker.trackerIntervalDays)
    return differenceInDays(nextUpdate, now)
  }
  return null
}
