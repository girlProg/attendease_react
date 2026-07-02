import { useEffect, useState } from "react"

export function usePagination(resetDeps: unknown[] = [], initialPageSize = 100) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // Stringified key so object-identity churn in deps (e.g. filters) doesn't retrigger resets
  const resetKey = JSON.stringify(resetDeps)
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const handleRowsChange = (value: string | null) => {
    if (value === null) return
    setPageSize(Number(value))
    setPage(1)
  }

  return { page, setPage, pageSize, setPageSize, handleRowsChange }
}
