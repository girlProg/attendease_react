import { useState } from "react"
import { AlertCircle, Info } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { LabeledInput, LabeledSelect } from "@/components/form-fields"
import { QueryError } from "@/components/query-error"
import { useAuth } from "@/contexts/auth-context"
import { useLogVisit } from "@/hooks/use-log-visit"
import { getCohorts } from "@/api/attendance"
import { formatNaira } from "@/lib/formatters"
import {
  createPayableTerm,
  deletePayableTerm,
  getDisbursementSettings,
  getPayableTerms,
  getPaymentNotifications,
  setDisbursementSettings,
  setPaymentNotifications,
  updatePayableTerm,
  type DisbursementSettings,
  type PaymentNotifications,
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

  const { isSuperuser, isStaffuser } = useAuth()

  if (settings.isError) return <QueryError />
  if (!settings.data) return null
  return (
    <div className="space-y-5">
      <PayableTermsSection canEdit={isSuperuser} />
      <UploadLimitForm key={settings.data.updated_at ?? "new"} settings={settings.data} />
      {isSuperuser && isStaffuser && <NotificationsSection />}
    </div>
  )
}

const TERMS = ["1", "2", "3"]

/**
 * The payment guard: Disburse pays only a cohort, year and term listed here,
 * and every student gets its amount. Superusers open, re-price and close
 * terms; every change goes to the payment audit trail.
 */
function PayableTermsSection({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient()
  const terms = useQuery({ queryKey: ["payable-terms"], queryFn: getPayableTerms })
  const { data: cohorts = [] } = useQuery({ queryKey: ["cohort"], queryFn: getCohorts })
  const [cohort, setCohort] = useState("")
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [term, setTerm] = useState("")
  const [amount, setAmount] = useState("")
  const [editing, setEditing] = useState<{ id: number; amount: string } | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["payable-terms"] })
    queryClient.invalidateQueries({ queryKey: ["payment-audit"] })
  }
  const add = useMutation({
    mutationFn: () =>
      createPayableTerm({ cohort: Number(cohort), year: Number(year), term: Number(term), amount }),
    onSuccess: () => {
      setAmount("")
      refresh()
    },
  })
  const reprice = useMutation({
    mutationFn: (change: { id: number; amount: string }) => updatePayableTerm(change.id, change.amount),
    onSuccess: () => {
      setEditing(null)
      refresh()
    },
  })
  const close = useMutation({ mutationFn: deletePayableTerm, onSuccess: refresh })

  const amountValid = Number(amount) > 0
  const canAdd = Boolean(cohort && term && Number(year) > 2000 && amountValid) && !add.isPending
  const cohortName = (id: string) => cohorts.find((option) => String(option.id) === id)?.name ?? id
  const failure = add.error ?? reprice.error ?? close.error

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Terms open for payment</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Disburse pays only the cohort, year and term combinations listed here, and every student
          gets the amount shown. A term not listed can&apos;t be paid. Closing a term stops any
          payment for it that hasn&apos;t reached the bank yet.
        </p>
      </div>

      {terms.isError ? (
        <QueryError />
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1.5 font-medium">Cohort</th>
              <th className="py-1.5 font-medium">Year</th>
              <th className="py-1.5 font-medium">Term</th>
              <th className="py-1.5 font-medium">Per student</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {(terms.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-sm text-amber-700">
                  No term is open: nothing can be paid until one is added.
                </td>
              </tr>
            )}
            {(terms.data ?? []).map((open) => (
              <tr key={open.id} className="border-t border-border/40">
                <td className="py-2">{open.cohort_name}</td>
                <td className="py-2">{open.year}</td>
                <td className="py-2">{open.term}</td>
                <td className="py-2">
                  {editing?.id === open.id ? (
                    <input
                      type="number"
                      value={editing.amount}
                      onChange={(event) => setEditing({ id: open.id, amount: event.target.value })}
                      className="h-8 w-28 rounded-lg border border-border px-2"
                    />
                  ) : (
                    <span title={open.updated_by ? `Last changed by ${open.updated_by}` : undefined}>
                      {formatNaira(Number(open.amount))}
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="space-x-3 py-2 text-right text-xs font-semibold">
                    {editing?.id === open.id ? (
                      <>
                        <button
                          type="button"
                          className="text-sidebar hover:underline disabled:opacity-50"
                          disabled={!(Number(editing.amount) > 0) || reprice.isPending}
                          onClick={() => reprice.mutate(editing)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:underline"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-sidebar hover:underline"
                          onClick={() => setEditing({ id: open.id, amount: open.amount })}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="text-red-600 hover:underline disabled:opacity-50"
                          disabled={close.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Close cohort ${open.cohort_name} · ${open.year} · term ${open.term} for payment?`,
                              )
                            ) {
                              close.mutate(open.id)
                            }
                          }}
                        >
                          Close
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEdit && (
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
          <LabeledSelect
            label="Cohort"
            value={cohort}
            onValueChange={(value) => setCohort(value ?? "")}
            items={cohorts.map((option) => String(option.id))}
            placeholder="Cohort"
            formatItem={cohortName}
          />
          <LabeledInput label="Year" type="number" value={year} onChange={setYear} />
          <LabeledSelect
            label="Term"
            value={term}
            onValueChange={(value) => setTerm(value ?? "")}
            items={TERMS}
            placeholder="Term"
          />
          <LabeledInput label="Amount per student (₦)" type="number" value={amount} onChange={setAmount} />
          <Button className="h-11 rounded-full px-6" disabled={!canAdd} onClick={() => add.mutate()}>
            {add.isPending ? "Opening…" : "Open term"}
          </Button>
        </div>
      )}

      {failure && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(failure, "Could not save the payable term.")}
        </p>
      )}
    </section>
  )
}

const MOMENTS:{ field: keyof Omit<PaymentNotifications, "recipients">; label: string; hint: string }[] = [
  {
    field: "notify_coming",
    label: "Payments coming",
    hint: "When Generate payments creates payments (also the first step of Disburse): students per school.",
  },
  {
    field: "notify_sent",
    label: "Sent to the bank",
    hint: "When a school's Disburse has gone to the bank, or stopped part way: transfers and ₦ total.",
  },
  {
    field: "notify_paid",
    label: "Paid",
    hint: "Once per school, when the bank has answered for every transfer: how many were paid and ₦ total.",
  },
  {
    field: "notify_failed",
    label: "Failed",
    hint: "In the same email: the failed students by name with the bank's reason. A transfer that fails later gets its own email.",
  },
]

/** Payment emails to staff. Superuser + staff only; every change is logged. */
function NotificationsSection() {
  const notifications = useQuery({
    queryKey: ["payment-notifications"],
    queryFn: getPaymentNotifications,
  })
  if (notifications.isError) return <QueryError />
  if (!notifications.data) return null
  return (
    <NotificationsForm
      key={JSON.stringify(notifications.data)}
      saved={notifications.data}
    />
  )
}

function NotificationsForm({ saved }: { saved: PaymentNotifications }) {
  const queryClient = useQueryClient()
  const [recipients, setRecipients] = useState(saved.recipients.join("\n"))
  const [moments, setMoments] = useState(() =>
    Object.fromEntries(MOMENTS.map(({ field }) => [field, saved[field]])),
  )

  const addresses = recipients.split(/[\s,;]+/).filter(Boolean)
  const changed =
    addresses.join("\n").toLowerCase() !== saved.recipients.join("\n") ||
    MOMENTS.some(({ field }) => moments[field] !== saved[field])
  const anyOn = MOMENTS.some(({ field }) => moments[field])

  const save = useMutation({
    mutationFn: () => setPaymentNotifications({ recipients: addresses, ...moments }),
    onSuccess: (result) => queryClient.setQueryData(["payment-notifications"], result),
  })

  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-white p-5 md:max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Payment emails</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Emails to the addresses below when payments are made. Each moment has its own tick; nothing is
          sent until one is ticked. Emails never contain account numbers, NIN or BVN.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">Send to (one address per line)</span>
        <textarea
          value={recipients}
          onChange={(event) => setRecipients(event.target.value)}
          rows={3}
          placeholder="programme@example.org"
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-sidebar/40 focus:outline-none"
        />
      </label>

      <div className="space-y-3">
        {MOMENTS.map(({ field, label, hint }) => (
          <label key={field} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={moments[field]}
              onChange={(event) => setMoments((current) => ({ ...current, [field]: event.target.checked }))}
              className="mt-0.5 size-4 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {anyOn && addresses.length === 0 && (
        <p className="text-sm text-amber-700">Add at least one address, or nothing will be sent.</p>
      )}
      {save.isError && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {errorText(save.error, "Could not save the payment emails.")}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          className="h-11 rounded-full px-6"
          disabled={!changed || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  )
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
