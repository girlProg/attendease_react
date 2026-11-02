import { api } from "@/lib/api"
import type { ScInsDisplayMode } from "@/types"

// Settings > Display (superusers): what an SC-INS term reads as. Display only:
// nothing that decides qualification reads it.
export interface ScInsDisplay {
  mode: ScInsDisplayMode
  range_low: number
  range_high: number
  modes: { value: ScInsDisplayMode; label: string }[]
}

export const getScInsDisplay = () =>
  api.get<ScInsDisplay>("/sc-ins-display/").then((response) => response.data)

export const setScInsDisplay = (
  changes: Partial<Pick<ScInsDisplay, "mode" | "range_low" | "range_high">>,
) => api.put<ScInsDisplay>("/sc-ins-display/", changes).then((response) => response.data)
