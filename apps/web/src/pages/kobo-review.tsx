import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { KoboSchoolChoice } from "@/components/kobo-school-choice"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableSkeletonRows } from "@/components/skeleton"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import {
  getHeldKoboSubmissions,
  resolveKoboSubmission,
  type KoboResolution,
  type KoboSubmission,
} from "@/api/kobo"

const COLUMN_COUNT = 5
const SCHOOL_NOT_ON_MIS = "School not on the MIS"

/**
 * Kobo verification submissions that need a person: the student wasn't found, a
 * value was refused, or the school isn't on the MIS. Everything else applied on
 * its own. The server sends no NINs here.
 */
export function KoboReviewPage() {
  useLogVisit("Beneficiaries", "Visited Kobo Review")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([])
  const held = useQuery({
    queryKey: ["kobo-held", page, pageSize],
    queryFn: () => getHeldKoboSubmissions(page, pageSize),
  })

  if (held.isError) return <QueryError />
  const rows = held.data?.results ?? []
  const totalPages = held.data ? Math.ceil(held.data.count / pageSize) : 0

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {held.data?.count ?? 0} Kobo verification submissions need review.
      </p>
      <PaginationBar
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        defaultRows={String(pageSize)}
        onRowsChange={handleRowsChange}
      />
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Beneficiary ID</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>School on the form</TableHead>
              <TableHead>Why it is waiting</TableHead>
              <TableHead>What to do</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {held.isLoading && <TableSkeletonRows rows={5} columns={COLUMN_COUNT} />}
            {rows.map((submission) => (
              <HeldRow key={submission.id} submission={submission} />
            ))}
            {held.data && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center text-muted-foreground">
                  Nothing needs review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function HeldRow({ submission }: { submission: KoboSubmission }) {
  const queryClient = useQueryClient()
  const resolve = useMutation({
    mutationFn: ({ action, schoolId }: { action: KoboResolution; schoolId?: number }) =>
      resolveKoboSubmission(submission.id, action, schoolId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kobo-held"] }),
  })
  const schoolProblem = submission.reason.startsWith(SCHOOL_NOT_ON_MIS)

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{submission.beneficiary_id || "None"}</TableCell>
      <TableCell>{submission.student_name}</TableCell>
      <TableCell>{submission.school_name}</TableCell>
      <TableCell className="max-w-xs whitespace-normal">
        {submission.reason}
        {submission.notes && (
          <p className="mt-1 text-xs text-muted-foreground">Notes: {submission.notes}</p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex min-w-56 flex-col gap-2">
          {schoolProblem && (
            <KoboSchoolChoice
              lga={submission.lga}
              disabled={resolve.isPending}
              onUse={(schoolId) => resolve.mutate({ action: "use_school", schoolId })}
              onAdd={() => resolve.mutate({ action: "add_school" })}
            />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ action: "retry" })}
            >
              Try again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ action: "dismiss" })}
            >
              Dismiss
            </Button>
          </div>
          {resolve.isError && (
            <p className="text-xs text-destructive">That didn't work. Please try again.</p>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
