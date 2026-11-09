import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
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
import {
  getKoboEnrolmentForms,
  getKoboEnrolments,
  type KoboEnrolment,
  type KoboEnrolmentForm,
  type KoboEnrolmentOutcome,
} from "@/api/kobo"

const COLUMN_COUNT = 5
const OUTCOMES: { value: Exclude<KoboEnrolmentOutcome, "waiting">; label: string }[] = [
  { value: "review", label: "Needs review" },
  { value: "out", label: "Out" },
  { value: "passed", label: "Passed" },
]

function matchesText(enrolment: KoboEnrolment): string {
  const all = [...enrolment.matches, ...enrolment.compare_photos_with]
  return all.length ? `Matched with ${all.join(", ")}` : ""
}

/**
 * Enrolment submissions from Kobo, checked by the cleaning rules every 15 minutes.
 * Nobody here is a student yet. A result can change as more submissions arrive.
 */
export function KoboEnrolmentsPage() {
  useLogVisit("Beneficiaries", "Visited Enrolment Holding List")
  const forms = useQuery({ queryKey: ["kobo-enrolment-forms"], queryFn: getKoboEnrolmentForms })
  const [formId, setFormId] = useState<number | null>(null)

  if (forms.isError) return <QueryError />
  if (!forms.data) return null
  const form = forms.data.find((item) => item.id === formId) ?? forms.data[0]
  if (!form) {
    return (
      <p className="text-sm text-muted-foreground">
        No enrolment form has been added. A superuser adds one on Settings › Kobo.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {forms.data.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {forms.data.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={item.id === form.id ? "default" : "outline"}
              onClick={() => setFormId(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
      <FormResults key={form.id} form={form} />
    </div>
  )
}

function FormResults({ form }: { form: KoboEnrolmentForm }) {
  const [outcome, setOutcome] = useState<Exclude<KoboEnrolmentOutcome, "waiting">>("review")
  const { page, setPage, pageSize, handleRowsChange } = usePagination([outcome])
  const enrolments = useQuery({
    queryKey: ["kobo-enrolments", form.id, outcome, page, pageSize],
    queryFn: () => getKoboEnrolments(form.id, outcome, page, pageSize),
  })

  if (enrolments.isError) return <QueryError />
  const rows = enrolments.data?.results ?? []
  const totalPages = enrolments.data ? Math.ceil(enrolments.data.count / pageSize) : 0

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Cohort {form.cohort_name} · at most {form.household_cap} students to a household ·{" "}
        {form.last_checked_at
          ? `Last checked ${new Date(form.last_checked_at).toLocaleString()}`
          : "Not checked yet"}
        . Nobody here is enrolled yet, and a result can change as more arrive.
      </p>
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map((item) => (
          <Button
            key={item.value}
            variant={item.value === outcome ? "default" : "outline"}
            onClick={() => setOutcome(item.value)}
          >
            {item.label}: {form[item.value].toLocaleString()}
          </Button>
        ))}
      </div>
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
              <TableHead>Student</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Officer</TableHead>
              <TableHead>Why</TableHead>
              <TableHead>Numbers not used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrolments.isLoading && <TableSkeletonRows rows={5} columns={COLUMN_COUNT} />}
            {rows.map((enrolment) => (
              <TableRow key={enrolment.id}>
                <TableCell>
                  <div>{enrolment.student_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {enrolment.class_level} · KOBO-{enrolment.submission_id}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{enrolment.school_name}</div>
                  <div className="text-xs text-muted-foreground">{enrolment.lga}</div>
                </TableCell>
                <TableCell>{enrolment.officer}</TableCell>
                <TableCell className="max-w-sm whitespace-normal">
                  <div>{enrolment.reason}</div>
                  <div className="text-xs text-muted-foreground">{matchesText(enrolment)}</div>
                </TableCell>
                <TableCell>{enrolment.blanked.join(", ")}</TableCell>
              </TableRow>
            ))}
            {enrolments.data && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-8 text-center text-muted-foreground">
                  Nothing here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
