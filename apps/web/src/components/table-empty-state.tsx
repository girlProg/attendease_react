import { TableCell, TableRow } from "@workspace/ui/components/table"

export function TableEmptyState({
  colSpan,
  message = "No data to display :/",
}: {
  colSpan: number
  message?: string
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  )
}
