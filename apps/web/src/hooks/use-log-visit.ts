import { useEffect } from "react"
import { api } from "@/lib/api"

export function useLogVisit(type: string, action: string) {
  useEffect(() => {
    api.post("/activity-log/", { type, action }).catch(() => {})
  }, [type, action])
}
