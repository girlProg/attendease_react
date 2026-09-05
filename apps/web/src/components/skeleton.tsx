import { TableCell, TableRow } from "@workspace/ui/components/table"

// Pulsing placeholder block. Size it with width/height classes.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-muted-foreground/15 ${className}`} />
}

// Deterministic "text" widths so a column of placeholders looks like real
// rows of varying length rather than a uniform grid.
const CELL_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-16", "w-36"]

// Placeholder rows for a table that is still loading its first page. The
// first column is treated as the S/N column (short, centred) like every list
// in the app.
export function TableSkeletonRows({
  columns,
  rows = 8,
}: {
  columns: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="border-border/40 hover:bg-transparent">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TableCell key={columnIndex} className={columnIndex === 0 ? "text-center" : undefined}>
              <Skeleton
                className={`h-3.5 ${
                  columnIndex === 0 ? "mx-auto w-6" : CELL_WIDTHS[(rowIndex + columnIndex) % CELL_WIDTHS.length]
                }`}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// The value line of a stat card: the number once loaded, a bar while loading.
export function StatValue({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  if (loading) return <Skeleton className="mt-1 h-5 w-24" />
  return <>{children}</>
}

// A whole stat card placeholder (icon circle + label + value), for pages that
// don't know their card labels until the data arrives.
export function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/40 bg-white p-5">
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  )
}
