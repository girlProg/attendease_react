import { useQuery } from "@tanstack/react-query"

import { getConfig } from "@/api/config"
import type { DayName } from "@/types"

// Kaduna's week is the safe default while config loads; Niger adds Friday and the
// real list arrives from GET /api/config/. Labels cover every possible day so a
// lookup never misses.
const FALLBACK_ACTIVE_DAYS: DayName[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
]

const ALL_DAY_LABELS: Record<DayName, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
}

/**
 * The deployment's school week, sourced from the API (never hardcoded). One
 * frontend build serves every state, so day columns and attendance payloads
 * must derive from this.
 */
export function useSchoolWeek() {
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  const activeDays = data?.active_days ?? FALLBACK_ACTIVE_DAYS
  const labelFor = (day: DayName) => data?.day_labels?.[day] ?? ALL_DAY_LABELS[day]

  return { activeDays, labelFor, config: data }
}
