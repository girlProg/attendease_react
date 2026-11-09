import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { PaginationBar } from "@/components/pagination-bar"
import { QueryError } from "@/components/query-error"
import { TableSkeletonRows } from "@/components/skeleton"
import { useLogVisit } from "@/hooks/use-log-visit"
import { usePagination } from "@/hooks/use-pagination"
import { getLGAs, getSchools } from "@/api/attendance"
import {
  getHeldKoboSubmissions,
  resolveKoboSubmission,
  type KoboResolution,
  type KoboSubmission,
} from "@/api/kobo"

const COLUMN_COUNT = 5
const SCHOOL_NOT_ON_MIS = "School not on the MIS"

// Kobo sends an LGA as its form code ("BIRNIN_GWARI"), the MIS as a name.
function sameLga(first: string, second: string): boolean {
  const letters = (text: string) => text.toLowerCase().replace(/[^a-z]/g, "")
  return letters(first) === letters(second)
}

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
  const [school, setSchool] = useState("")
  const resolve = useMutation({
    mutationFn: ({ action, schoolId }: { action: KoboResolution; schoolId?: number }) =>
      resolveKoboSubmission(submission.id, action, schoolId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kobo-held"] }),
  })
  const schoolProblem = submission.reason.startsWith(SCHOOL_NOT_ON_MIS)
  const lgas = useQuery({ queryKey: ["lgas"], queryFn: getLGAs, enabled: schoolProblem })
  const lga = lgas.data?.find((item) => sameLga(item.name, submission.lga))
  const schools = useQuery({
    queryKey: ["schools", lga?.id],
    queryFn: () => getSchools(lga?.id),
    enabled: Boolean(lga),
  })
  const chosen = schools.data?.find((item) => String(item.id) === school)

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{submission.beneficiary_id || "None"}</TableCell>
      <TableCell>{submission.student_name}</TableCell>
      <TableCell>{submission.school_name}</TableCell>
      <TableCell className="max-w-xs whitespace-normal">{submission.reason}</TableCell>
      <TableCell>
        <div className="flex min-w-56 flex-col gap-2">
          {schoolProblem && (
            <>
              <Select value={school} onValueChange={(value) => setSchool(value ?? "")}>
                <SelectTrigger aria-label="School on the MIS" className="w-full">
                  <SelectValue>{chosen?.name ?? "Choose a school on the MIS"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {schools.data?.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!school || resolve.isPending}
                onClick={() => resolve.mutate({ action: "use_school", schoolId: Number(school) })}
              >
                Use this school
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ action: "add_school" })}
              >
                Add as a new school
              </Button>
            </>
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
