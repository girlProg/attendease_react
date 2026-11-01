import { AlertCircle } from "lucide-react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { PrimaryButton } from "@/components/primary-button"
import { everyoneNoObjection } from "@/api/attendance"

function errorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response
    ?.data
  return data?.error ?? fallback
}

/**
 * Put every active student of the cohort on the term's No Objection list,
 * whatever their attendance. Shows the count first; nobody on the list is
 * removed.
 */
export function EveryoneNoObjection({
  cohort,
  year,
  term,
  onCreated,
}: {
  cohort: number
  year: string
  term: string
  // Called with the number of students on the list.
  onCreated: (count: number) => void
}) {
  const preview = useQuery({
    queryKey: ["no-objection-everyone", cohort, year, term],
    queryFn: () => everyoneNoObjection({ cohort, year, term }),
  })
  const create = useMutation({
    mutationFn: () => everyoneNoObjection({ cohort, year, term, commit: true }),
    onSuccess: (created) =>
      onCreated(created.total_students ?? created.students),
  })
  const summary = preview.data

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every student in the cohort goes on the list, whatever their attendance.
        Graduated, dropped-out and replaced students are left out.
      </p>

      {preview.isPending && (
        <p className="text-sm text-muted-foreground">Counting students…</p>
      )}
      {preview.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorMessage(preview.error, "Could not count the students.")}
        </div>
      )}

      {summary && (
        <div className="space-y-1 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
          <p className="font-medium">
            {summary.students.toLocaleString()} students will be on the list.
          </p>
          {summary.without_account > 0 && (
            <p>
              {summary.without_account.toLocaleString()} of them have no usable
              account; Generate payments skips them until one is added.
            </p>
          )}
          {summary.already_on_list > 0 && (
            <p>
              {summary.already_on_list.toLocaleString()} are on the list
              already.
            </p>
          )}
        </div>
      )}

      {create.isError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorMessage(create.error, "Could not create the list.")}
        </div>
      )}

      <div className="flex justify-end">
        <PrimaryButton
          className="h-10 w-auto px-6"
          disabled={!summary || create.isPending || create.isSuccess}
          onClick={() => create.mutate()}
        >
          {create.isPending
            ? "Creating…"
            : `Create list of ${(summary?.students ?? 0).toLocaleString()} students`}
        </PrimaryButton>
      </div>
    </div>
  )
}
