import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/contexts/auth-context"
import type { FilterScope } from "@/hooks/use-attendance-filters"
import { historicScope } from "@/lib/historic-format"
import { getHistoricSummary } from "@/api/historic"

/**
 * Payments from before the MIS under a page's filters, for the page to add to
 * the totals it shows. Never pass these to anything that works out who to pay.
 */
export function useHistoricPayments(scope: FilterScope, ready: boolean) {
  const { can } = useAuth()
  const filters = historicScope(scope)
  const { data } = useQuery({
    queryKey: ["historic-summary", "payment", filters],
    queryFn: () => getHistoricSummary("payment", filters),
    enabled: ready && can("view_payments"),
  })
  return { payments: data?.records ?? 0, amount: Number(data?.amount ?? 0) }
}
