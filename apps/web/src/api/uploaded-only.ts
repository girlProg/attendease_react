import { api } from "@/lib/api"

// Settings > Display (superusers): the people who see uploaded attendance only,
// and the cohorts whose seeded rows they don't see. Display only.
export interface UploadedOnlySettings {
  cohorts: { id: number; name: string; seeded_hidden: boolean }[]
  people: {
    id: number
    name: string
    email: string
    role: string
    is_staff: boolean
    is_superuser: boolean
    uploaded_only: boolean
  }[]
}

export const getUploadedOnly = () =>
  api.get<UploadedOnlySettings>("/uploaded-only/").then((response) => response.data)

export const setUploadedOnly = (changes: {
  cohorts: Record<number, boolean>
  people: Record<number, boolean>
}) => api.put<UploadedOnlySettings>("/uploaded-only/", changes).then((response) => response.data)
