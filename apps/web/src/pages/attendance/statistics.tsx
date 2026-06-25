import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type StatRecord = {
  sn: number
  school: string
  count: number
}

const mockData: StatRecord[] = []

export function Statistics() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/40 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-border/40 bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-20 text-xs font-semibold text-sidebar">S/N</TableHead>
            <TableHead className="text-xs font-semibold text-sidebar">School</TableHead>
            <TableHead className="text-right text-xs font-semibold text-sidebar">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-sm text-muted-foreground">
                Loading data...
              </TableCell>
            </TableRow>
          ) : (
            mockData.map((row) => (
              <TableRow key={row.sn} className="border-border/40">
                <TableCell className="text-sm text-muted-foreground">{row.sn}</TableCell>
                <TableCell className="text-sm font-medium text-foreground">{row.school}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{row.count}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
