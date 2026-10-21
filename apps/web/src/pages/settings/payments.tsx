import { useState } from "react"
import { AlertCircle, Info } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput } from "@/components/form-fields"
import { QueryError } from "@/components/query-error"
import { useLogVisit } from "@/hooks/use-log-visit"
import {
  getDisbursementSettings,
  setDisbursementSettings,
  type DisbursementSettings,
} from "@/api/payments"

function errorText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0]
    if (Array.isArray(first) && typeof first[0] === "string") return first[0]
    if (typeof first === "string") return first
  }
  return fallback
}

// The fewest uploads of equal size under the limit, as the server splits them.
function uploadSizes(count: number, limit: number): number[] {
  const uploads = Math.ceil(count / limit)
  const size = Math.floor(count / uploads)
  const larger = count % uploads
  return Array.from({ length: uploads }, (_, index) => size + (index < larger ? 1 : 0))
}

/**
 * How disbursements are sent to the bank. Superusers only.
 *
 * The bank's gateway refuses an upload that is too big: it answers with an
 * error page, and the batch is left Unknown. A disbursement bigger than the
 * limit here goes as several uploads of equal size, one batch each.
 */
export function PaymentSettingsPage() {
  useLogVisit("Settings", "Visited Payment Settings")
  const settings = useQuery({
    queryKey: ["disbursement-settings"],
    queryFn: getDisbursementSettings,
  })

  if (settings.isError) return <QueryError />
  if (!settings.data) return null
  return <UploadLimitForm key={settings.data.updated_at ?? "new"} settings={settings.data} />
}

function UploadLimitForm({ settings }: { settings: DisbursementSettings }) {
  const queryClient = useQueryClient()
  const saved = settings.max_transfers_per_upload
  const [value, setValue] = useState(saved === null ? "" : String(saved))

  const trimmed = value.trim()
  const parsed = trimmed === "" ? null : Number(trimmed)
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 1)
  const changed = valid && parsed !== saved

  const save = useMutation({
    mutationFn: () => setDisbursementSettings({ max_transfers_per_upload: parsed }),
    onSuccess: (result) => {
      queryClient.setQueryData(["disbursement-settings"], result)
      queryClient.invalidateQueries({ queryKey: ["payment-audit"] })
    },
  })

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Most transfers per upload</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The bank&apos;s gateway refuses an upload that is too big: it answers with an error page
          and the batch is left Unknown. A disbursement bigger than this number is sent as several
          uploads of equal size, one batch each. If one fails, the rest are not sent and stay ready
          to send. Leave it empty to send everything in one upload.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <LabeledInput label="Transfers per upload" type="number" value={value} onChange={setValue} />
        </div>
        <Button
          className="h-11 rounded-full px-6"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {!valid && <p className="text-sm text-red-600">Enter a whole number of 1 or more, or leave it empty.</p>}
      {save.isError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(save.error, "Could not save the limit.")}
        </p>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        {saved === null
          ? "Now: no limit. Every disbursement goes in one upload."
          : `Now: ${saved}. A school of 137 goes as ${uploadSizes(137, saved).join(" + ")}; one of 356 as ${uploadSizes(356, saved).join(" + ")}.`}
        {settings.updated_by ? ` Last changed by ${settings.updated_by}.` : ""}
      </p>
    </section>
  )
}
